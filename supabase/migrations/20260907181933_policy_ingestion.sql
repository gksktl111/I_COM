-- Initial server-only ingestion storage. No public policy read API is granted.
create table public.policy_sources (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'GOV24'),
  external_id text not null check (length(btrim(external_id)) > 0),
  observed_at timestamptz not null default clock_timestamp(),
  succeeded_at timestamptz,
  unique (provider, external_id)
);
create table public.policy_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.policy_sources(id),
  raw_hash text not null check (length(raw_hash) > 0),
  hash_version text not null check (length(hash_version) > 0),
  raw jsonb not null check (jsonb_typeof(raw) = 'object'),
  captured_at timestamptz not null default clock_timestamp(),
  unique (source_id, hash_version, raw_hash),
  unique (source_id, id)
);
create table public.policies (
  source_id uuid primary key references public.policy_sources(id),
  applied_snapshot_id uuid not null,
  normalized jsonb not null check (jsonb_typeof(normalized) = 'object'),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (source_id, applied_snapshot_id)
    references public.policy_source_snapshots(source_id, id)
);
create index policies_snapshot_idx on public.policies(source_id, applied_snapshot_id);
create table public.policy_sync_runs (
  id uuid primary key,
  trigger text not null check (trigger in ('manual', 'scheduled', 'reprocess')),
  scope jsonb not null check (jsonb_typeof(scope) = 'array' and jsonb_array_length(scope) > 0),
  status text not null check (status in ('RUNNING', 'SKIPPED', 'SUCCESS', 'PARTIAL', 'FAILED')),
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  calls integer not null default 0 check (calls >= 0),
  summary jsonb not null default '{}'::jsonb
);
create table public.policy_sync_items (
  run_id uuid not null references public.policy_sync_runs(id),
  external_id text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SUCCESS', 'FAILED')),
  attempts integer not null default 0 check (attempts >= 0),
  snapshot_id uuid references public.policy_source_snapshots(id),
  before_snapshot_id uuid references public.policy_source_snapshots(id),
  changes jsonb not null default '{}'::jsonb,
  error_code text,
  evidence jsonb not null default '[]'::jsonb,
  attempt_history jsonb not null default '[]'::jsonb check (jsonb_typeof(attempt_history) = 'array'),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (run_id, external_id)
);
create index policy_sync_items_snapshot_idx on public.policy_sync_items(snapshot_id);
create index policy_sync_items_before_snapshot_idx on public.policy_sync_items(before_snapshot_id);
create table public.policy_sync_locks (
  name text primary key check (name = 'GOV24'),
  owner uuid references public.policy_sync_runs(id),
  generation bigint not null default 0 check (generation >= 0),
  expires_at timestamptz not null default '-infinity'
);
create index policy_sync_locks_owner_idx on public.policy_sync_locks(owner);
insert into public.policy_sync_locks(name) values ('GOV24');

alter table public.policy_sources enable row level security;
alter table public.policy_source_snapshots enable row level security;
alter table public.policies enable row level security;
alter table public.policy_sync_runs enable row level security;
alter table public.policy_sync_items enable row level security;
alter table public.policy_sync_locks enable row level security;
-- service_role already has BYPASSRLS in Supabase; no client policies exist.
revoke all on public.policy_sources, public.policy_source_snapshots, public.policies,
  public.policy_sync_runs, public.policy_sync_items, public.policy_sync_locks
  from public, anon, authenticated, service_role;
grant select, insert, update on public.policy_sources, public.policy_source_snapshots,
  public.policies, public.policy_sync_runs, public.policy_sync_items, public.policy_sync_locks
  to service_role;

