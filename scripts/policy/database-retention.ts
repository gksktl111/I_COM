import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { env } from "node:process";
import { parseArgs } from "node:util";

type Plan = {
  projectRef: string;
  oldRunIds: string[];
  oldRunDigest: string;
  policyCounts: Record<string, number>;
  deleteCounts: Record<string, number>;
  snapshotCandidateDigest: string;
};

type Preflight = {
  databaseBytes: number;
  migrationReady: boolean;
  lockRefs: number;
  oldRunIds: string[];
  oldRunDigest: string;
  policyCounts: Record<string, number>;
  deleteCounts: Record<string, number>;
  snapshotCandidateDigest: string;
};

const PREFLIGHT_SQL = String.raw`
with auto_runs as (
  select r.id,r.provider,row_number() over(partition by provider order by started_at desc,id desc) rn
  from public.policy_sync_runs r where collection_mode='automatic'
), old_runs as (
  select id from auto_runs where rn>1
), snapshot_candidates as (
  select s.id from public.policy_source_snapshots s
  where not exists(select 1 from public.policies p where p.applied_snapshot_id=s.id)
    and not exists(select 1 from public.policy_label_observations o where o.snapshot_id=s.id)
    and not exists(select 1 from public.policy_relevance_observations o where o.snapshot_id=s.id)
    and not exists(select 1 from public.policy_sync_items i
      where i.run_id not in (select id from old_runs)
        and (i.snapshot_id=s.id or i.before_snapshot_id=s.id))
    and not exists(select 1 from public.policy_quality_observations o
      where o.run_id not in (select id from old_runs) and o.snapshot_id=s.id)
)
select jsonb_build_object(
  'databaseBytes',pg_database_size(current_database()),
  'migrationReady',exists(select 1 from supabase_migrations.schema_migrations where version='20260913173627'),
  'lockRefs',(select count(*)::integer from public.policy_sync_locks where owner in (select id from old_runs)),
  'oldRunIds',(select coalesce(jsonb_agg(id order by id),'[]'::jsonb) from old_runs),
  'oldRunDigest',(select encode(sha256(convert_to(coalesce(string_agg(id::text,',' order by id),''),'UTF8')),'hex') from old_runs),
  'policyCounts',(select jsonb_object_agg(catalog_status,n) from (
    select catalog_status,count(*)::integer n from public.policies group by catalog_status
  ) counts),
  'deleteCounts',jsonb_build_object(
    'runs',(select count(*)::integer from old_runs),
    'syncItems',(select count(*)::integer from public.policy_sync_items where run_id in (select id from old_runs)),
    'autoPages',(select count(*)::integer from public.policy_auto_pages where run_id in (select id from old_runs)),
    'qualityObservations',(select count(*)::integer from public.policy_quality_observations where run_id in (select id from old_runs)),
    'autoJobs',(select count(*)::integer from public.policy_auto_jobs where run_id in (select id from old_runs)),
    'snapshots',(select count(*)::integer from snapshot_candidates)
  ),
  'snapshotCandidateDigest',(select encode(sha256(convert_to(coalesce(string_agg(id::text,',' order by id),''),'UTF8')),'hex') from snapshot_candidates)
) as result`;

function projectRef(url: string): string {
  const match = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co(?:\/|$)/);
  if (!match) throw new Error("invalid-supabase-url");
  return match[1];
}

async function managementQuery(ref: string, token: string, query: string) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const body = await response.text();
  if (!response.ok) throw new Error(`management-api-${response.status}: ${body}`);
  return JSON.parse(body) as Array<{ result?: unknown }>;
}

function comparable(value: Preflight | Plan) {
  return {
    oldRunIds: value.oldRunIds,
    oldRunDigest: value.oldRunDigest,
    policyCounts: value.policyCounts,
    deleteCounts: value.deleteCounts,
    snapshotCandidateDigest: value.snapshotCandidateDigest,
  };
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}

async function main() {
  const { values } = parseArgs({
    options: {
      apply: { type: "boolean", default: false },
      "confirm-digest": { type: "string" },
      plan: {
        type: "string",
        default:
          "docs/fixtures/policy-retention/automatic-history-cleanup-20260918.json",
      },
    },
  });
  const url = env.SUPABASE_URL;
  const token = env.SUPABASE_ACCESS_TOKEN;
  if (!url || !token) throw new Error("supabase-management-env-required");
  const ref = projectRef(url);
  const plan = JSON.parse(
    await readFile(resolve(values.plan), "utf8"),
  ) as Plan;
  if (plan.projectRef !== ref) throw new Error("project-ref-mismatch");

  const rows = await managementQuery(ref, token, PREFLIGHT_SQL);
  const preflight = rows[0]?.result as Preflight | undefined;
  if (!preflight) throw new Error("preflight-result-missing");
  const matches =
    preflight.migrationReady &&
    preflight.lockRefs === 0 &&
    JSON.stringify(canonical(comparable(preflight))) ===
      JSON.stringify(canonical(comparable(plan)));
  console.log(JSON.stringify({ mode: "preflight", matches, preflight }, null, 2));
  if (!matches) throw new Error("cleanup-preflight-mismatch");
  if (!values.apply) return;
  if (values["confirm-digest"] !== plan.oldRunDigest)
    throw new Error("cleanup-digest-confirmation-required");

  const sql = await readFile(
    resolve("scripts/policy/database-retention-apply.sql"),
    "utf8",
  );
  const result = await managementQuery(ref, token, sql);
  console.log(JSON.stringify({ mode: "apply", result }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
