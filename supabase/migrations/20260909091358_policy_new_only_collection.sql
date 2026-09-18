-- Keep skipped items terminal for the existing resume protocol, with a distinct outcome.
alter table public.policy_sync_items add column skipped_existing boolean not null default false,
  add constraint policy_sync_items_skipped_existing_check
    check (not skipped_existing or (status='SUCCESS' and scope_relevance is null));

alter function public.policy_sync_command(text,jsonb) rename to policy_sync_command_v5;
create function public.policy_sync_command(p_action text,p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  v_run uuid:=(p_payload->>'runId')::uuid;
  v_provider text:=coalesce(p_payload->>'provider','GOV24');
  v_external text:=p_payload->>'externalId';
  v_item public.policy_sync_items%rowtype;
  v_result jsonb;
  v_counts jsonb;
begin
  if p_action='auto_start' and p_payload->'config' ? 'mode' then
    if jsonb_typeof(p_payload#>'{config,mode}') is distinct from 'string'
      or p_payload#>>'{config,mode}' not in ('new-only','refresh') then
      raise exception 'INVALID_AUTO_MODE';
    end if;
  end if;
  if p_action='auto_skip_existing' then
    -- Heartbeat holds the provider lease lock until this transaction completes.
    perform public.policy_sync_command_v5('heartbeat',p_payload);
    if not exists(select 1 from public.policy_auto_jobs j
      join public.policy_sync_runs r on r.id=j.run_id
      where j.run_id=v_run and r.provider=v_provider and r.collection_mode='automatic'
        and j.config->>'mode'='new-only') then raise exception 'NEW_ONLY_REQUIRED'; end if;
    select * into v_item from public.policy_sync_items
      where run_id=v_run and external_id=v_external for update;
    if not found then raise exception 'OUTSIDE_SCOPE'; end if;
    if not exists(select 1 from public.policy_auto_pages where run_id=v_run
      and page=(p_payload->>'page')::integer and payload->'ids' @> jsonb_build_array(v_external))
      then raise exception 'SKIP_PAGE_MISMATCH'; end if;
    if not exists(select 1 from public.policies p join public.policy_sources s on s.id=p.source_id
      where s.provider=v_provider and s.external_id=v_external) then raise exception 'EXISTING_POLICY_REQUIRED'; end if;
    if v_item.skipped_existing then return jsonb_build_object('status','SKIPPED_EXISTING'); end if;
    if v_item.status='SUCCESS' then raise exception 'ITEM_ALREADY_SUCCESS'; end if;
    update public.policy_sync_items set status='SUCCESS',skipped_existing=true,error_code=null,
      changes=jsonb_build_object('skippedExisting',true),
      attempt_history=attempt_history||jsonb_build_array(jsonb_build_object(
        'at',clock_timestamp(),'state','SKIPPED_EXISTING','page',p_payload->'page')),
      updated_at=clock_timestamp() where run_id=v_run and external_id=v_external;
    return jsonb_build_object('status','SKIPPED_EXISTING');
  end if;
  v_result:=public.policy_sync_command_v5(p_action,p_payload);
  if p_action in ('finish','auto_pause') then
    -- Recompute from durable outcomes, after the existing exclusion summary wrapper.
    select jsonb_build_object(
      'success',count(*) filter(where status='SUCCESS' and scope_relevance is null and not skipped_existing),
      'excluded',count(*) filter(where scope_relevance is not null),
      'skippedExisting',count(*) filter(where skipped_existing)) into v_counts
      from public.policy_sync_items where run_id=v_run;
    update public.policy_sync_runs set summary=summary||v_counts where id=v_run;
    v_result:=v_result||v_counts;
  end if;
  return v_result;
end $$;
revoke all on function public.policy_sync_command(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.policy_sync_command(text,jsonb) to service_role;
notify pgrst,'reload schema';
