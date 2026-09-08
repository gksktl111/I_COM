-- Retain exclusion evidence without adding unrelated new policies to the catalogue.
alter table public.policy_sync_items add column scope_relevance jsonb,
  add column scope_phase text check (scope_phase in ('LIST','DETAIL'));
create index policy_items_scope_excluded_idx on public.policy_sync_items(updated_at desc,run_id,external_id)
  where scope_relevance is not null;

create function public.policy_scope_exclude(p_payload jsonb) returns jsonb
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
    or coalesce(v_relevance->>'version','')<>'policy-relevance-1'
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

alter function public.policy_sync_command(text,jsonb) rename to policy_sync_command_v4;
create function public.policy_sync_command(p_action text,p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_result jsonb; v_summary jsonb; v_excluded integer;
begin
  if p_action='auto_exclude' then return public.policy_scope_exclude(p_payload); end if;
  -- The common repository also applies the gate to selected/manual collectors.
  if p_action='apply' and p_payload#>>'{relevance,status}'='UNRELATED'
    and not exists(select 1 from public.policies p join public.policy_sources s on s.id=p.source_id
      where s.provider=coalesce(p_payload->>'provider','GOV24') and s.external_id=p_payload->>'externalId') then
    return public.policy_scope_exclude(p_payload||jsonb_build_object('phase','DETAIL'));
  end if;
  v_result:=public.policy_sync_command_v4(p_action,p_payload);
  if p_action in ('finish','auto_pause') then
    select count(*)::integer into v_excluded from public.policy_sync_items
      where run_id=(p_payload->>'runId')::uuid and scope_relevance is not null;
    select summary into v_summary from public.policy_sync_runs where id=(p_payload->>'runId')::uuid;
    v_summary:=v_summary||jsonb_build_object('excluded',v_excluded,
      'success',greatest(0,coalesce((v_summary->>'success')::integer,0)-v_excluded));
    update public.policy_sync_runs set summary=v_summary where id=(p_payload->>'runId')::uuid;
    v_result:=v_result||jsonb_build_object('excluded',v_excluded);
    if v_result ? 'success' then v_result:=jsonb_set(v_result,'{success}',v_summary->'success'); end if;
  end if;
  return v_result;
end $$;
revoke all on function public.policy_sync_command(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.policy_sync_command(text,jsonb) to service_role;

alter function public.policy_admin_report(text,jsonb) rename to policy_admin_report_v2;
create function public.policy_admin_report(p_action text,p_filters jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare v_limit integer:=least(100,greatest(1,coalesce((p_filters->>'limit')::integer,30)));
begin
  if p_action='exclusions' then
    return jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(x)) from (
      select i.run_id,i.external_id,r.provider,i.scope_relevance,i.scope_phase,i.updated_at
      from public.policy_sync_items i join public.policy_sync_runs r on r.id=i.run_id
      where i.scope_relevance is not null order by i.updated_at desc,i.run_id,i.external_id limit v_limit
    ) x),'[]'::jsonb));
  end if;
  return public.policy_admin_report_v2(p_action,p_filters);
end $$;
revoke all on function public.policy_admin_report(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.policy_admin_report(text,jsonb) to service_role;
notify pgrst,'reload schema';
