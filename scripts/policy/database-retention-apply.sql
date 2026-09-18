begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
select pg_advisory_xact_lock(hashtextextended('I_COM policy automatic history cleanup', 0));

create temp table cleanup_old_runs(id uuid primary key) on commit drop;
insert into cleanup_old_runs(id) values
  ('10de6f39-f559-4881-96fb-1683817db36d'),
  ('547a59cf-f9b3-4d86-be97-318be3ef4455'),
  ('6cea7c91-158d-436a-85fc-950060c2aa52'),
  ('78f41e01-e944-459d-a025-d60ecd441b5a'),
  ('851043be-6342-4dff-b91b-f03424d9d266'),
  ('87f0678c-b4f1-4bb4-a9bf-2153cf37ba57'),
  ('8a75d68a-9a14-4ae0-ac8a-02568b5902fd'),
  ('8ef95422-a4d3-4474-ba3e-9cbd186899e3');

do $cleanup_preflight$
declare
  v_ids uuid[];
  v_digest text;
begin
  if not exists(select 1 from supabase_migrations.schema_migrations where version='20260913173627') then
    raise exception 'MIGRATION_NOT_READY';
  end if;
  select array_agg(id order by id),
    encode(sha256(convert_to(string_agg(id::text,',' order by id),'UTF8')),'hex')
    into v_ids,v_digest
    from (
      select id from (
        select r.id,row_number() over(partition by provider order by started_at desc,id desc) rn
        from public.policy_sync_runs r where collection_mode='automatic'
      ) ranked where rn>1
    ) old_runs;
  if v_ids is distinct from (select array_agg(id order by id) from cleanup_old_runs)
    or v_digest is distinct from 'c4d59ee728fb5ececc62e924f529eaebeada2953e2addc15acdfb7b2b365bda4' then
    raise exception 'OLD_RUN_SET_MISMATCH';
  end if;
  if exists(select 1 from public.policy_sync_locks where owner in (select id from cleanup_old_runs)) then
    raise exception 'OLD_RUN_STILL_LOCKED';
  end if;
  if (select count(*) from public.policy_sync_items where run_id in (select id from cleanup_old_runs))<>11440
    or (select count(*) from public.policy_auto_pages where run_id in (select id from cleanup_old_runs))<>237
    or (select count(*) from public.policy_quality_observations where run_id in (select id from cleanup_old_runs))<>6310
    or (select count(*) from public.policy_auto_jobs where run_id in (select id from cleanup_old_runs))<>8 then
    raise exception 'DEPENDENT_COUNT_MISMATCH';
  end if;
  if (select count(*) from public.policies where catalog_status='ACTIVE')<>4414
    or (select count(*) from public.policies where catalog_status='REVIEW')<>79
    or (select count(*) from public.policies where catalog_status='EXCLUDED')<>1402 then
    raise exception 'POLICY_COUNT_MISMATCH';
  end if;
end $cleanup_preflight$;

create temp table cleanup_snapshots(id uuid primary key) on commit drop;
insert into cleanup_snapshots(id)
select s.id from public.policy_source_snapshots s
where not exists(select 1 from public.policies p where p.applied_snapshot_id=s.id)
  and not exists(select 1 from public.policy_label_observations o where o.snapshot_id=s.id)
  and not exists(select 1 from public.policy_relevance_observations o where o.snapshot_id=s.id)
  and not exists(select 1 from public.policy_sync_items i
    where i.run_id not in (select id from cleanup_old_runs)
      and (i.snapshot_id=s.id or i.before_snapshot_id=s.id))
  and not exists(select 1 from public.policy_quality_observations o
    where o.run_id not in (select id from cleanup_old_runs) and o.snapshot_id=s.id);

do $snapshot_preflight$
begin
  if (select count(*) from cleanup_snapshots)<>1213
    or (select encode(sha256(convert_to(string_agg(id::text,',' order by id),'UTF8')),'hex') from cleanup_snapshots)
      is distinct from 'bb95e4243a214ce3fb47a80584aff82093a95d34bbaaf2a070d3dd9b0db065fb' then
    raise exception 'SNAPSHOT_SET_MISMATCH';
  end if;
end $snapshot_preflight$;

create temp table cleanup_result(name text primary key, deleted integer not null) on commit drop;
with removed as (delete from public.policy_auto_pages where run_id in (select id from cleanup_old_runs) returning 1)
insert into cleanup_result select 'autoPages',count(*)::integer from removed;
with removed as (delete from public.policy_quality_observations where run_id in (select id from cleanup_old_runs) returning 1)
insert into cleanup_result select 'qualityObservations',count(*)::integer from removed;
with removed as (delete from public.policy_sync_items where run_id in (select id from cleanup_old_runs) returning 1)
insert into cleanup_result select 'syncItems',count(*)::integer from removed;
with removed as (delete from public.policy_auto_jobs where run_id in (select id from cleanup_old_runs) returning 1)
insert into cleanup_result select 'autoJobs',count(*)::integer from removed;
with removed as (delete from public.policy_sync_runs where id in (select id from cleanup_old_runs) returning 1)
insert into cleanup_result select 'runs',count(*)::integer from removed;
with removed as (delete from public.policy_source_snapshots where id in (select id from cleanup_snapshots) returning 1)
insert into cleanup_result select 'snapshots',count(*)::integer from removed;

do $cleanup_verify$
begin
  if (select jsonb_object_agg(name,deleted) from cleanup_result)
    is distinct from '{"autoJobs":8,"autoPages":237,"qualityObservations":6310,"runs":8,"snapshots":1213,"syncItems":11440}'::jsonb then
    raise exception 'DELETE_RESULT_MISMATCH';
  end if;
  if (select count(*) from public.policy_sync_runs where collection_mode='automatic')<>3
    or (select count(distinct provider) from public.policy_sync_runs where collection_mode='automatic')<>3 then
    raise exception 'RETAINED_RUN_MISMATCH';
  end if;
  if (select count(*) from public.policies where catalog_status='ACTIVE')<>4414
    or (select count(*) from public.policies where catalog_status='REVIEW')<>79
    or (select count(*) from public.policies where catalog_status='EXCLUDED')<>1402 then
    raise exception 'POLICY_COUNT_CHANGED';
  end if;
end $cleanup_verify$;

select jsonb_build_object(
  'deleted',(select jsonb_object_agg(name,deleted) from cleanup_result),
  'remainingAutomaticRuns',(select count(*)::integer from public.policy_sync_runs where collection_mode='automatic'),
  'policyCounts',(select jsonb_object_agg(catalog_status,n) from (
    select catalog_status,count(*)::integer n from public.policies group by catalog_status
  ) counts)
) as result;
commit;
