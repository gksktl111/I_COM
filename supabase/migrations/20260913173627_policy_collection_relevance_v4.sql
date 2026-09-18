-- 신규 수집도 여섯 태그 직접 근거와 검토 보류 계약을 사용한다.
alter table public.policy_sync_items
  add column if not exists scope_normalized jsonb;

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
    or coalesce(v_assessment->>'version','') not in ('policy-relevance-1','policy-relevance-2','policy-relevance-3','policy-relevance-4','policy-relevance-review-1','policy-relevance-review-2','policy-relevance-review-3','policy-relevance-review-4','policy-relevance-review-5','policy-relevance-review-6')
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
  if v_policy.relevance->>'version'='policy-relevance-4'
    and v_assessment->>'version' in ('policy-relevance-1','policy-relevance-2','policy-relevance-3')
    then return jsonb_build_object('sourceId',v_policy.source_id,'status',v_policy.relevance->>'status','preservedNewer',true); end if;
  if v_policy.relevance->>'version'='policy-relevance-4'
    and v_assessment->>'version' in ('policy-relevance-review-1','policy-relevance-review-2','policy-relevance-review-3','policy-relevance-review-4','policy-relevance-review-5')
    then raise exception 'STALE_REVIEW_DECISION'; end if;
  if v_policy.relevance->>'version'='policy-relevance-review-6'
    and v_assessment->>'version' in ('policy-relevance-review-1','policy-relevance-review-2','policy-relevance-review-3','policy-relevance-review-4','policy-relevance-review-5')
    then raise exception 'STALE_REVIEW_DECISION'; end if;
  if v_policy.relevance->>'version'='policy-relevance-review-5'
    and v_assessment->>'version' in ('policy-relevance-review-1','policy-relevance-review-2','policy-relevance-review-3','policy-relevance-review-4')
    then raise exception 'STALE_REVIEW_DECISION'; end if;
  if v_policy.relevance->>'version'='policy-relevance-review-4'
    and v_assessment->>'version' in ('policy-relevance-review-1','policy-relevance-review-2','policy-relevance-review-3')
    then raise exception 'STALE_REVIEW_DECISION'; end if;
  if v_assessment->>'version'='policy-relevance-4' then
    if jsonb_typeof(v_assessment->'conditionChecks') is distinct from 'array'
      or exists(select 1 from jsonb_array_elements(v_assessment->'conditionChecks') c
        where jsonb_typeof(c) is distinct from 'string' or length(btrim(c#>>'{}'))=0)
      or jsonb_array_length(v_assessment->'categories')>6
      or (select count(distinct c) from jsonb_array_elements(v_assessment->'categories') c)<>jsonb_array_length(v_assessment->'categories')
      or exists(select 1 from jsonb_array_elements(v_assessment->'categories') c
        where c#>>'{}' not in ('임신·출산','양육·보육','돌봄','의료·건강','아동 교육','주거·생활지원'))
      or (v_assessment->>'status' in ('UNRELATED','REVIEW') and jsonb_array_length(v_assessment->'categories')<>0)
      or exists(select 1 from jsonb_array_elements(v_assessment->'evidence') e
        where e->>'field' not in ('name','target_text','benefit_text','criteria_text')
          or length(btrim(e->>'excerpt'))=0 or length(btrim(e->>'rule'))=0
          or e->>'excerpt' is distinct from btrim(coalesce(v_policy.normalized#>>array['display',e->>'field'],'')))
      or (v_assessment->>'status'='RELATED' and (
        not exists(select 1 from jsonb_array_elements(v_assessment->'evidence') e where e->>'field'='target_text')
        or not exists(select 1 from jsonb_array_elements(v_assessment->'evidence') e where e->>'field'='benefit_text')))
      or (v_assessment->>'status'='UNRELATED' and (
        not exists(select 1 from jsonb_array_elements(v_assessment->'evidence') e where e->>'field'='target_text')
        or not exists(select 1 from jsonb_array_elements(v_assessment->'evidence') e where e->>'field'='benefit_text')))
      or (v_assessment->>'status'='REVIEW' and jsonb_array_length(v_assessment->'evidence')<>0)
      then raise exception 'INVALID_COLLECTION_RELEVANCE'; end if;
  end if;
  if v_assessment->>'version' in ('policy-relevance-review-1','policy-relevance-review-2','policy-relevance-review-3','policy-relevance-review-4','policy-relevance-review-5','policy-relevance-review-6') then
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
        where (v_assessment->>'version' not in ('policy-relevance-review-5','policy-relevance-review-6') and c#>>'{}' not in ('임신·출산','양육·보육','아동 돌봄','아동 의료·건강','아동 교육','가족 지원','신혼·자녀가구 주거'))
          or (v_assessment->>'version' in ('policy-relevance-review-5','policy-relevance-review-6') and c#>>'{}' not in ('임신·출산','양육·보육','돌봄','의료·건강','아동 교육','주거·생활지원')))
      or exists(select 1 from jsonb_array_elements(v_assessment->'evidence') e
        where (v_assessment->>'version'='policy-relevance-review-1' and e->>'field' not in ('name','target_text','benefit_text'))
        or e->>'field' not in ('name','target_text','benefit_text','criteria_text','summary','purpose_text')
        or length(btrim(e->>'excerpt'))=0 or length(btrim(e->>'rule'))=0
        or position(e->>'excerpt' in coalesce(v_policy.normalized#>>array['display',e->>'field'],''))=0)
      then raise exception 'INVALID_REVIEW_EVIDENCE'; end if;
    if v_assessment->>'version' in ('policy-relevance-review-5','policy-relevance-review-6') then
      if (v_assessment->>'version'='policy-relevance-review-5' and v_assessment->>'status' not in ('RELATED','REVIEW'))
        or jsonb_typeof(v_assessment->'previousRelevance') is distinct from 'object'
        or v_assessment->'previousRelevance' is distinct from p_payload->'previousRelevance'
        or v_assessment#>>'{previousRelevance,status}' is distinct from 'REVIEW'
        or (coalesce(v_assessment#>>'{previousRelevance,version}','') not in ('policy-relevance-1','policy-relevance-2','policy-relevance-3','policy-relevance-review-1','policy-relevance-review-2','policy-relevance-review-3','policy-relevance-review-4')
          and not (v_assessment->>'version'='policy-relevance-review-6' and coalesce(v_assessment#>>'{previousRelevance,version}','') in ('policy-relevance-4','policy-relevance-review-5')))
        or jsonb_typeof(v_assessment->'conditionChecks') is distinct from 'array'
        then raise exception 'INVALID_TAG_REVIEW'; end if;
      if exists(select 1 from jsonb_array_elements(v_assessment->'conditionChecks') c
          where jsonb_typeof(c) is distinct from 'string' or length(btrim(c#>>'{}'))=0)
        or jsonb_array_length(v_assessment->'categories')>6
        or (select count(distinct c) from jsonb_array_elements(v_assessment->'categories') c)<>jsonb_array_length(v_assessment->'categories')
        or (v_assessment->>'status'='RELATED' and (
          not exists(select 1 from jsonb_array_elements(v_assessment->'evidence') e where e->>'field'='target_text')
          or not exists(select 1 from jsonb_array_elements(v_assessment->'evidence') e where e->>'field'='benefit_text')))
        then raise exception 'INVALID_TAG_REVIEW'; end if;
      if v_assessment->>'version'='policy-relevance-review-6' and v_assessment->>'status'='UNRELATED'
        and not exists(select 1 from jsonb_array_elements(v_assessment->'evidence') e where e->>'field' in ('target_text','benefit_text','criteria_text'))
        then raise exception 'INVALID_TAG_REVIEW'; end if;
    end if;
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
    if v_assessment->>'version'='policy-relevance-review-6' and v_policy.relevance->>'version'='policy-relevance-review-6'
      then raise exception 'RELEVANCE_VERSION_CONFLICT'; end if;
    if v_assessment->>'version'='policy-relevance-review-5' and v_policy.relevance->>'version'='policy-relevance-review-5'
      then raise exception 'RELEVANCE_VERSION_CONFLICT'; end if;
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
  elsif v_policy.relevance->>'version' in ('policy-relevance-review-1','policy-relevance-review-2','policy-relevance-review-3','policy-relevance-review-4','policy-relevance-review-5','policy-relevance-review-6') then
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
  -- 기존 heartbeat가 출처별 활성 lease와 실행 세대를 잠그고 검증한다.
  perform public.policy_sync_command_v4('heartbeat',p_payload);
  if coalesce(v_phase,'') not in ('LIST','DETAIL')
    or coalesce(v_relevance->>'version','') not in ('policy-relevance-1','policy-relevance-2','policy-relevance-3','policy-relevance-4')
    or coalesce(v_relevance->>'status','')<>'UNRELATED'
    or coalesce(jsonb_typeof(v_relevance->'categories'),'null')<>'array'
    or coalesce(jsonb_typeof(v_relevance->'evidence'),'null')<>'array'
    or coalesce(jsonb_typeof(v_relevance->'reason'),'null')<>'string'
    or length(coalesce(v_relevance->>'reason',''))=0 then raise exception 'INVALID_SCOPE_EXCLUSION'; end if;
  if jsonb_array_length(v_relevance->'categories')<>0 or jsonb_array_length(v_relevance->'evidence')=0
    or exists(select 1 from jsonb_array_elements(v_relevance->'evidence') e where
      coalesce(jsonb_typeof(e->'field'),'null')<>'string' or coalesce(jsonb_typeof(e->'excerpt'),'null')<>'string'
      or coalesce(jsonb_typeof(e->'rule'),'null')<>'string') then raise exception 'INVALID_SCOPE_EXCLUSION'; end if;
  if v_relevance->>'version'='policy-relevance-4' and (
      v_phase<>'DETAIL'
      or jsonb_typeof(p_payload#>'{normalized,display}') is distinct from 'object'
      or jsonb_typeof(v_relevance->'conditionChecks') is distinct from 'array'
      or exists(select 1 from jsonb_array_elements(v_relevance->'conditionChecks') c
        where jsonb_typeof(c) is distinct from 'string' or length(btrim(c#>>'{}'))=0)
      or exists(select 1 from jsonb_array_elements(v_relevance->'evidence') e
        where e->>'field' not in ('target_text','benefit_text','criteria_text')
          or length(btrim(e->>'excerpt'))=0 or length(btrim(e->>'rule'))=0
          or e->>'excerpt' is distinct from btrim(coalesce(p_payload#>>array['normalized','display',e->>'field'],'')))
      or (
        not exists(select 1 from jsonb_array_elements(v_relevance->'evidence') e where e->>'field'='target_text')
        or not exists(select 1 from jsonb_array_elements(v_relevance->'evidence') e where e->>'field'='benefit_text'))
    ) then raise exception 'INVALID_SCOPE_EXCLUSION'; end if;
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
    scope_normalized=case when v_relevance->>'version'='policy-relevance-4' then p_payload->'normalized' else scope_normalized end,
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
