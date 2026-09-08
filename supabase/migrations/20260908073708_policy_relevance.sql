-- Service relevance is independent of technical quality and eligibility.
alter table public.policies add column relevance jsonb,
  add column relevance_assessed_at timestamptz;
create index policies_relevance_status_idx on public.policies ((relevance->>'status'),updated_at desc,source_id);
create index policies_relevance_categories_idx on public.policies using gin ((relevance->'categories') jsonb_path_ops);
create table public.policy_relevance_observations (
  id bigint generated always as identity primary key,
  source_id uuid not null references public.policies(source_id),
  snapshot_id uuid not null,
  normalizer_version text not null,
  display_hash text not null,
  evaluator_version text not null,
  assessment jsonb not null,
  assessed_at timestamptz not null default clock_timestamp(),
  foreign key (source_id,snapshot_id) references public.policy_source_snapshots(source_id,id),
  unique (source_id,snapshot_id,normalizer_version,display_hash,evaluator_version),
  check (jsonb_typeof(assessment)='object' and assessment->>'status' in ('RELATED','UNRELATED','REVIEW'))
);
create index policy_relevance_snapshot_idx on public.policy_relevance_observations(source_id,snapshot_id);
alter table public.policy_relevance_observations enable row level security;
revoke all on public.policy_relevance_observations from public,anon,authenticated,service_role;
grant select,insert on public.policy_relevance_observations to service_role;
revoke all on sequence public.policy_relevance_observations_id_seq from public,anon,authenticated,service_role;
grant usage,select on sequence public.policy_relevance_observations_id_seq to service_role;

-- An old assessment must never follow changed source/normalization data.
create function public.policy_invalidate_relevance() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if new.applied_snapshot_id is distinct from old.applied_snapshot_id or new.normalized is distinct from old.normalized then
    new.relevance:=null; new.relevance_assessed_at:=null;
  end if;
  return new;
end $$;
revoke all on function public.policy_invalidate_relevance() from public,anon,authenticated,service_role;
create trigger policy_invalidate_relevance before update of normalized,applied_snapshot_id on public.policies
for each row execute function public.policy_invalidate_relevance();

create function public.policy_store_relevance(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  v_policy public.policies%rowtype;
  v_assessment jsonb:=p_payload->'relevance';
  v_observation public.policy_relevance_observations%rowtype;
begin
  if coalesce(jsonb_typeof(v_assessment),'null')<>'object'
    or coalesce(v_assessment->>'version','')<>'policy-relevance-1'
    or coalesce(v_assessment->>'status','') not in ('RELATED','UNRELATED','REVIEW')
    or coalesce(jsonb_typeof(v_assessment->'categories'),'null')<>'array'
    or coalesce(jsonb_typeof(v_assessment->'evidence'),'null')<>'array'
    or coalesce(jsonb_typeof(v_assessment->'reason'),'null')<>'string'
    or length(coalesce(v_assessment->>'reason',''))=0 then raise exception 'INVALID_RELEVANCE'; end if;
  if jsonb_array_length(v_assessment->'categories')>7
    or exists(select 1 from jsonb_array_elements(v_assessment->'categories') c where jsonb_typeof(c)<>'string')
    or (v_assessment->>'status'='RELATED' and jsonb_array_length(v_assessment->'categories')=0)
    or exists(select 1 from jsonb_array_elements(v_assessment->'evidence') e where
      coalesce(jsonb_typeof(e),'null')<>'object' or coalesce(jsonb_typeof(e->'field'),'null')<>'string'
      or coalesce(jsonb_typeof(e->'excerpt'),'null')<>'string' or coalesce(jsonb_typeof(e->'rule'),'null')<>'string')
    then raise exception 'INVALID_RELEVANCE'; end if;
  select * into v_policy from public.policies where source_id=(p_payload->>'sourceId')::uuid for update;
  if not found then raise exception 'UNKNOWN_POLICY'; end if;
  if v_policy.applied_snapshot_id is distinct from (p_payload->>'snapshotId')::uuid
    or v_policy.normalized->>'displayHash' is distinct from p_payload->>'displayHash'
    or v_policy.normalized->>'normalizerVersion' is distinct from p_payload->>'normalizerVersion'
    then raise exception 'STALE_RELEVANCE'; end if;
  insert into public.policy_relevance_observations(source_id,snapshot_id,normalizer_version,display_hash,evaluator_version,assessment)
    values(v_policy.source_id,v_policy.applied_snapshot_id,p_payload->>'normalizerVersion',p_payload->>'displayHash',v_assessment->>'version',v_assessment)
    on conflict(source_id,snapshot_id,normalizer_version,display_hash,evaluator_version) do nothing;
  select * into strict v_observation from public.policy_relevance_observations
    where source_id=v_policy.source_id and snapshot_id=v_policy.applied_snapshot_id
    and normalizer_version=p_payload->>'normalizerVersion' and display_hash=p_payload->>'displayHash'
    and evaluator_version=v_assessment->>'version';
  if v_observation.assessment is distinct from v_assessment then raise exception 'RELEVANCE_VERSION_CONFLICT'; end if;
  update public.policies set relevance=v_observation.assessment,relevance_assessed_at=v_observation.assessed_at
    where source_id=v_policy.source_id;
  return jsonb_build_object('sourceId',v_policy.source_id,'status',v_assessment->>'status');
end $$;
revoke all on function public.policy_store_relevance(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.policy_store_relevance(jsonb) to service_role;

alter function public.policy_sync_command(text,jsonb) rename to policy_sync_command_v3;
create function public.policy_sync_command(p_action text,p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_result jsonb; v_source uuid;
begin
  if p_action='relevance_store' then return public.policy_store_relevance(p_payload); end if;
  v_result:=public.policy_sync_command_v3(p_action,p_payload);
  if p_action='apply' and p_payload ? 'relevance' then
    select id into strict v_source from public.policy_sources
      where provider=coalesce(p_payload->>'provider','GOV24') and external_id=p_payload->>'externalId';
    perform public.policy_store_relevance(jsonb_build_object(
      'sourceId',v_source,'snapshotId',p_payload->>'snapshotId',
      'normalizerVersion',p_payload#>>'{normalized,normalizerVersion}',
      'displayHash',p_payload#>>'{normalized,displayHash}','relevance',p_payload->'relevance'));
  end if;
  return v_result;
end $$;
revoke all on function public.policy_sync_command(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.policy_sync_command(text,jsonb) to service_role;
notify pgrst, 'reload schema';

alter function public.policy_admin_report(text,jsonb) rename to policy_admin_report_v1;
create function public.policy_admin_report(p_action text,p_filters jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if p_action='relevance_overview' then
    return (select jsonb_build_object('total',count(*),
      'related',count(*) filter(where relevance->>'status'='RELATED'),
      'unrelated',count(*) filter(where relevance->>'status'='UNRELATED'),
      'review',count(*) filter(where relevance->>'status'='REVIEW'),
      'unassessed',count(*) filter(where relevance is null)) from public.policies);
  end if;
  return public.policy_admin_report_v1(p_action,p_filters);
end $$;
revoke all on function public.policy_admin_report(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.policy_admin_report(text,jsonb) to service_role;
