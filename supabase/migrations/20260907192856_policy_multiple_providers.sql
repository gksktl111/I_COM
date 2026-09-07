-- Preserve existing Gov24 storage and privileges; each run belongs to exactly one source.
alter table public.policy_sources drop constraint policy_sources_provider_check;
alter table public.policy_sources add constraint policy_sources_provider_check
  check (provider in ('GOV24','BOKJIRO_CENTRAL','BOKJIRO_LOCAL'));
alter table public.policy_sync_locks drop constraint policy_sync_locks_name_check;
alter table public.policy_sync_locks add constraint policy_sync_locks_name_check
  check (name in ('GOV24','BOKJIRO_CENTRAL','BOKJIRO_LOCAL'));
alter table public.policy_sync_runs add column provider text not null default 'GOV24'
  check (provider in ('GOV24','BOKJIRO_CENTRAL','BOKJIRO_LOCAL'));
insert into public.policy_sync_locks(name) values ('BOKJIRO_CENTRAL'), ('BOKJIRO_LOCAL');

create or replace function public.policy_sync_command(p_action text, p_payload jsonb)
returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public
as $$
declare
  v_provider text;
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
  v_provider := coalesce(p_payload->>'provider','GOV24');
  if v_provider not in ('GOV24','BOKJIRO_CENTRAL','BOKJIRO_LOCAL') then raise exception 'INVALID_PROVIDER'; end if;
  if p_action = 'current' then
    select jsonb_build_object('snapshotId', s.id, 'raw', s.raw, 'normalized', p.normalized)
      into v_result
      from public.policy_sources src
      join public.policies p on p.source_id = src.id
      join public.policy_source_snapshots s on s.source_id = src.id and s.id = p.applied_snapshot_id
      where src.provider = v_provider and src.external_id = p_payload->>'externalId';
    return v_result;
  elsif p_action = 'run' then
    select jsonb_build_object('run', to_jsonb(r), 'items',
      (select coalesce(jsonb_agg(to_jsonb(i) order by i.external_id), '[]'::jsonb)
        from public.policy_sync_items i where i.run_id = r.id))
      into v_result from public.policy_sync_runs r where r.id = (p_payload->>'runId')::uuid and r.provider = v_provider;
    return v_result;
  end if;
  if p_action not in ('start', 'heartbeat', 'snapshot', 'apply', 'fail', 'finish') or p_action is null then
    raise exception 'UNKNOWN_ACTION';
  end if;

  -- One short transaction locks and fences every mutation, including acquisition.
  select * into strict v_lock from public.policy_sync_locks where name = v_provider for update;
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
      if not found or v_run.provider is distinct from v_provider or v_run.scope is distinct from v_scope or v_run.trigger is distinct from p_payload->>'trigger'
        or v_run.status in ('SUCCESS','SKIPPED') then raise exception 'INVALID_RESUME'; end if;
    end if;
    if v_lock.owner is not null and v_lock.expires_at > clock_timestamp() then
      insert into public.policy_sync_runs(id, provider, trigger, scope, status, finished_at, summary)
        values (v_requested_id, v_provider, p_payload->>'trigger', v_scope, 'SKIPPED', clock_timestamp(),
          jsonb_build_object('errorCode','LEASE_BUSY'));
      return jsonb_build_object('runId',v_requested_id,'generation',null,'status','SKIPPED','completedIds','[]'::jsonb);
    end if;
    if p_payload->>'resumeRunId' is null then
      insert into public.policy_sync_runs(id, provider, trigger, scope, status)
        values (v_run_id,v_provider,p_payload->>'trigger',v_scope,'RUNNING');
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
      expires_at = clock_timestamp() + interval '120 seconds' where name = v_provider
      returning generation into v_lock.generation;
    return jsonb_build_object('runId',v_run_id,'generation',v_lock.generation,'status','RUNNING',
      'completedIds',(select coalesce(jsonb_agg(external_id order by external_id),'[]'::jsonb)
        from public.policy_sync_items where run_id = v_run_id and status = 'SUCCESS'));
  end if;

  v_run_id := v_requested_id;
  select * into v_run from public.policy_sync_runs where id = v_run_id;
  if not found or v_run.provider is distinct from v_provider or v_run.status <> 'RUNNING' or v_lock.owner is distinct from v_run_id
    or v_lock.generation is distinct from (p_payload->>'generation')::bigint
    or v_lock.expires_at <= clock_timestamp() then raise exception 'STALE_LEASE'; end if;
  if p_action = 'heartbeat' then
    update public.policy_sync_locks set expires_at = clock_timestamp() + interval '120 seconds' where name = v_provider;
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
    update public.policy_sync_locks set owner = null, expires_at = '-infinity' where name = v_provider;
    return v_result;
  end if;

  v_external_id := p_payload->>'externalId';
  select * into v_item from public.policy_sync_items where run_id = v_run_id and external_id = v_external_id for update;
  if not found then raise exception 'OUTSIDE_SCOPE'; end if;
  if v_item.status = 'SUCCESS' then raise exception 'ITEM_ALREADY_SUCCESS'; end if;
  if p_action = 'snapshot' then
    if v_provider = 'GOV24' then
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
    else
      if jsonb_typeof(p_payload->'raw') is distinct from 'object'
        or p_payload#>>'{raw,provider}' is distinct from v_provider
        or p_payload#>>'{raw,apiVersion}' is distinct from 'v1'
        or jsonb_typeof(p_payload#>'{raw,externalId}') is distinct from 'string'
        or p_payload#>>'{raw,externalId}' is distinct from v_external_id
        or jsonb_typeof(p_payload#>'{raw,list,servId}') is distinct from 'string'
        or p_payload#>>'{raw,list,servId}' is distinct from v_external_id
        or jsonb_typeof(p_payload#>'{raw,detail}') is distinct from 'array'
        or jsonb_typeof(p_payload#>'{raw,xml,list}') is distinct from 'string'
        or jsonb_typeof(p_payload#>'{raw,xml,detail}') is distinct from 'string'
        then raise exception 'INVALID_RAW_IDENTITY'; end if;
      if jsonb_array_length(p_payload#>'{raw,detail}') <> 1
        or jsonb_typeof(p_payload#>'{raw,detail,0,servId}') is distinct from 'string'
        or p_payload#>>'{raw,detail,0,servId}' is distinct from v_external_id
        then raise exception 'INVALID_RAW_IDENTITY'; end if;
    end if;
    insert into public.policy_sources(provider,external_id) values (v_provider,v_external_id)
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
  select id into v_source_id from public.policy_sources where provider = v_provider and external_id = v_external_id for update;
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
