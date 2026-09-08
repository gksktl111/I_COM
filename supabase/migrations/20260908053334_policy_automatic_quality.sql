-- Internal automatic collection and versioned quality observations. No client grants.
alter table public.policy_sync_runs add column collection_mode text not null default 'selection'
  check (collection_mode in ('selection','automatic'));
alter table public.policy_sync_runs drop constraint policy_sync_runs_scope_check;
alter table public.policy_sync_runs add constraint policy_sync_runs_scope_check
  check (jsonb_typeof(scope) = 'array' and (collection_mode = 'automatic' or jsonb_array_length(scope) > 0));
create table public.policy_auto_jobs (
  run_id uuid primary key references public.policy_sync_runs(id),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  next_page integer not null default 1 check (next_page > 0),
  expected_total integer check (expected_total >= 0),
  source_total integer check (source_total >= 0),
  discovered integer not null default 0 check (discovered >= 0),
  discovery_complete boolean not null default false,
  stop_reason text,
  updated_at timestamptz not null default clock_timestamp()
);
create table public.policy_auto_pages (
  run_id uuid not null references public.policy_auto_jobs(run_id),
  page integer not null check (page > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  captured_at timestamptz not null,
  primary key (run_id,page)
);
create table public.policy_api_daily_usage (
  provider text not null check (provider in ('GOV24','BOKJIRO_CENTRAL','BOKJIRO_LOCAL')),
  day date not null,
  reserved_calls integer not null default 0 check (reserved_calls >= 0),
  configured_limit integer not null check (configured_limit between 1 and 100000),
  primary key (provider,day)
);
create table public.policy_quality_observations (
  id bigint generated always as identity primary key,
  run_id uuid not null,
  external_id text not null,
  source_id uuid references public.policy_sources(id),
  snapshot_id uuid references public.policy_source_snapshots(id),
  assessment jsonb not null check (jsonb_typeof(assessment) = 'object'),
  evaluator_version text not null check (length(evaluator_version) > 0),
  status text not null check (status in ('PASS','REVIEW','ERROR','NOT_EVALUATED')),
  required_count integer not null check (required_count >= 0),
  present_count integer not null check (present_count >= 0),
  missing_count integer not null check (missing_count >= 0 and missing_count + present_count = required_count),
  issues jsonb not null check (jsonb_typeof(issues) = 'array'),
  normalizer_version text,
  raw_hash text,
  assessed_at timestamptz not null default clock_timestamp(),
  foreign key (run_id,external_id) references public.policy_sync_items(run_id,external_id)
);
create index policy_quality_run_idx on public.policy_quality_observations(run_id,id desc);
create index policy_quality_source_idx on public.policy_quality_observations(source_id,id desc);
create index policy_quality_snapshot_idx on public.policy_quality_observations(snapshot_id);
create index policy_quality_status_idx on public.policy_quality_observations(status,id desc);
create index policy_quality_issues_idx on public.policy_quality_observations using gin(issues jsonb_path_ops);
create index policy_runs_provider_started_idx on public.policy_sync_runs(provider,started_at desc,id desc);

alter table public.policy_auto_jobs enable row level security;
alter table public.policy_auto_pages enable row level security;
alter table public.policy_api_daily_usage enable row level security;
alter table public.policy_quality_observations enable row level security;
revoke all on public.policy_auto_jobs, public.policy_auto_pages, public.policy_api_daily_usage,
  public.policy_quality_observations from public,anon,authenticated,service_role;
grant select,insert,update on public.policy_auto_jobs, public.policy_auto_pages, public.policy_api_daily_usage,
  public.policy_quality_observations to service_role;
revoke all on sequence public.policy_quality_observations_id_seq from public,anon,authenticated,service_role;
grant usage,select on sequence public.policy_quality_observations_id_seq to service_role;

-- Preserve proven legacy fencing and snapshot/application transactions.
alter function public.policy_sync_command(text,jsonb) rename to policy_sync_command_v2;
create function public.policy_sync_command(p_action text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  v_provider text := coalesce(p_payload->>'provider','GOV24');
  v_id uuid := (p_payload->>'runId')::uuid;
  v_lock public.policy_sync_locks%rowtype;
  v_run public.policy_sync_runs%rowtype;
  v_job public.policy_auto_jobs%rowtype;
  v_old_page public.policy_auto_pages%rowtype;
  v_page jsonb;
  v_ids jsonb;
  v_number integer;
  v_total integer;
  v_n integer;
  v_limit integer;
  v_reserved integer;
  v_config jsonb;
  v_result jsonb;
  v_quality jsonb;
  v_item public.policy_sync_items%rowtype;
  v_source uuid;
  v_status text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or v_provider not in ('GOV24','BOKJIRO_CENTRAL','BOKJIRO_LOCAL') then raise exception 'INVALID_PAYLOAD'; end if;
  if p_action = 'auto_state' then
    select * into v_run from public.policy_sync_runs where id=v_id and provider=v_provider and collection_mode='automatic';
    if not found then raise exception 'UNKNOWN_AUTO_RUN'; end if;
    select * into strict v_job from public.policy_auto_jobs where run_id=v_id;
    select p.* into v_old_page from public.policy_auto_pages p where p.run_id=v_id and exists (
      select 1 from jsonb_array_elements_text(p.payload->'ids') x(id)
      join public.policy_sync_items i on i.run_id=v_id and i.external_id=x.id where i.status<>'SUCCESS'
    ) order by p.page limit 1;
    return jsonb_build_object('run',jsonb_build_object('id',v_run.id,'status',v_run.status,'calls',v_run.calls),'job',to_jsonb(v_job),'page',v_old_page.payload,
      'pendingIds',(select coalesce(jsonb_agg(x.id order by x.ord),'[]'::jsonb)
        from jsonb_array_elements_text(v_old_page.payload->'ids') with ordinality x(id,ord)
        join public.policy_sync_items i on i.run_id=v_id and i.external_id=x.id where i.status<>'SUCCESS'));
  end if;
  if p_action like 'auto_%' then
    select * into strict v_lock from public.policy_sync_locks where name=v_provider for update;
    if p_action='auto_start' then
      if v_id is null then raise exception 'RUN_ID_REQUIRED'; end if;
      v_config:=p_payload->'config';
      if jsonb_typeof(v_config) is distinct from 'object' or jsonb_typeof(v_config->'filters') is distinct from 'object'
        or coalesce((v_config->>'perPage')::integer,0) not between 1 and 100
        or coalesce((v_config->>'maxPages')::integer,0) not between 1 and 1000
        or coalesce((v_config->>'dailyLimit')::integer,0) not between 1 and 100000 then raise exception 'INVALID_AUTO_CONFIG'; end if;
      if v_lock.owner is not null and v_lock.expires_at>clock_timestamp() then
        return jsonb_build_object('runId',v_id,'generation',null,'status','SKIPPED');
      end if;
      if p_payload->>'resumeRunId' is not null then
        v_id:=(p_payload->>'resumeRunId')::uuid;
        select * into v_run from public.policy_sync_runs where id=v_id and provider=v_provider and collection_mode='automatic' for update;
        if not found or v_run.status='SUCCESS' then raise exception 'INVALID_AUTO_RESUME'; end if;
        select * into strict v_job from public.policy_auto_jobs where run_id=v_id;
        if v_job.config is distinct from v_config then raise exception 'AUTO_SCOPE_CHANGED'; end if;
        update public.policy_sync_runs set status='RUNNING',finished_at=null,summary='{}'::jsonb where id=v_id;
        update public.policy_auto_jobs set stop_reason=null,updated_at=clock_timestamp() where run_id=v_id;
      else
        insert into public.policy_sync_runs(id,provider,trigger,scope,status,collection_mode)
          values(v_id,v_provider,'manual','[]'::jsonb,'RUNNING','automatic');
        insert into public.policy_auto_jobs(run_id,config) values(v_id,v_config);
      end if;
      update public.policy_sync_locks set owner=v_id,generation=generation+1,expires_at=clock_timestamp()+interval '120 seconds'
        where name=v_provider returning generation into v_lock.generation;
      return jsonb_build_object('runId',v_id,'generation',v_lock.generation,'status','RUNNING');
    end if;
    select * into v_run from public.policy_sync_runs where id=v_id and provider=v_provider and collection_mode='automatic';
    if not found or v_run.status<>'RUNNING' or v_lock.owner is distinct from v_id
      or v_lock.generation is distinct from (p_payload->>'generation')::bigint or v_lock.expires_at<=clock_timestamp() then raise exception 'STALE_LEASE'; end if;
    select * into strict v_job from public.policy_auto_jobs where run_id=v_id for update;
    if p_action='auto_reserve' then
      -- Conservative reservation before each HTTP attempt; crashed attempts remain charged.
      insert into public.policy_api_daily_usage(provider,day,configured_limit)
        values(v_provider,(clock_timestamp() at time zone 'UTC')::date,(v_job.config->>'dailyLimit')::integer)
        on conflict(provider,day) do update set configured_limit=least(public.policy_api_daily_usage.configured_limit,excluded.configured_limit);
      update public.policy_api_daily_usage set reserved_calls=reserved_calls+1
        where provider=v_provider and day=(clock_timestamp() at time zone 'UTC')::date and reserved_calls<configured_limit
        returning reserved_calls into v_reserved;
      if not found then return jsonb_build_object('allowed',false,'reason','DAILY_BUDGET'); end if;
      update public.policy_sync_runs set calls=calls+1 where id=v_id;
      update public.policy_sync_locks set expires_at=clock_timestamp()+interval '120 seconds' where name=v_provider;
      return jsonb_build_object('allowed',true);
    elsif p_action in ('auto_page','auto_refresh') then
      v_page:=p_payload->'page'; v_ids:=v_page->'ids';
      if jsonb_typeof(v_ids) is distinct from 'array' or jsonb_typeof(v_page->'rows') is distinct from 'array'
        or jsonb_typeof(v_page->'evidence') is distinct from 'array' then raise exception 'INVALID_PAGE'; end if;
      v_number:=(v_page->>'page')::integer; v_total:=(v_page->>'total')::integer;
      v_n:=jsonb_array_length(v_ids); v_limit:=(v_job.config->>'perPage')::integer;
      if v_number is null or v_number<1 or v_number>(v_job.config->>'maxPages')::integer or v_total is null or v_total<0
        or v_n<>jsonb_array_length(v_page->'rows') or v_n<>greatest(0,least(v_limit,v_total-(v_number-1)*v_limit))
        or (select count(distinct x) from jsonb_array_elements_text(v_ids) x)<>v_n
        or exists(select 1 from jsonb_array_elements(v_ids) with ordinality x(id,n)
          where jsonb_typeof(x.id)<>'string' or length(btrim(x.id#>>'{}'))=0
            or x.id#>>'{}' is distinct from v_page->'rows'->(x.n::integer-1)->>(case when v_provider='GOV24' then '서비스ID' else 'servId' end))
        or v_page->>'capturedAt' is null then raise exception 'INVALID_PAGE'; end if;
      if v_job.expected_total is not null and (v_job.expected_total<>v_total
        or v_job.source_total is distinct from (v_page->>'sourceTotal')::integer) then raise exception 'SOURCE_DRIFT'; end if;
      if p_action='auto_refresh' then
        select * into v_old_page from public.policy_auto_pages where run_id=v_id and page=v_number;
        if not found or v_old_page.payload->'ids' is distinct from v_ids
          or v_old_page.payload->'total' is distinct from v_page->'total'
          or v_old_page.payload->'sourceTotal' is distinct from v_page->'sourceTotal' then raise exception 'SOURCE_DRIFT'; end if;
        update public.policy_auto_pages set payload=v_page,captured_at=(v_page->>'capturedAt')::timestamptz where run_id=v_id and page=v_number;
      else
        if v_job.discovery_complete or v_number<>v_job.next_page then raise exception 'INVALID_CHECKPOINT'; end if;
        if exists(select 1 from jsonb_array_elements_text(v_ids) x(id) join public.policy_sync_items i on i.run_id=v_id and i.external_id=x.id)
          then raise exception 'DUPLICATE_DISCOVERY_ID'; end if;
        if v_n=0 and v_job.discovered<>v_total then raise exception 'INCOMPLETE_DISCOVERY'; end if;
        insert into public.policy_auto_pages(run_id,page,payload,captured_at) values(v_id,v_number,v_page,(v_page->>'capturedAt')::timestamptz);
        insert into public.policy_sync_items(run_id,external_id) select v_id,x from jsonb_array_elements_text(v_ids) x;
        update public.policy_sync_runs set scope=scope||coalesce((select jsonb_agg(jsonb_build_object('id',x,'reason','automatic-page','filters',v_job.config->'filters')) from jsonb_array_elements_text(v_ids) x),'[]'::jsonb) where id=v_id;
        update public.policy_auto_jobs set next_page=v_number+1,expected_total=v_total,source_total=(v_page->>'sourceTotal')::integer,
          discovered=discovered+v_n,discovery_complete=(v_n=0),updated_at=clock_timestamp() where run_id=v_id;
      end if;
      return jsonb_build_object('status','SAVED');
    elsif p_action='auto_pause' then
      if p_payload->>'reason' is null or p_payload->>'reason' not in ('CALL_BUDGET','DAILY_BUDGET','ITEM_LIMIT','PAGE_LIMIT','UPSTREAM_ERROR','SOURCE_DRIFT') then raise exception 'INVALID_STOP_REASON'; end if;
      select jsonb_build_object('status','PAUSED','reason',p_payload->>'reason','success',count(*) filter(where status='SUCCESS'),
        'failed',count(*) filter(where status='FAILED'),'pending',count(*) filter(where status='PENDING'),'calls',v_run.calls)
        into v_result from public.policy_sync_items where run_id=v_id;
      update public.policy_sync_runs set status=case when (v_result->>'success')::integer>0 then 'PARTIAL' else 'FAILED' end,
        finished_at=clock_timestamp(),summary=v_result where id=v_id;
      update public.policy_auto_jobs set stop_reason=p_payload->>'reason',updated_at=clock_timestamp() where run_id=v_id;
      update public.policy_sync_locks set owner=null,expires_at='-infinity' where name=v_provider;
      return v_result;
    else raise exception 'UNKNOWN_ACTION'; end if;
  end if;
  if p_action='start' and exists(select 1 from public.policy_auto_jobs where run_id=(p_payload->>'resumeRunId')::uuid) then raise exception 'AUTO_RESUME_REQUIRED'; end if;
  if p_action='finish' and exists(select 1 from public.policy_auto_jobs where run_id=v_id) then
    select * into v_job from public.policy_auto_jobs where run_id=v_id;
    if not v_job.discovery_complete or exists(select 1 from public.policy_sync_items where run_id=v_id and status='PENDING') then raise exception 'INCOMPLETE_DISCOVERY'; end if;
    if coalesce((p_payload->>'calls')::integer,-1)<>0 then raise exception 'CALLS_ALREADY_RESERVED'; end if;
  end if;
  v_result:=public.policy_sync_command_v2(p_action,p_payload);
  if p_action in ('apply','fail') then
    -- Same transaction as application/failure; invalid quality rolls the entire action back.
    v_quality:=p_payload->'quality';
    if v_quality is null then v_quality:=jsonb_build_object('version','not-evaluated','status','NOT_EVALUATED',
      'metrics',jsonb_build_object('required',0,'present',0,'missing',0),'issues','[]'::jsonb,'comparisonReady',false); end if;
    if jsonb_typeof(v_quality) is distinct from 'object' or v_quality->>'status' not in ('PASS','REVIEW','ERROR','NOT_EVALUATED')
      or coalesce(length(v_quality->>'version'),0)=0 or v_quality->'comparisonReady' is distinct from 'false'::jsonb
      or jsonb_typeof(v_quality->'issues') is distinct from 'array' or jsonb_typeof(v_quality->'metrics') is distinct from 'object'
      or (v_quality#>>'{metrics,required}') is null or (v_quality#>>'{metrics,present}') is null or (v_quality#>>'{metrics,missing}') is null then raise exception 'INVALID_QUALITY'; end if;
    select * into strict v_item from public.policy_sync_items where run_id=v_id and external_id=p_payload->>'externalId';
    select id into v_source from public.policy_sources where provider=v_provider and external_id=v_item.external_id;
    insert into public.policy_quality_observations(run_id,external_id,source_id,snapshot_id,assessment,evaluator_version,status,
      required_count,present_count,missing_count,issues,normalizer_version,raw_hash)
      values(v_id,v_item.external_id,v_source,v_item.snapshot_id,v_quality,v_quality->>'version',v_quality->>'status',
        (v_quality#>>'{metrics,required}')::integer,(v_quality#>>'{metrics,present}')::integer,(v_quality#>>'{metrics,missing}')::integer,
        v_quality->'issues',p_payload#>>'{normalized,normalizerVersion}',p_payload#>>'{normalized,rawHash}');
  end if;
  return v_result;
end;
$$;
revoke all on function public.policy_sync_command(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.policy_sync_command(text,jsonb) to service_role;

-- Server-only read model for a future authorized administrator UI. No raw payloads.
create function public.policy_admin_report(p_action text,p_filters jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  v_provider text:=p_filters->>'provider';
  v_run uuid:=(p_filters->>'runId')::uuid;
  v_limit integer:=coalesce((p_filters->>'limit')::integer,50);
  v_rows jsonb;
  v_last jsonb;
begin
  if jsonb_typeof(p_filters) is distinct from 'object' or v_limit not between 1 and 100
    or (v_provider is not null and v_provider not in ('GOV24','BOKJIRO_CENTRAL','BOKJIRO_LOCAL')) then raise exception 'INVALID_REPORT_FILTER'; end if;
  if p_action='overview' then
    return jsonb_build_object(
      'policies',(select count(*) from public.policy_sources s join public.policies p on p.source_id=s.id where v_provider is null or s.provider=v_provider),
      'quality',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (
        select q.status,count(*) as count,sum(q.required_count) as required,sum(q.present_count) as present,sum(q.missing_count) as missing
        from public.policies p join public.policy_sources s on s.id=p.source_id
        join lateral (select * from public.policy_quality_observations o where o.source_id=s.id and o.snapshot_id=p.applied_snapshot_id and o.normalizer_version=p.normalized->>'normalizerVersion' and o.raw_hash=p.normalized->>'rawHash' order by o.id desc limit 1) q
          on q.snapshot_id=p.applied_snapshot_id and q.normalizer_version=p.normalized->>'normalizerVersion' and q.raw_hash=p.normalized->>'rawHash'
        where v_provider is null or s.provider=v_provider group by q.status order by q.status) x),
      'unassessedCurrent',(select count(*) from public.policies p join public.policy_sources s on s.id=p.source_id
        where (v_provider is null or s.provider=v_provider) and not exists(select 1 from public.policy_quality_observations q
          where q.source_id=s.id and q.snapshot_id=p.applied_snapshot_id and q.normalizer_version=p.normalized->>'normalizerVersion'
            and q.raw_hash=p.normalized->>'rawHash' and q.status<>'NOT_EVALUATED')),
      'comparisonReady',0,
      'dailyUsage',(select coalesce(jsonb_agg(to_jsonb(u)),'[]'::jsonb) from public.policy_api_daily_usage u
        where u.day=(clock_timestamp() at time zone 'UTC')::date and (v_provider is null or u.provider=v_provider)));
  elsif p_action='runs' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.started_at desc,x.id desc),'[]'::jsonb) into v_rows from (
      select r.id,r.provider,r.trigger,r.collection_mode,r.status,r.started_at,r.finished_at,r.calls,r.summary,
        j.config,j.next_page,j.expected_total,j.discovered,j.discovery_complete,j.stop_reason,
        (l.owner=r.id and l.expires_at>clock_timestamp()) as lease_active
      from public.policy_sync_runs r left join public.policy_auto_jobs j on j.run_id=r.id
      left join public.policy_sync_locks l on l.name=r.provider
      where (v_provider is null or r.provider=v_provider) and (v_run is null or r.id=v_run)
        and (p_filters->>'beforeStartedAt' is null or (r.started_at,r.id)<((p_filters->>'beforeStartedAt')::timestamptz,(p_filters->>'beforeId')::uuid))
      order by r.started_at desc,r.id desc limit v_limit) x;
    v_last:=v_rows->(jsonb_array_length(v_rows)-1);
    return jsonb_build_object('items',v_rows,'nextCursor',case when jsonb_array_length(v_rows)=v_limit then
      jsonb_build_object('beforeStartedAt',v_last->>'started_at','beforeId',v_last->>'id') else null end);
  elsif p_action='quality' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.id desc),'[]'::jsonb) into v_rows from (
      select q.*,r.provider,i.status as ingestion_status,i.error_code,
        coalesce(q.snapshot_id=p.applied_snapshot_id and q.normalizer_version=p.normalized->>'normalizerVersion'
          and q.raw_hash=p.normalized->>'rawHash',false) as matches_current
      from public.policy_quality_observations q join public.policy_sync_runs r on r.id=q.run_id
      join public.policy_sync_items i on i.run_id=q.run_id and i.external_id=q.external_id
      left join public.policies p on p.source_id=q.source_id
      where (v_provider is null or r.provider=v_provider) and (v_run is null or q.run_id=v_run)
        and (p_filters->>'status' is null or q.status=p_filters->>'status')
        and (p_filters->>'code' is null or q.issues @> jsonb_build_array(jsonb_build_object('code',p_filters->>'code')))
        and (p_filters->>'beforeId' is null or q.id<(p_filters->>'beforeId')::bigint)
      order by q.id desc limit v_limit) x;
    v_last:=v_rows->(jsonb_array_length(v_rows)-1);
    return jsonb_build_object('items',v_rows,'nextCursor',case when jsonb_array_length(v_rows)=v_limit then
      jsonb_build_object('beforeId',v_last->>'id') else null end);
  else raise exception 'UNKNOWN_REPORT'; end if;
end;
$$;
revoke all on function public.policy_admin_report(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.policy_admin_report(text,jsonb) to service_role;