create function public.policy_sync_command(p_action text, p_payload jsonb)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare
  v_run_id uuid;
  v_requested_id uuid;
  v_external_id text;
  v_lock public.policy_sync_locks%rowtype;
  v_run public.policy_sync_runs%rowtype;
  v_item public.policy_sync_items%rowtype;
  v_source_id uuid;
  v_snapshot public.policy_source_snapshots%rowtype;
  v_snapshot_id uuid;
  v_before uuid;
  v_result jsonb;
  v_scope jsonb;
  v_success integer;
  v_failed integer;
  v_pending integer;
  v_status text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'INVALID_PAYLOAD';
  end if;
  if p_action = 'current' then
    select jsonb_build_object('snapshotId', s.id, 'raw', s.raw, 'normalized', p.normalized)
      into v_result
      from public.policy_sources src
      join public.policies p on p.source_id = src.id
      join public.policy_source_snapshots s on s.source_id = src.id and s.id = p.applied_snapshot_id
      where src.provider = 'GOV24' and src.external_id = p_payload->>'externalId';
    return v_result;
  elsif p_action = 'run' then
    select jsonb_build_object('run', to_jsonb(r), 'items',
      (select coalesce(jsonb_agg(to_jsonb(i) order by i.external_id), '[]'::jsonb)
        from public.policy_sync_items i where i.run_id = r.id))
      into v_result from public.policy_sync_runs r where r.id = (p_payload->>'runId')::uuid;
    return v_result;
  end if;
  if p_action not in ('start', 'heartbeat', 'snapshot', 'apply', 'fail', 'finish') or p_action is null then
    raise exception 'UNKNOWN_ACTION';
  end if;

  -- One short transaction locks and fences every mutation, including acquisition.
  select * into strict v_lock from public.policy_sync_locks where name = 'GOV24' for update;
  v_requested_id := (p_payload->>'runId')::uuid;
  if v_requested_id is null then raise exception 'RUN_ID_REQUIRED'; end if;
  if p_action = 'start' then
    v_scope := p_payload->'scope';
    if jsonb_typeof(v_scope) is distinct from 'array' then raise exception 'INVALID_SCOPE'; end if;
    if jsonb_array_length(v_scope) = 0 or exists (
      select 1 from jsonb_array_elements(v_scope) s
      where jsonb_typeof(s) is distinct from 'object'
        or jsonb_typeof(s->'id') is distinct from 'string' or length(btrim(s->>'id')) = 0
        or jsonb_typeof(s->'reason') is distinct from 'string'
        or jsonb_typeof(s->'filters') is distinct from 'object'
    ) or (select count(distinct s->>'id') from jsonb_array_elements(v_scope) s) <> jsonb_array_length(v_scope)
    then raise exception 'INVALID_SCOPE'; end if;
    if p_payload->>'trigger' is null or p_payload->>'trigger' not in ('manual','scheduled','reprocess') then
      raise exception 'INVALID_TRIGGER';
    end if;
    v_run_id := coalesce((p_payload->>'resumeRunId')::uuid, v_requested_id);
    if p_payload->>'resumeRunId' is not null then
      select * into v_run from public.policy_sync_runs where id = v_run_id for update;
      if not found or v_run.scope is distinct from v_scope or v_run.trigger is distinct from p_payload->>'trigger'
        or v_run.status in ('SUCCESS','SKIPPED') then raise exception 'INVALID_RESUME'; end if;
    end if;
    if v_lock.owner is not null and v_lock.expires_at > clock_timestamp() then
      insert into public.policy_sync_runs(id, trigger, scope, status, finished_at, summary)
        values (v_requested_id, p_payload->>'trigger', v_scope, 'SKIPPED', clock_timestamp(),
          jsonb_build_object('errorCode','LEASE_BUSY'));
      return jsonb_build_object('runId',v_requested_id,'generation',null,'status','SKIPPED','completedIds','[]'::jsonb);
    end if;
    if p_payload->>'resumeRunId' is null then
      insert into public.policy_sync_runs(id, trigger, scope, status)
        values (v_run_id,p_payload->>'trigger',v_scope,'RUNNING');
      insert into public.policy_sync_items(run_id, external_id)
        select v_run_id,s->>'id' from jsonb_array_elements(v_scope) s;
    else
      update public.policy_sync_runs set status = 'RUNNING', finished_at = null, summary = '{}'::jsonb where id = v_run_id;
      -- Successful items are immutable on resume; unfinished bundles must be recollected.
      update public.policy_sync_items set
        attempt_history = attempt_history || case when status = 'PENDING' and (snapshot_id is not null or evidence <> '[]'::jsonb)
          then jsonb_build_array(jsonb_build_object('at',clock_timestamp(),'state','INCOMPLETE',
            'errorCode',error_code,'evidence',evidence,'snapshotId',snapshot_id,'attempt',attempts))
          else '[]'::jsonb end,
        status = 'PENDING', snapshot_id = null,
        error_code = null, evidence = '[]'::jsonb, updated_at = clock_timestamp()
        where run_id = v_run_id and status <> 'SUCCESS';
    end if;
    update public.policy_sync_locks set owner = v_run_id, generation = generation + 1,
      expires_at = clock_timestamp() + interval '120 seconds' where name = 'GOV24'
      returning generation into v_lock.generation;
    return jsonb_build_object('runId',v_run_id,'generation',v_lock.generation,'status','RUNNING',
      'completedIds',(select coalesce(jsonb_agg(external_id order by external_id),'[]'::jsonb)
        from public.policy_sync_items where run_id = v_run_id and status = 'SUCCESS'));
  end if;

  v_run_id := v_requested_id;
  select * into v_run from public.policy_sync_runs where id = v_run_id;
  if not found or v_run.status <> 'RUNNING' or v_lock.owner is distinct from v_run_id
    or v_lock.generation is distinct from (p_payload->>'generation')::bigint
    or v_lock.expires_at <= clock_timestamp() then raise exception 'STALE_LEASE'; end if;
  if p_action = 'heartbeat' then
    update public.policy_sync_locks set expires_at = clock_timestamp() + interval '120 seconds' where name = 'GOV24';
    return jsonb_build_object('status','RUNNING');
  elsif p_action = 'finish' then
    if jsonb_typeof(p_payload->'calls') is distinct from 'number' or (p_payload->>'calls') !~ '^[0-9]+$' then
      raise exception 'INVALID_CALLS';
    end if;
    select count(*) filter (where status = 'SUCCESS'), count(*) filter (where status = 'FAILED'),
      count(*) filter (where status = 'PENDING') into v_success,v_failed,v_pending
      from public.policy_sync_items where run_id = v_run_id;
    v_status := case when v_failed = 0 and v_pending = 0 and p_payload->>'errorCode' is null then 'SUCCESS'
      when v_success > 0 then 'PARTIAL' else 'FAILED' end;
    v_result := jsonb_build_object('status',v_status,'success',v_success,'failed',v_failed,'pending',v_pending);
    update public.policy_sync_runs set status = v_status, finished_at = clock_timestamp(),
      calls = calls + (p_payload->>'calls')::integer,
      summary = v_result || jsonb_build_object('errorCode',p_payload->>'errorCode') where id = v_run_id;
    update public.policy_sync_locks set owner = null, expires_at = '-infinity' where name = 'GOV24';
    return v_result;
  end if;

  v_external_id := p_payload->>'externalId';
  select * into v_item from public.policy_sync_items where run_id = v_run_id and external_id = v_external_id for update;
  if not found then raise exception 'OUTSIDE_SCOPE'; end if;
  if v_item.status = 'SUCCESS' then raise exception 'ITEM_ALREADY_SUCCESS'; end if;
  if p_action = 'snapshot' then
    if jsonb_typeof(p_payload->'raw') is distinct from 'object'
      or jsonb_typeof(p_payload#>'{raw,externalId}') is distinct from 'string'
      or jsonb_typeof(p_payload#>'{raw,list,서비스ID}') is distinct from 'string'
      or p_payload#>>'{raw,externalId}' is distinct from v_external_id
      or p_payload#>>'{raw,apiVersion}' is distinct from 'v3'
      or p_payload#>>'{raw,list,서비스ID}' is distinct from v_external_id
      or jsonb_typeof(p_payload#>'{raw,detail}') is distinct from 'array'
      or jsonb_typeof(p_payload#>'{raw,conditions}') is distinct from 'array' then
      raise exception 'INVALID_RAW_IDENTITY';
    end if;
    if jsonb_typeof(p_payload#>'{raw,detail,0,서비스ID}') is distinct from 'string'
      or jsonb_typeof(p_payload#>'{raw,conditions,0,서비스ID}') is distinct from 'string'
      or jsonb_array_length(p_payload#>'{raw,detail}') <> 1 or jsonb_array_length(p_payload#>'{raw,conditions}') <> 1
      or p_payload#>>'{raw,detail,0,서비스ID}' is distinct from v_external_id
      or p_payload#>>'{raw,conditions,0,서비스ID}' is distinct from v_external_id then
      raise exception 'INVALID_RAW_IDENTITY';
    end if;
    insert into public.policy_sources(provider,external_id) values ('GOV24',v_external_id)
      on conflict (provider,external_id) do update set observed_at = clock_timestamp() returning id into v_source_id;
    insert into public.policy_source_snapshots(source_id,raw_hash,hash_version,raw)
      values (v_source_id,p_payload->>'rawHash',p_payload->>'hashVersion',p_payload->'raw')
      on conflict (source_id,hash_version,raw_hash) do nothing;
    select * into strict v_snapshot from public.policy_source_snapshots
      where source_id = v_source_id and hash_version = p_payload->>'hashVersion' and raw_hash = p_payload->>'rawHash';
    if (v_snapshot.raw - 'evidence') is distinct from ((p_payload->'raw') - 'evidence') then
      raise exception 'RAW_HASH_COLLISION';
    end if;
    update public.policy_sync_items set
      attempt_history = attempt_history || case when status = 'PENDING' and (snapshot_id is not null or evidence <> '[]'::jsonb)
        then jsonb_build_array(jsonb_build_object('at',clock_timestamp(),'state','INCOMPLETE',
          'errorCode',error_code,'evidence',evidence,'snapshotId',snapshot_id,'attempt',attempts))
        else '[]'::jsonb end,
      snapshot_id = v_snapshot.id, attempts = attempts + 1,
      evidence = coalesce(p_payload->'evidence','[]'::jsonb), status = 'PENDING', error_code = null,
      updated_at = clock_timestamp() where run_id = v_run_id and external_id = v_external_id;
    return jsonb_build_object('snapshotId',v_snapshot.id);
  elsif p_action = 'fail' then
    if coalesce(length(p_payload->>'errorCode'),0) = 0 then raise exception 'ERROR_CODE_REQUIRED'; end if;
    update public.policy_sync_items set
      attempt_history = attempt_history || jsonb_build_array(jsonb_build_object('at',clock_timestamp(),
        'state','FAILED','errorCode',p_payload->>'errorCode',
        'evidence',coalesce(p_payload->'evidence','[]'::jsonb),'snapshotId',snapshot_id,
        'collectionEvidence',evidence,'attempt',case when snapshot_id is null then attempts + 1 else greatest(attempts,1) end)),
      status = 'FAILED', error_code = p_payload->>'errorCode',
      evidence = coalesce(p_payload->'evidence','[]'::jsonb),
      attempts = case when snapshot_id is null then attempts + 1 else greatest(attempts,1) end,
      updated_at = clock_timestamp() where run_id = v_run_id and external_id = v_external_id;
    return jsonb_build_object('status','FAILED');
  end if;

  v_snapshot_id := (p_payload->>'snapshotId')::uuid;
  select id into v_source_id from public.policy_sources where provider = 'GOV24' and external_id = v_external_id for update;
  select * into v_snapshot from public.policy_source_snapshots where id = v_snapshot_id and source_id = v_source_id;
  if not found or v_item.snapshot_id is distinct from v_snapshot_id then raise exception 'SNAPSHOT_SOURCE_MISMATCH'; end if;
  if jsonb_typeof(p_payload->'normalized') is distinct from 'object'
    or jsonb_typeof(p_payload#>'{normalized,display}') is distinct from 'object'
    or jsonb_typeof(p_payload#>'{normalized,display,name}') is distinct from 'string'
    or length(btrim(p_payload#>>'{normalized,display,name}')) = 0
    or p_payload#>>'{normalized,rawHash}' is distinct from v_snapshot.raw_hash
    or p_payload#>>'{normalized,hashVersion}' is distinct from v_snapshot.hash_version
    or coalesce(length(p_payload#>>'{normalized,normalizerVersion}'),0) = 0
    or coalesce(length(p_payload#>>'{normalized,displayHash}'),0) = 0 then
    raise exception 'INVALID_NORMALIZED';
  end if;
  select applied_snapshot_id into v_before from public.policies where source_id = v_source_id for update;
  insert into public.policies(source_id,applied_snapshot_id,normalized)
    values (v_source_id,v_snapshot_id,p_payload->'normalized')
    on conflict (source_id) do update set applied_snapshot_id = excluded.applied_snapshot_id,
      normalized = excluded.normalized,
      updated_at = case when public.policies.normalized->>'displayHash' is not distinct from excluded.normalized->>'displayHash'
        and public.policies.normalized->>'normalizerVersion' is not distinct from excluded.normalized->>'normalizerVersion'
        then public.policies.updated_at else clock_timestamp() end
    where public.policies.applied_snapshot_id is distinct from excluded.applied_snapshot_id
      or public.policies.normalized is distinct from excluded.normalized;
  update public.policy_sync_items set status = 'SUCCESS', before_snapshot_id = v_before,
    changes = coalesce(p_payload->'changes','{}'::jsonb), error_code = null, updated_at = clock_timestamp()
    where run_id = v_run_id and external_id = v_external_id;
  update public.policy_sources set succeeded_at = clock_timestamp() where id = v_source_id;
  return jsonb_build_object('status','SUCCESS');
end;
$$;
revoke all on function public.policy_sync_command(text,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.policy_sync_command(text,jsonb) to service_role;
