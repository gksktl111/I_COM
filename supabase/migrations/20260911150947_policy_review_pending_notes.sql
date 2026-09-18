-- Store source-bound reasons for completed reviews that remain pending, too.
-- Review v1 remains replayable; v2 records full disposition and richer evidence.
-- Preserve automatic v3 collection and immutable prior observations.
create or replace function public.policy_store_relevance(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  v_policy public.policies%rowtype;
  v_assessment jsonb:=p_payload->'relevance';
  v_observation public.policy_relevance_observations%rowtype;
begin
  if coalesce(jsonb_typeof(v_assessment),'null')<>'object'
    or coalesce(v_assessment->>'version','') not in ('policy-relevance-1','policy-relevance-2','policy-relevance-3','policy-relevance-review-1','policy-relevance-review-2')
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
  if v_assessment->>'version' in ('policy-relevance-review-1','policy-relevance-review-2') then
    if p_payload->'reviewOnly' is distinct from 'true'::jsonb
      or v_assessment->>'status' not in ('RELATED','UNRELATED','REVIEW')
      or (v_assessment->>'version'='policy-relevance-review-1' and v_assessment->>'status'<>'RELATED')
      or (v_assessment->>'status' in ('UNRELATED','REVIEW') and jsonb_array_length(v_assessment->'categories')<>0)
      or jsonb_typeof(p_payload->'expectedNormalized') is distinct from 'object'
      or not (p_payload ? 'previousRelevance')
      then raise exception 'INVALID_REVIEW_ACTIVATION'; end if;
    if v_policy.normalized is distinct from p_payload->'expectedNormalized'
      then raise exception 'STALE_REVIEW_SOURCE'; end if;
    if (v_assessment->>'status'<>'REVIEW' and jsonb_array_length(v_assessment->'evidence')=0)
      or (v_assessment->>'version'='policy-relevance-review-2' and v_assessment->>'status'<>'REVIEW' and not exists(
        select 1 from jsonb_array_elements(v_assessment->'evidence') e
        where e->>'field' in ('target_text','benefit_text','criteria_text')))
      or exists(select 1 from jsonb_array_elements(v_assessment->'categories') c
        where c#>>'{}' not in ('임신·출산','양육·보육','아동 돌봄','아동 의료·건강','아동 교육','가족 지원','신혼·자녀가구 주거'))
      or exists(select 1 from jsonb_array_elements(v_assessment->'evidence') e
        where (v_assessment->>'version'='policy-relevance-review-1' and e->>'field' not in ('name','target_text','benefit_text'))
        or e->>'field' not in ('name','target_text','benefit_text','criteria_text','summary','purpose_text')
        or length(btrim(e->>'excerpt'))=0 or length(btrim(e->>'rule'))=0
        or position(e->>'excerpt' in coalesce(v_policy.normalized#>>array['display',e->>'field'],''))=0)
      then raise exception 'INVALID_REVIEW_EVIDENCE'; end if;
    -- Exact retries do not append observations or regenerate labels.
    if v_policy.relevance = v_assessment then
      return jsonb_build_object('sourceId',v_policy.source_id,'status',v_assessment->>'status','replayed',true);
    end if;
    if v_policy.catalog_status<>'REVIEW'
      or coalesce(v_policy.relevance,'null'::jsonb) is distinct from p_payload->'previousRelevance'
      then raise exception 'STALE_REVIEW_DECISION'; end if;
  elsif v_policy.relevance->>'version' in ('policy-relevance-review-1','policy-relevance-review-2') then
    -- Old automatic rules cannot undo a review of the same source. A changed
    -- normalized source already clears relevance via policy_invalidate_relevance.
    return jsonb_build_object('sourceId',v_policy.source_id,'status',v_policy.relevance->>'status','preservedReviewed',true);
  end if;
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
notify pgrst,'reload schema';
