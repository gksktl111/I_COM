-- Apply the same catalogue separation to already collected policies.
-- Generated state follows reassessment and invalidation atomically; no independent
-- flag can accidentally leave an unrelated or unassessed record active.
alter table public.policies add column catalog_status text generated always as (
  case relevance->>'status'
    when 'RELATED' then 'ACTIVE'
    when 'UNRELATED' then 'EXCLUDED'
    else 'REVIEW'
  end
) stored;
create index policies_catalog_status_idx on public.policies(catalog_status,updated_at desc,source_id);

-- Server-only candidate source for subsequent search/recommendation integration.
-- ACTIVE means relevant candidate, never verified eligibility/publication approval.
create view public.policy_active_candidates with (security_invoker=true) as
  select source_id,applied_snapshot_id,normalized,updated_at,relevance,relevance_assessed_at,catalog_status
  from public.policies where catalog_status='ACTIVE';
revoke all on public.policy_active_candidates from public,anon,authenticated,service_role;
grant select on public.policy_active_candidates to service_role;
notify pgrst,'reload schema';
