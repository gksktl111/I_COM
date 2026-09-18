-- 공식 자료를 보존하는 재평가이며 기존 원문과 평가 이력은 변경하지 않는다.
create or replace function public.policy_store_relevance(p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  v_policy public.policies%rowtype;
  v_assessment jsonb:=p_payload->'relevance';
  v_observation public.policy_relevance_observations%rowtype;
  v_evidence jsonb;
  v_retrieved timestamptz;
begin
  if coalesce(jsonb_typeof(v_assessment),'null')<>'object'
    or coalesce(v_assessment->>'version','') not in ('policy-relevance-1','policy-relevance-2','policy-relevance-3','policy-relevance-review-1','policy-relevance-review-2','policy-relevance-review-3','policy-relevance-review-4')
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
  if v_policy.relevance->>'version'='policy-relevance-review-4'
    and v_assessment->>'version' in ('policy-relevance-review-1','policy-relevance-review-2','policy-relevance-review-3')
    then raise exception 'STALE_REVIEW_DECISION'; end if;
  if v_assessment->>'version' in ('policy-relevance-review-1','policy-relevance-review-2','policy-relevance-review-3','policy-relevance-review-4') then
    if p_payload->'reviewOnly' is distinct from 'true'::jsonb
      or (v_assessment->>'version'='policy-relevance-review-3' and
        (p_payload->'correction' is distinct from 'true'::jsonb or v_assessment->>'status'<>'REVIEW'))
      or v_assessment->>'status' not in ('RELATED','UNRELATED','REVIEW')
      or (v_assessment->>'version'='policy-relevance-review-1' and v_assessment->>'status'<>'RELATED')
      or (v_assessment->>'status' in ('UNRELATED','REVIEW') and jsonb_array_length(v_assessment->'categories')<>0)
      or jsonb_typeof(p_payload->'expectedNormalized') is distinct from 'object'
      or not (p_payload ? 'previousRelevance')
      then raise exception 'INVALID_REVIEW_ACTIVATION'; end if;
    if v_policy.normalized is distinct from p_payload->'expectedNormalized'
      then raise exception 'STALE_REVIEW_SOURCE'; end if;
    if (v_assessment->>'version'<>'policy-relevance-review-4' and v_assessment->>'status'<>'REVIEW' and jsonb_array_length(v_assessment->'evidence')=0)
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
    if v_assessment->>'version'='policy-relevance-review-4' then
      if p_payload->'reassessment' is distinct from 'true'::jsonb
        or jsonb_typeof(v_assessment->'previousRelevance') is distinct from 'object'
        or v_assessment->'previousRelevance' is distinct from p_payload->'previousRelevance'
        or coalesce(v_assessment#>>'{previousRelevance,version}','') not in ('policy-relevance-review-2','policy-relevance-review-3')
        or v_assessment#>>'{previousRelevance,status}' is distinct from 'REVIEW'
        or coalesce(v_assessment->>'sourceConsistency','') not in ('CONFIRMED','CONFLICT','UNRESOLVED')
        or (v_assessment->>'status'='RELATED' and v_assessment->>'sourceConsistency'<>'CONFIRMED')
        then raise exception 'INVALID_REASSESSMENT'; end if;
      if jsonb_typeof(v_assessment->'officialEvidence') is distinct from 'array'
        then raise exception 'INVALID_OFFICIAL_EVIDENCE'; end if;
      if jsonb_array_length(v_assessment->'officialEvidence')=0
        or (select count(distinct c) from jsonb_array_elements(v_assessment->'categories') c)<>jsonb_array_length(v_assessment->'categories')
        then raise exception 'INVALID_OFFICIAL_EVIDENCE'; end if;
      for v_evidence in select value from jsonb_array_elements(v_assessment->'officialEvidence') loop
        if jsonb_typeof(v_evidence) is distinct from 'object'
          or exists(select 1 from unnest(array['originalUrl','finalUrl','publisher','retrievedAt','content','contentHash','excerpt','rule','policyIdentity','field']) k
            where jsonb_typeof(v_evidence->k) is distinct from 'string' or length(btrim(v_evidence->>k))=0)
          then raise exception 'INVALID_OFFICIAL_EVIDENCE'; end if;
        -- 해시는 원본 HTML이 아니라 캡처한 문맥 포함 평문의 UTF-8 바이트에 대응한다.
        if v_evidence->>'originalUrl' !~ '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$'
          or v_evidence->>'finalUrl' !~ '^https?://[^[:space:]/?#@]+([/?#][^[:space:]]*)?$'
          or v_evidence->>'field' not in ('target_text','benefit_text','criteria_text')
          or v_evidence->>'retrievedAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$'
          or v_evidence->>'contentHash' is distinct from encode(sha256(convert_to(v_evidence->>'content','UTF8')),'hex')
          or position(v_evidence->>'excerpt' in v_evidence->>'content')=0
          then raise exception 'INVALID_OFFICIAL_EVIDENCE'; end if;
        begin
          v_retrieved:=(v_evidence->>'retrievedAt')::timestamptz;
          if not isfinite(v_retrieved) then raise exception 'INVALID_OFFICIAL_EVIDENCE'; end if;
        exception when invalid_datetime_format or datetime_field_overflow then
          raise exception 'INVALID_OFFICIAL_EVIDENCE';
        end;
      end loop;
    end if;
    -- 원문과 최초 선행 평가까지 같은 재시도만 부수 효과 없이 반환한다.
    if v_policy.relevance = v_assessment then
      return jsonb_build_object('sourceId',v_policy.source_id,'status',v_assessment->>'status','replayed',true);
    end if;
    if v_assessment->>'version'='policy-relevance-review-4' then
      if v_policy.relevance->>'version'='policy-relevance-review-4'
        then raise exception 'RELEVANCE_VERSION_CONFLICT'; end if;
      if v_policy.catalog_status<>'REVIEW'
        or coalesce(v_policy.relevance->>'version','') not in ('policy-relevance-review-2','policy-relevance-review-3')
        or v_policy.relevance->>'status' is distinct from 'REVIEW'
        then raise exception 'STALE_REVIEW_DECISION'; end if;
    end if;
    if (v_assessment->>'version'='policy-relevance-review-3' and
        (v_policy.catalog_status<>'EXCLUDED' or v_policy.relevance->>'version' is distinct from 'policy-relevance-review-2'))
      or (v_assessment->>'version'<>'policy-relevance-review-3' and v_policy.catalog_status<>'REVIEW')
      or coalesce(v_policy.relevance,'null'::jsonb) is distinct from p_payload->'previousRelevance'
      then raise exception 'STALE_REVIEW_DECISION'; end if;
  elsif v_policy.relevance->>'version' in ('policy-relevance-review-1','policy-relevance-review-2','policy-relevance-review-3','policy-relevance-review-4') then
    -- 자동 분류는 같은 원문의 재검토를 덮어쓰지 않는다. 원문 변경 시에는 기존 트리거가 평가를 무효화한다.
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
