-- Versioned stricter scope evaluation; preserve all v1 observations.
create or replace function public.policy_store_relevance(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  v_policy public.policies%rowtype;
  v_assessment jsonb:=p_payload->'relevance';
  v_observation public.policy_relevance_observations%rowtype;
begin
  if coalesce(jsonb_typeof(v_assessment),'null')<>'object'
    or coalesce(v_assessment->>'version','') not in ('policy-relevance-1','policy-relevance-2')
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


create or replace function public.policy_scope_exclude(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  v_run uuid:=(p_payload->>'runId')::uuid;
  v_provider text:=coalesce(p_payload->>'provider','GOV24');
  v_external text:=p_payload->>'externalId';
  v_phase text:=p_payload->>'phase';
  v_relevance jsonb:=p_payload->'relevance';
  v_item public.policy_sync_items%rowtype;
  v_snapshot public.policy_source_snapshots%rowtype;
begin
  -- The existing heartbeat validates and locks the active provider lease/run.
  perform public.policy_sync_command_v4('heartbeat',p_payload);
  if coalesce(v_phase,'') not in ('LIST','DETAIL')
    or coalesce(v_relevance->>'version','') not in ('policy-relevance-1','policy-relevance-2')
    or coalesce(v_relevance->>'status','')<>'UNRELATED'
    or coalesce(jsonb_typeof(v_relevance->'categories'),'null')<>'array'
    or coalesce(jsonb_typeof(v_relevance->'evidence'),'null')<>'array'
    or coalesce(jsonb_typeof(v_relevance->'reason'),'null')<>'string'
    or length(coalesce(v_relevance->>'reason',''))=0 then raise exception 'INVALID_SCOPE_EXCLUSION'; end if;
  if jsonb_array_length(v_relevance->'categories')<>0 or jsonb_array_length(v_relevance->'evidence')=0
    or exists(select 1 from jsonb_array_elements(v_relevance->'evidence') e where
      coalesce(jsonb_typeof(e->'field'),'null')<>'string' or coalesce(jsonb_typeof(e->'excerpt'),'null')<>'string'
      or coalesce(jsonb_typeof(e->'rule'),'null')<>'string') then raise exception 'INVALID_SCOPE_EXCLUSION'; end if;
  select * into v_item from public.policy_sync_items where run_id=v_run and external_id=v_external for update;
  if not found or v_item.status='SUCCESS' then raise exception 'INVALID_SCOPE_ITEM'; end if;
  if exists(select 1 from public.policies p join public.policy_sources s on s.id=p.source_id
    where s.provider=v_provider and s.external_id=v_external) then raise exception 'EXISTING_POLICY_REQUIRES_REFRESH'; end if;
  if v_phase='LIST' then
    if not exists(select 1 from public.policy_auto_pages where run_id=v_run and page=(p_payload->>'page')::integer
      and payload->'ids' @> jsonb_build_array(v_external)) then raise exception 'EXCLUSION_PAGE_MISMATCH'; end if;
  else
    select snap.* into v_snapshot from public.policy_source_snapshots snap join public.policy_sources s on s.id=snap.source_id
      where snap.id=(p_payload->>'snapshotId')::uuid and s.provider=v_provider and s.external_id=v_external;
    if not found or v_item.snapshot_id is distinct from v_snapshot.id then raise exception 'SNAPSHOT_SOURCE_MISMATCH'; end if;
    if p_payload ? 'normalized' and (
      p_payload#>>'{normalized,rawHash}' is distinct from v_snapshot.raw_hash
      or p_payload#>>'{normalized,hashVersion}' is distinct from v_snapshot.hash_version)
      then raise exception 'INVALID_NORMALIZED'; end if;
  end if;
  update public.policy_sync_items set status='SUCCESS',error_code=null,
    scope_relevance=v_relevance,scope_phase=v_phase,
    changes=jsonb_build_object('scopeExcluded',true),
    attempts=case when v_phase='LIST' then attempts+1 else attempts end,
    attempt_history=attempt_history||jsonb_build_array(jsonb_build_object('at',clock_timestamp(),'state','EXCLUDED',
      'phase',v_phase,'page',p_payload->'page','snapshotId',snapshot_id,'relevance',v_relevance)),
    updated_at=clock_timestamp()
    where run_id=v_run and external_id=v_external;
  return jsonb_build_object('status','EXCLUDED');
end $$;
revoke all on function public.policy_scope_exclude(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.policy_scope_exclude(jsonb) to service_role;


notify pgrst,'reload schema';
