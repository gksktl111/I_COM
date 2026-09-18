import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { normalizeBokji } from "./bokjiro.ts";
import type { BokjiRaw } from "./bokjiro.ts";
import { evaluatePolicyQuality, failureQuality } from "./quality.ts";
import { evaluatePolicyRelevance } from "./relevance.ts";
import { evaluateCollectionRelevance } from "./collection-relevance.ts";

let db: PGlite;
const provider = "BOKJIRO_CENTRAL";
type Lease = { runId: string; generation: number; status: string };
const newTables = [
  "policy_relevance_observations",
  "policy_auto_jobs",
  "policy_auto_pages",
  "policy_api_daily_usage",
  "policy_quality_observations",
];
const tables = [
  ...newTables,
  "policy_sources",
  "policy_source_snapshots",
  "policies",
  "policy_sync_runs",
  "policy_sync_items",
  "policy_sync_locks",
];
const config = {
  filters: { searchWrd: "양육" },
  perPage: 2,
  maxPages: 20,
  dailyLimit: 20,
};
async function command<T = Record<string, unknown>>(
  action: string,
  payload: object,
): Promise<T> {
  const result = await db.query<{ value: T }>(
    "select public.policy_sync_command($1,$2::jsonb) as value",
    [action, JSON.stringify({ provider, ...payload })],
  );
  return result.rows[0].value;
}
async function admin(sql: string) {
  await db.exec("reset role");
  try {
    await db.exec(sql);
  } finally {
    await db.exec("set role service_role");
  }
}
const start = (extra: object = {}) =>
  command<Lease>("auto_start", { runId: randomUUID(), config, ...extra });
function page(number: number, ids: string[], total: number) {
  return {
    page: number,
    ids,
    total,
    sourceTotal: total,
    rows: ids.map((servId) => ({ servId, servNm: "정책" })),
    evidence: [] as unknown[],
    capturedAt: "2026-09-08T00:00:00Z",
  };
}
const save = (lease: Lease, value: ReturnType<typeof page>) =>
  command("auto_page", { ...lease, page: value });
const state = (lease: Lease) =>
  command<{
    run: { status: string; calls: number; scope: unknown[] };
    job: {
      next_page: number;
      discovered: number;
      discovery_complete: boolean;
      stop_reason: string | null;
    };
    page: ReturnType<typeof page> | null;
    pendingIds: string[];
  }>("auto_state", lease);
async function dump(names = tables) {
  return Promise.all(
    names.map(
      async (name) =>
        (
          await db.query(
            `select to_jsonb(t) as row from public.${name} t order by to_jsonb(t)::text`,
          )
        ).rows,
    ),
  );
}
function raw(externalId: string, name = "양육 지원"): BokjiRaw {
  return {
    provider,
    apiVersion: "v1",
    externalId,
    list: {
      servId: externalId,
      servNm: name,
      servDgst: "정책 요약",
      servDtlLink: `https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do?wlfareInfoId=${externalId}&wlfareInfoReldBztpCd=01`,
    },
    detail: [
      {
        servId: externalId,
        servNm: name,
        tgtrDtlCn: "지원 대상",
        alwServCn: "매월 10만원",
        jurMnofNm: "기관",
      },
    ],
    xml: { list: "<fixture/>", detail: "<fixture/>" },
    evidence: [],
  };
}
async function staged(lease: Lease, externalId = "a", name = "양육 지원") {
  const bundle = raw(externalId, name),
    normalized = normalizeBokji(bundle);
  const { snapshotId } = await command<{ snapshotId: string }>("snapshot", {
    ...lease,
    externalId,
    raw: bundle,
    rawHash: normalized.rawHash,
    hashVersion: normalized.hashVersion,
    evidence: [],
  });
  return {
    ...lease,
    externalId,
    snapshotId,
    normalized,
    quality: evaluatePolicyQuality(bundle, normalized),
    changes: { displayChanged: true },
  };
}
const current = (externalId = "a") =>
  command<{ snapshotId: string; normalized: unknown } | null>("current", {
    externalId,
  });

const newOnlyConfig = { ...config, mode: "new-only" };
async function seedExistingPolicy() {
  const lease = await start();
  await save(lease, page(1, ["a"], 1));
  const payload = await staged(lease);
  await command("apply", {
    ...payload,
    relevance: evaluatePolicyRelevance(payload.normalized.display),
  });
  await save(lease, page(2, [], 1));
  await command("finish", { ...lease, calls: 0 });
}

test("new-only skip survives pause and resume without changing stored policy or observations", async () => {
  await seedExistingPolicy();
  const stored = ["policy_sources", "policy_source_snapshots", "policies",
    "policy_quality_observations", "policy_relevance_observations"];
  const before = await dump(stored);
  const lease = await start({ config: newOnlyConfig });
  await save(lease, page(1, ["a", "b"], 2));
  const skip = { ...lease, externalId: "a", page: 1 };
  assert.equal((await command("auto_skip_existing", skip)).status, "SKIPPED_EXISTING");
  assert.equal((await command("auto_skip_existing", skip)).status, "SKIPPED_EXISTING");
  assert.deepEqual(await dump(stored), before);
  const paused = await command("auto_pause", { ...lease, reason: "ITEM_LIMIT" });
  assert.equal(paused.success, 0);
  assert.equal(paused.excluded, 0);
  assert.equal(paused.skippedExisting, 1);
  assert.equal(paused.pending, 1);
  const resumed = await start({ config: newOnlyConfig, resumeRunId: lease.runId });
  assert.deepEqual((await state(resumed)).pendingIds, ["b"]);
  const item = (await db.query<{ attempts: number; attempt_history: unknown[] }>(
    "select attempts,attempt_history from policy_sync_items where run_id=$1 and external_id='a'",
    [lease.runId],
  )).rows[0];
  assert.equal(item.attempts, 0);
  assert.equal(item.attempt_history.length, 1);
  await assert.rejects(command("snapshot", { ...resumed, externalId: "a" }), /ITEM_ALREADY_SUCCESS/);
});

test("new-only completion separates skips, exclusions and applied policies in return and report", async () => {
  await seedExistingPolicy();
  const lease = await start({ config: { ...newOnlyConfig, perPage: 3 } });
  await save(lease, page(1, ["a", "b", "c"], 3));
  await command("auto_skip_existing", { ...lease, externalId: "a", page: 1 });
  await command("auto_exclude", {
    ...lease, externalId: "b", page: 1, phase: "LIST",
    relevance: evaluatePolicyRelevance({ name: "어업경영자금 지원" }),
  });
  const payload = await staged(lease, "c");
  await command("apply", { ...payload, relevance: evaluatePolicyRelevance(payload.normalized.display) });
  await save(lease, page(2, [], 3));
  const finished = await command("finish", { ...lease, calls: 0 });
  assert.equal(finished.status, "SUCCESS");
  assert.equal(finished.success, 1);
  assert.equal(finished.excluded, 1);
  assert.equal(finished.skippedExisting, 1);
  const report = (await db.query<{ value: { items: Array<{ summary: Record<string, unknown> }> } }>(
    "select public.policy_admin_report('runs',$1::jsonb) as value", [JSON.stringify({ runId: lease.runId })],
  )).rows[0].value.items[0].summary;
  for (const key of ["success", "excluded", "skippedExisting", "failed", "pending"])
    assert.equal(report[key], finished[key]);
});

test("all-existing new-only run completes successfully with zero collected policies", async () => {
  await seedExistingPolicy();
  const lease = await start({ config: newOnlyConfig });
  await save(lease, page(1, ["a"], 1));
  await command("auto_skip_existing", { ...lease, externalId: "a", page: 1 });
  await save(lease, page(2, [], 1));
  const result = await command("finish", { ...lease, calls: 0 });
  assert.equal(result.status, "SUCCESS");
  assert.equal(result.success, 0);
  assert.equal(result.excluded, 0);
  assert.equal(result.skippedExisting, 1);
});

test("skip requires a current policy in the same provider, saved page and active lease", async () => {
  await seedExistingPolicy();
  const lease = await start({ config: newOnlyConfig });
  await save(lease, page(1, ["a", "b"], 2));
  const skip = { ...lease, externalId: "a", page: 1 };
  await assert.rejects(command("auto_skip_existing", { ...skip, page: 2 }), /SKIP_PAGE_MISMATCH/);
  await assert.rejects(command("auto_skip_existing", { ...skip, generation: lease.generation + 1 }), /STALE_LEASE/);
  await assert.rejects(command("auto_skip_existing", { ...skip, externalId: "outside" }), /OUTSIDE_SCOPE/);
  // An unapplied source snapshot is not a saved current policy.
  await staged(lease, "b");
  await assert.rejects(command("auto_skip_existing", { ...skip, externalId: "b" }), /EXISTING_POLICY_REQUIRED/);
  const other = await start({ provider: "BOKJIRO_LOCAL", config: newOnlyConfig });
  await command("auto_page", { ...other, provider: "BOKJIRO_LOCAL", page: page(1, ["a"], 1) });
  await assert.rejects(command("auto_skip_existing", {
    ...other, provider: "BOKJIRO_LOCAL", externalId: "a", page: 1,
  }), /EXISTING_POLICY_REQUIRED/);
  await admin("update policy_sync_locks set expires_at=clock_timestamp()-interval '1 second' where name='BOKJIRO_CENTRAL'");
  await assert.rejects(command("auto_skip_existing", skip), /STALE_LEASE/);
});

test("direct RPC validates collection mode and prevents skips in legacy or explicit refresh runs", async () => {
  for (const mode of [null, false, 0, "NEW_ONLY", "", {}])
    await assert.rejects(start({ config: { ...config, mode } }), /INVALID_AUTO_MODE/);
  await seedExistingPolicy();
  for (const refreshConfig of [config, { ...config, mode: "refresh" }]) {
    const lease = await start({ config: refreshConfig });
    await save(lease, page(1, ["a"], 1));
    await assert.rejects(command("auto_skip_existing", { ...lease, externalId: "a", page: 1 }), /NEW_ONLY_REQUIRED/);
    await command("auto_pause", { ...lease, reason: "CALL_BUDGET" });
    await assert.rejects(start({ config: newOnlyConfig, resumeRunId: lease.runId }), /AUTO_SCOPE_CHANGED/);
    const resumed = await start({ config: refreshConfig, resumeRunId: lease.runId });
    assert.deepEqual((await state(resumed)).pendingIds, ["a"]);
    await command("auto_pause", { ...resumed, reason: "CALL_BUDGET" });
  }
});

test("automatic RPCs remain invoker functions restricted to service role", async () => {
  const functions = (await db.query<{
    name: string;
    prosecdef: boolean;
    proconfig: string[];
    anon_execute: boolean;
    authenticated_execute: boolean;
    service_execute: boolean;
  }>(`
    select p.oid::regprocedure::text as name,p.prosecdef,p.proconfig,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
      has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
    from pg_proc p
    where p.oid in (
      'public.policy_sync_command(text,jsonb)'::regprocedure,
      'public.policy_store_relevance(jsonb)'::regprocedure,
      'public.policy_scope_exclude(jsonb)'::regprocedure
    )
  `)).rows;
  assert.equal(functions.length, 3);
  for (const fn of functions) {
    assert.equal(fn.prosecdef, false, fn.name);
    assert.ok(fn.proconfig.includes("search_path=pg_catalog, public"), fn.name);
    assert.equal(fn.anon_execute, false, fn.name);
    assert.equal(fn.authenticated_execute, false, fn.name);
    assert.equal(fn.service_execute, true, fn.name);
  }
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`reset role; set role ${role}`);
    await assert.rejects(db.query("select public.policy_sync_command('auto_skip_existing','{}')"), /permission denied/);
  }
  await db.exec("reset role; set role service_role");
});

test("automatic discovery persists 1001 policies across pages without the sample ID limit", async () => {
  const lease = await start({ config: { ...config, perPage: 100 } });
  for (let number = 1; number <= 11; number++) {
    const count = number === 11 ? 1 : 100;
    const ids = Array.from(
      { length: count },
      (_, i) => `WLF${(number - 1) * 100 + i}`,
    );
    await save(lease, page(number, ids, 1001));
  }
  await save(lease, page(12, [], 1001));
  const value = await state(lease);
  assert.equal(value.job.discovered, 1001);
  assert.equal(value.job.discovery_complete, true);
  const counts = await db.query<{ count: number }>(
    "select count(*)::integer as count from public.policy_sync_items where run_id=$1",
    [lease.runId],
  );
  assert.equal(counts.rows[0].count, 1001);
  // Discovery is complete, but none of the 1001 policies have been processed yet.
  await assert.rejects(
    command("finish", { ...lease, calls: 0 }),
    /INCOMPLETE_DISCOVERY/,
  );
});

before(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated, service_role;",
  );
  for (const migration of [
    "20260907181933_policy_ingestion",
    "20260907192856_policy_multiple_providers",
    "20260908053334_policy_automatic_quality",
    "20260908073708_policy_relevance",
    "20260908075211_policy_scope_exclusion",
    "20260908080358_policy_catalog_disposition",
    "20260908082550_policy_relevance_v2",
    "20260908091150_policy_relevance_v3",
    "20260909091358_policy_new_only_collection",
    "20260911141935_policy_review_activation",
    "20260911145539_policy_review_disposition",
    "20260911150947_policy_review_pending_notes",
    "20260911152220_policy_review_correction",
    "20260913142106_policy_official_reassessment",
    "20260913152820_policy_six_tag_activation",
    "20260913162532_policy_six_tag_disposition",
    "20260913173627_policy_collection_relevance_v4",
  ]) {
    await db.exec(
      await readFile(
        new URL(
          `../../../../supabase/migrations/${migration}.sql`,
          import.meta.url,
        ),
        "utf8",
      ),
    );
  }
});
beforeEach(async () => {
  await admin(
    `truncate ${tables.map((t) => `public.${t}`).join(",")}; insert into public.policy_sync_locks(name) values ('GOV24'),('BOKJIRO_CENTRAL'),('BOKJIRO_LOCAL');`,
  );
});
after(async () => {
  await db?.close();
});

test("automatic discovery supports more than ten IDs and requires a terminal empty page plus completed items", async () => {
  const lease = await start({ config: { ...config, perPage: 12 } });
  const ids = Array.from({ length: 12 }, (_, i) => `id-${i}`);
  await save(lease, page(1, ids, 12));
  let saved = await state(lease);
  assert.equal(saved.job.discovered, 12);
  const scope = await db.query<{ count: number }>(
    "select jsonb_array_length(scope) as count from public.policy_sync_runs where id=$1",
    [lease.runId],
  );
  assert.equal(scope.rows[0].count, 12);
  assert.deepEqual(saved.pendingIds, ids);
  await assert.rejects(
    command("finish", { ...lease, calls: 0 }),
    /INCOMPLETE_DISCOVERY/,
  );
  await save(lease, page(2, [], 12));
  saved = await state(lease);
  assert.equal(saved.job.discovery_complete, true);
  await assert.rejects(
    command("finish", { ...lease, calls: 0 }),
    /INCOMPLETE_DISCOVERY/,
  );
  for (const externalId of ids)
    await command("fail", {
      ...lease,
      externalId,
      errorCode: "COLLECTION_FAILED",
      quality: failureQuality("COLLECTION_FAILED"),
    });
  await assert.rejects(
    command("finish", { ...lease, calls: 1 }),
    /CALLS_ALREADY_RESERVED/,
  );
  assert.equal(
    (await command("finish", { ...lease, calls: 0 })).status,
    "FAILED",
  );
  assert.equal((await state(lease)).pendingIds.length, 12);
  const empty = await start();
  await save(empty, page(1, [], 0));
  assert.equal(
    (await command("finish", { ...empty, calls: 0 })).status,
    "SUCCESS",
  );
  await assert.rejects(
    start({ resumeRunId: empty.runId }),
    /INVALID_AUTO_RESUME/,
  );
});

test("page duplicates, ID mismatch and total drift roll back checkpoint and scope", async () => {
  const lease = await start();
  await save(lease, page(1, ["a", "b"], 4));
  const before = await dump();
  for (const [value, error] of [
    [page(2, ["a", "c"], 4), /DUPLICATE_DISCOVERY_ID/],
    [page(2, ["c", "c"], 4), /INVALID_PAGE/],
    [page(2, ["c", "d"], 5), /SOURCE_DRIFT/],
    [{ ...page(2, ["c", "d"], 4), sourceTotal: 5 }, /SOURCE_DRIFT/],
    [
      {
        ...page(2, ["c", "d"], 4),
        rows: [{ servId: "wrong" }, { servId: "d" }],
      },
      /INVALID_PAGE/,
    ],
    [page(2, [], 4), /INVALID_PAGE/],
  ] as const) {
    await assert.rejects(
      command("auto_page", { ...lease, page: value }),
      error,
    );
    assert.deepEqual(await dump(), before);
  }
  await save(lease, page(2, ["c", "d"], 4));
  assert.equal((await state(lease)).job.next_page, 3);
});

test("refresh preserves checkpoint IDs; resume retains success and fences the old lease", async () => {
  const lease = await start();
  await save(lease, page(1, ["a", "b"], 2));
  await command("apply", await staged(lease));
  await command("fail", {
    ...lease,
    externalId: "b",
    errorCode: "COLLECTION_FAILED",
    quality: failureQuality("COLLECTION_FAILED"),
  });
  const pause = await command("auto_pause", {
    ...lease,
    reason: "UPSTREAM_ERROR",
  });
  assert.equal(pause.status, "PAUSED");
  assert.equal((await state(lease)).run.status, "PARTIAL");
  await assert.rejects(command("auto_reserve", lease), /STALE_LEASE/);
  await assert.rejects(
    start({ resumeRunId: lease.runId, config: { ...config, filters: {} } }),
    /AUTO_SCOPE_CHANGED/,
  );
  const resumed = await start({ resumeRunId: lease.runId });
  assert.equal(resumed.runId, lease.runId);
  assert.ok(resumed.generation > lease.generation);
  assert.deepEqual((await state(resumed)).pendingIds, ["b"]);
  assert.equal((await state(resumed)).job.stop_reason, null);
  const refreshed = {
    ...page(1, ["a", "b"], 2),
    capturedAt: "2026-09-08T01:00:00Z",
    rows: [
      { servId: "a", servNm: "갱신" },
      { servId: "b", servNm: "갱신" },
    ],
  };
  await command("auto_refresh", { ...resumed, page: refreshed });
  assert.deepEqual((await state(resumed)).page, refreshed);
  assert.equal((await state(resumed)).job.discovered, 2);
  const before = await dump();
  await assert.rejects(
    command("auto_refresh", { ...resumed, page: page(1, ["b", "a"], 2) }),
    /SOURCE_DRIFT/,
  );
  assert.deepEqual(await dump(), before);
  await assert.rejects(
    command("auto_refresh", { ...lease, page: refreshed }),
    /STALE_LEASE/,
  );
  await command("apply", await staged(resumed, "b"));
  await save(resumed, page(2, [], 2));
  assert.equal(
    (await command("finish", { ...resumed, calls: 0 })).status,
    "SUCCESS",
  );
});

test("configuration, provider isolation, contention and expired generations reject unsafe writers", async () => {
  for (const invalid of [
    { ...config, filters: [] },
    { ...config, perPage: 0 },
    { ...config, maxPages: 1001 },
    { ...config, dailyLimit: 0 },
  ])
    await assert.rejects(start({ config: invalid }), /INVALID_AUTO_CONFIG/);
  await assert.rejects(start({ provider: "OTHER" }), /INVALID_PAYLOAD/);
  const lease = await start();
  assert.equal((await start()).status, "SKIPPED");
  const local = await start({ provider: "BOKJIRO_LOCAL" });
  assert.equal(local.status, "RUNNING");
  await assert.rejects(
    command("auto_state", { ...lease, provider: "BOKJIRO_LOCAL" }),
    /UNKNOWN_AUTO_RUN/,
  );
  await assert.rejects(
    command("auto_reserve", { ...lease, provider: "BOKJIRO_LOCAL" }),
    /STALE_LEASE/,
  );
  await assert.rejects(
    command("auto_pause", { ...lease, reason: "arbitrary exception text" }),
    /INVALID_STOP_REASON/,
  );
  await admin(
    "update public.policy_sync_locks set expires_at=clock_timestamp()-interval '1 second' where name='BOKJIRO_CENTRAL'",
  );
  await assert.rejects(command("auto_reserve", lease), /STALE_LEASE/);
  const replacement = await start();
  assert.ok(replacement.generation > lease.generation);
  await assert.rejects(save(lease, page(1, [], 0)), /STALE_LEASE/);
});

test("daily reservations survive pauses, resumes and new jobs and never increase an existing daily cap", async () => {
  const small = { ...config, dailyLimit: 2 };
  const lease = await start({ config: small });
  assert.deepEqual(await command("auto_reserve", lease), { allowed: true });
  await command("auto_pause", { ...lease, reason: "CALL_BUDGET" });
  const resumed = await start({ resumeRunId: lease.runId, config: small });
  assert.deepEqual(await command("auto_reserve", resumed), { allowed: true });
  assert.deepEqual(await command("auto_reserve", resumed), {
    allowed: false,
    reason: "DAILY_BUDGET",
  });
  assert.equal((await state(resumed)).run.calls, 2);
  await command("auto_pause", { ...resumed, reason: "DAILY_BUDGET" });
  const next = await start({ config: { ...config, dailyLimit: 100 } });
  assert.deepEqual(await command("auto_reserve", next), {
    allowed: false,
    reason: "DAILY_BUDGET",
  });
  assert.equal((await state(next)).run.calls, 0);
  const usage = await db.query(
    "select reserved_calls, configured_limit from public.policy_api_daily_usage where provider=$1",
    [provider],
  );
  assert.deepEqual(usage.rows, [{ reserved_calls: 2, configured_limit: 2 }]);
  const local = await start({ provider: "BOKJIRO_LOCAL", config: small });
  assert.deepEqual(
    await command("auto_reserve", { ...local, provider: "BOKJIRO_LOCAL" }),
    { allowed: true },
  );
});

test("quality insertion and application share a transaction; failed collection can have no source", async () => {
  const lease = await start();
  await save(lease, page(1, ["a", "b"], 2));
  const stagedApply = await staged(lease);
  const before = await dump();
  await assert.rejects(
    command("apply", {
      ...stagedApply,
      quality: {
        ...stagedApply.quality,
        metrics: { required: 6, present: 6, missing: 1 },
      },
    }),
    /check constraint/,
  );
  assert.equal(await current(), null);
  assert.deepEqual(await dump(), before);
  assert.equal((await command("apply", stagedApply)).status, "SUCCESS");
  assert.equal((await current())?.snapshotId, stagedApply.snapshotId);
  const records = await db.query<{
    source_id: string;
    snapshot_id: string;
    status: string;
    raw_hash: string;
  }>(
    "select source_id,snapshot_id,status,raw_hash from public.policy_quality_observations where external_id='a'",
  );
  assert.ok(records.rows[0].source_id);
  assert.equal(records.rows[0].snapshot_id, stagedApply.snapshotId);
  assert.equal(records.rows[0].status, stagedApply.quality.status);
  assert.equal(records.rows[0].raw_hash, stagedApply.normalized.rawHash);
  await command("fail", {
    ...lease,
    externalId: "b",
    errorCode: "COLLECTION_FAILED",
    quality: failureQuality("COLLECTION_FAILED"),
  });
  const failed = await db.query(
    "select source_id,snapshot_id,status,required_count from public.policy_quality_observations where external_id='b'",
  );
  assert.deepEqual(failed.rows, [
    { source_id: null, snapshot_id: null, status: "ERROR", required_count: 0 },
  ]);
});

test("legacy selection callers remain compatible and receive NOT_EVALUATED quality", async () => {
  const lease = await command<Lease>("start", {
    runId: randomUUID(),
    trigger: "manual",
    scope: [{ id: "a", reason: "legacy", filters: {} }],
  });
  const { quality: omitted, ...payload } = await staged(lease);
  assert.ok(omitted);
  await command("apply", payload);
  const quality = await db.query(
    "select status,evaluator_version,required_count from public.policy_quality_observations",
  );
  assert.deepEqual(quality.rows, [
    {
      status: "NOT_EVALUATED",
      evaluator_version: "not-evaluated",
      required_count: 0,
    },
  ]);
  assert.equal(
    (await command("finish", { ...lease, calls: 4 })).status,
    "SUCCESS",
  );
  const run = await command<{
    run: { calls: number; collection_mode: string };
  }>("run", lease);
  assert.equal(run.run.calls, 4);
  assert.equal(run.run.collection_mode, "selection");
});

test("anon and authenticated cannot access internal automatic tables or either command entry point", async () => {
  await start();
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`reset role; set role ${role}`);
    for (const table of newTables) {
      await assert.rejects(
        db.query(`select * from public.${table}`),
        /permission denied/,
      );
      await assert.rejects(
        db.query(`delete from public.${table}`),
        /permission denied/,
      );
      await assert.rejects(
        db.query(`insert into public.${table} default values`),
        /permission denied/,
      );
      const column =
        table === "policy_api_daily_usage"
          ? "provider"
          : table === "policy_relevance_observations"
            ? "source_id"
            : "run_id";
      await assert.rejects(
        db.query(`update public.${table} set ${column}=${column}`),
        /permission denied/,
      );
    }
    for (const fn of [
      "policy_sync_command",
      "policy_sync_command_v2",
      "policy_sync_command_v3",
    ])
      await assert.rejects(
        db.query(`select public.${fn}('current','{}'::jsonb)`),
        /permission denied/,
      );
    await assert.rejects(
      db.query("select public.policy_admin_report('overview','{}'::jsonb)"),
      /permission denied/,
    );
  }
  await db.exec("reset role; set role service_role");
  for (const table of newTables)
    assert.ok((await db.query(`select * from public.${table}`)).rows);
  const secured = await db.query<{ name: string; rls: boolean }>(
    "select relname as name,relrowsecurity as rls from pg_class where relname=any($1::text[]) order by relname",
    [newTables],
  );
  assert.equal(secured.rows.length, newTables.length);
  assert.ok(secured.rows.every((row) => row.rls));
});

type ReportPage = {
  items: Record<string, unknown>[];
  nextCursor: Record<string, string> | null;
};
async function report<T = ReportPage>(
  action: string,
  filters: object = {},
): Promise<T> {
  const result = await db.query<{ value: T }>(
    "select public.policy_admin_report($1,$2::jsonb) as value",
    [action, JSON.stringify(filters)],
  );
  return result.rows[0].value;
}
function assertNoRawPayload(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    assert.ok(
      !["raw", "normalized", "xml", "evidence", "rows", "scope"].includes(key),
      `Unexpected raw payload key ${key}`,
    );
    assertNoRawPayload(nested);
  }
  assert.ok(!JSON.stringify(value).includes("RAW_REPORT_SENTINEL"));
}

test("admin overview distinguishes unassessed current values and stops counting outdated normalization assessments", async () => {
  type Overview = {
    policies: number;
    unassessedCurrent: number;
    comparisonReady: number;
    quality: {
      status: string;
      count: number;
      required: number;
      present: number;
      missing: number;
    }[];
  };
  const first = await command<Lease>("start", {
    runId: randomUUID(),
    trigger: "manual",
    scope: [{ id: "a", reason: "legacy", filters: {} }],
  });
  const { quality: expected, ...legacy } = await staged(first);
  await command("apply", legacy);
  await command("finish", { ...first, calls: 0 });
  let overview = await report<Overview>("overview", { provider });
  assert.equal(overview.policies, 1);
  assert.equal(overview.unassessedCurrent, 1);
  assert.equal(overview.comparisonReady, 0);
  const evaluated = await start();
  await save(evaluated, page(1, ["a"], 1));
  await command("apply", await staged(evaluated));
  overview = await report<Overview>("overview", { provider });
  assert.equal(overview.unassessedCurrent, 0);
  assert.deepEqual(overview.quality, [
    {
      status: expected.status,
      count: 1,
      required: expected.metrics.required,
      present: expected.metrics.present,
      missing: expected.metrics.missing,
    },
  ]);
  assert.equal(
    (await report<Overview>("overview", { provider: "BOKJIRO_LOCAL" }))
      .policies,
    0,
  );
  const matching = await report("quality", { runId: evaluated.runId });
  assert.equal(matching.items[0].matches_current, true);
  // Simulate a later normalization deployment without producing a new assessment.
  await admin(
    "update public.policies set normalized=jsonb_set(normalized,'{normalizerVersion}','\"future-normalizer\"'::jsonb)",
  );
  overview = await report<Overview>("overview", { provider });
  assert.equal(overview.policies, 1);
  assert.equal(overview.unassessedCurrent, 1);
  assert.deepEqual(overview.quality, []);
  assert.equal(
    (await report("quality", { runId: evaluated.runId })).items[0]
      .matches_current,
    false,
  );
});

test("admin quality filters and cursor pages include source-less failures without exposing raw evidence", async () => {
  const central = await start();
  await save(central, {
    ...page(1, ["a", "b"], 2),
    evidence: [{ raw: "RAW_REPORT_SENTINEL" }],
  });
  const success = await staged(central);
  await command("apply", success);
  await command("fail", {
    ...central,
    externalId: "b",
    errorCode: "COLLECTION_FAILED",
    evidence: { raw: "RAW_REPORT_SENTINEL" },
    quality: failureQuality("COLLECTION_FAILED"),
  });
  const local = await start({ provider: "BOKJIRO_LOCAL" });
  await command("auto_page", {
    ...local,
    provider: "BOKJIRO_LOCAL",
    page: page(1, ["c"], 1),
  });
  await command("fail", {
    ...local,
    provider: "BOKJIRO_LOCAL",
    externalId: "c",
    errorCode: "NORMALIZATION_FAILED",
    quality: failureQuality("NORMALIZATION_FAILED"),
  });
  const all = await report("quality");
  assert.equal(all.items.length, 3);
  const providerOnly = await report("quality", { provider });
  assert.equal(providerOnly.items.length, 2);
  assert.ok(providerOnly.items.every((item) => item.provider === provider));
  const runOnly = await report("quality", { runId: local.runId });
  assert.deepEqual(
    runOnly.items.map((item) => item.external_id),
    ["c"],
  );
  const failures = await report("quality", { status: "ERROR" });
  assert.equal(failures.items.length, 2);
  assert.ok(
    failures.items.every(
      (item) =>
        item.source_id === null &&
        item.snapshot_id === null &&
        item.matches_current === false,
    ),
  );
  const exact = await report("quality", {
    provider,
    runId: central.runId,
    status: "ERROR",
    code: "COLLECTION_FAILED",
  });
  assert.deepEqual(
    exact.items.map((item) => item.external_id),
    ["b"],
  );
  assert.equal(
    (await report("quality", { code: "NORMALIZATION_FAILED", provider })).items
      .length,
    0,
  );
  const ids: unknown[] = [];
  let cursor: Record<string, string> | null = {};
  while (cursor) {
    const next: ReportPage = await report("quality", { limit: 1, ...cursor });
    assertNoRawPayload(next);
    ids.push(...next.items.map((item) => item.id));
    cursor = next.nextCursor;
  }
  assert.deepEqual(
    ids,
    all.items.map((item) => item.id),
  );
  assert.equal(new Set(ids).size, ids.length);
  const before = await dump();
  for (const filters of [{ limit: 0 }, { limit: 101 }, { provider: "OTHER" }])
    await assert.rejects(report("quality", filters), /INVALID_REPORT_FILTER/);
  assert.deepEqual(await dump(), before);
});

test("admin run cursor handles equal start times and exposes pause, discovery and lease state without raw pages", async () => {
  const paused = await start();
  await save(paused, {
    ...page(1, ["a"], 1),
    evidence: [{ raw: "RAW_REPORT_SENTINEL" }],
  });
  await command("auto_pause", { ...paused, reason: "PAGE_LIMIT" });
  const finished = await start();
  await save(finished, page(1, [], 0));
  await command("finish", { ...finished, calls: 0 });
  const active = await start();
  await admin(
    "update public.policy_sync_runs set started_at='2026-09-08T00:00:00Z'",
  );
  const all = await report("runs", { provider });
  const expectedIds = [paused.runId, finished.runId, active.runId]
    .sort()
    .reverse();
  assert.deepEqual(
    all.items.map((item) => item.id),
    expectedIds,
  );
  const byId = new Map(all.items.map((item) => [item.id, item]));
  assert.equal(byId.get(paused.runId)?.stop_reason, "PAGE_LIMIT");
  assert.equal(byId.get(paused.runId)?.discovery_complete, false);
  assert.equal(byId.get(paused.runId)?.lease_active, false);
  assert.equal(byId.get(finished.runId)?.discovery_complete, true);
  assert.equal(byId.get(finished.runId)?.lease_active, false);
  assert.equal(byId.get(active.runId)?.lease_active, true);
  assert.equal((await report("runs", { provider: "GOV24" })).items.length, 0);
  assert.deepEqual(
    (await report("runs", { runId: paused.runId })).items.map(
      (item) => item.id,
    ),
    [paused.runId],
  );
  const firstPage = await report("runs", { provider, limit: 2 });
  assert.ok(firstPage.nextCursor?.beforeStartedAt);
  const nextPage = await report("runs", {
    provider,
    limit: 2,
    ...firstPage.nextCursor,
  });
  assert.equal(nextPage.nextCursor, null);
  const ids = [...firstPage.items, ...nextPage.items].map((item) => item.id);
  assert.deepEqual(ids, expectedIds);
  assert.equal(new Set(ids).size, 3);
  assertNoRawPayload(firstPage);
  assertNoRawPayload(nextPage);
});

test("relevance is atomic, idempotent and bound to the current snapshot and normalization", async () => {
  const lease = await start();
  await save(lease, page(1, ["a"], 1));
  const payload = await staged(lease);
  const relevance = evaluatePolicyRelevance(payload.normalized.display);
  await assert.rejects(
    command("apply", {
      ...payload,
      relevance: { ...relevance, status: "BAD" },
    }),
    /INVALID_RELEVANCE/,
  );
  assert.equal(
    await current(),
    null,
    "failed classification must roll back policy application",
  );
  await command("apply", { ...payload, relevance });
  const row = (
    await db.query<{ source_id: string; relevance: unknown }>(
      "select source_id,relevance from public.policies",
    )
  ).rows[0];
  assert.deepEqual(row.relevance, relevance);
  const observation = {
    sourceId: row.source_id,
    snapshotId: payload.snapshotId,
    displayHash: payload.normalized.displayHash,
    normalizerVersion: payload.normalized.normalizerVersion,
    relevance,
  };
  await command("relevance_store", observation);
  assert.equal(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.policy_relevance_observations",
      )
    ).rows[0].count,
    1,
  );
  await assert.rejects(
    command("relevance_store", { ...observation, displayHash: "stale" }),
    /STALE_RELEVANCE/,
  );
  await assert.rejects(
    command("relevance_store", {
      ...observation,
      relevance: { ...relevance, reason: "Changed without a version bump" },
    }),
    /RELEVANCE_VERSION_CONFLICT/,
  );
  await db.query(
    "update public.policies set normalized=jsonb_set(normalized,'{normalizerVersion}','\"new-normalizer\"') where source_id=$1",
    [row.source_id],
  );
  assert.equal(
    (
      await db.query<{ relevance: unknown }>(
        "select relevance from public.policies",
      )
    ).rows[0].relevance,
    null,
  );
  await assert.rejects(
    command("relevance_store", observation),
    /STALE_RELEVANCE/,
  );
  assert.equal(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.policy_relevance_observations",
      )
    ).rows[0].count,
    1,
    "history survives invalidation",
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`reset role; set role ${role}`);
    await assert.rejects(
      db.query("select public.policy_store_relevance('{}')"),
      /permission denied/,
    );
  }
  await db.exec("reset role; set role service_role");
});

test("list exclusion records evidence, makes no policy/snapshot, and finishes separately from saves", async () => {
  const lease = await start();
  await save(lease, page(1, ["a", "b"], 2));
  const relevance = evaluatePolicyRelevance({ name: "어업경영자금 지원" });
  const exclusion = {
    ...lease,
    externalId: "a",
    relevance,
    phase: "LIST",
    page: 1,
  };
  await assert.rejects(
    command("auto_exclude", { ...exclusion, page: 2 }),
    /EXCLUSION_PAGE_MISMATCH/,
  );
  await assert.rejects(
    command("auto_exclude", { ...exclusion, generation: lease.generation + 1 }),
    /STALE_LEASE/,
  );
  await assert.rejects(
    command("auto_exclude", {
      ...exclusion,
      relevance: { ...relevance, status: "REVIEW" },
    }),
    /INVALID_SCOPE_EXCLUSION/,
  );
  assert.equal((await command("auto_exclude", exclusion)).status, "EXCLUDED");
  assert.equal(await current(), null);
  assert.equal(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.policy_source_snapshots",
      )
    ).rows[0].count,
    0,
  );
  assert.deepEqual((await state(lease)).pendingIds, ["b"]);
  const payload = await staged(lease, "b");
  await command("apply", {
    ...payload,
    relevance: evaluatePolicyRelevance(payload.normalized.display),
  });
  await save(lease, page(2, [], 2));
  const result = await command("finish", { ...lease, calls: 0 });
  assert.equal(result.success, 1);
  assert.equal(result.excluded, 1);
  assert.equal(result.failed, 0);
  const report = await db.query<{
    value: { items: Array<{ scope_phase: string; scope_relevance: unknown }> };
  }>("select public.policy_admin_report('exclusions','{}') as value");
  assert.equal(report.rows[0].value.items[0].scope_phase, "LIST");
  assert.deepEqual(report.rows[0].value.items[0].scope_relevance, relevance);
});

test("detail and common apply exclusions retain raw evidence without creating current policies", async () => {
  const lease = await start();
  await save(lease, page(1, ["a", "b"], 2));
  for (const id of ["a", "b"]) {
    const payload = await staged(lease, id, "어업경영자금 지원");
    const relevance = evaluatePolicyRelevance(payload.normalized.display);
    const result =
      id === "a"
        ? await command("auto_exclude", {
            ...payload,
            relevance,
            phase: "DETAIL",
          })
        : await command("apply", { ...payload, relevance });
    assert.equal(result.status, "EXCLUDED");
    assert.equal(await current(id), null);
  }
  assert.equal(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.policy_source_snapshots",
      )
    ).rows[0].count,
    2,
  );
  const paused = await command("auto_pause", {
    ...lease,
    reason: "CALL_BUDGET",
  });
  assert.equal(paused.success, 0);
  assert.equal(paused.excluded, 2);
});

test("existing policy cannot be silently skipped; it receives a fresh full assessment", async () => {
  const first = await start();
  await save(first, page(1, ["a"], 1));
  const payload = await staged(first);
  await command("apply", {
    ...payload,
    relevance: evaluatePolicyRelevance(payload.normalized.display),
  });
  await save(first, page(2, [], 1));
  await command("finish", { ...first, calls: 0 });
  const next = await start();
  await save(next, page(1, ["a"], 1));
  const relevance = evaluatePolicyRelevance({ name: "어업경영자금 지원" });
  await assert.rejects(
    command("auto_exclude", {
      ...next,
      externalId: "a",
      phase: "LIST",
      page: 1,
      relevance,
    }),
    /EXISTING_POLICY_REQUIRES_REFRESH/,
  );
  const updated = await staged(next, "a", "어업경영자금 지원");
  await command("apply", { ...updated, relevance });
  assert.equal(
    (
      await db.query<{ relevance: { status: string } }>(
        "select relevance from public.policies",
      )
    ).rows[0].relevance.status,
    "UNRELATED",
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`reset role; set role ${role}`);
    await assert.rejects(
      db.query("select public.policy_scope_exclude('{}')"),
      /permission denied/,
    );
  }
  await db.exec("reset role; set role service_role");
});

test("existing policy disposition follows assessment while preserving originals and history", async () => {
  const lease = await start();
  await save(lease, page(1, ["a"], 1));
  const payload = await staged(lease);
  // A previously saved policy exists before assessment, as with legacy data.
  await command("apply", payload);
  const disposition = async () =>
    (
      await db.query<{ catalog_status: string }>(
        "select catalog_status from public.policies",
      )
    ).rows[0].catalog_status;
  const candidates = async () =>
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.policy_active_candidates",
      )
    ).rows[0].count;
  assert.equal(await disposition(), "REVIEW");
  assert.equal(await candidates(), 0);
  const source = (
    await db.query<{ source_id: string }>(
      "select source_id from public.policies",
    )
  ).rows[0].source_id;
  await command("relevance_store", {
    sourceId: source,
    snapshotId: payload.snapshotId,
    displayHash: payload.normalized.displayHash,
    normalizerVersion: payload.normalized.normalizerVersion,
    relevance: evaluatePolicyRelevance(payload.normalized.display),
  });
  assert.equal(await disposition(), "ACTIVE");
  assert.equal(await candidates(), 1);
  await save(lease, page(2, [], 1));
  await command("finish", { ...lease, calls: 0 });
  const next = await start();
  await save(next, page(1, ["a"], 1));
  const unrelated = await staged(next, "a", "어업경영자금 지원");
  await command("apply", {
    ...unrelated,
    relevance: evaluatePolicyRelevance(unrelated.normalized.display),
  });
  assert.equal(await disposition(), "EXCLUDED");
  assert.equal(await candidates(), 0);
  assert.equal(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.policies",
      )
    ).rows[0].count,
    1,
  );
  assert.equal(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.policy_source_snapshots",
      )
    ).rows[0].count,
    2,
  );
  assert.equal(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.policy_relevance_observations",
      )
    ).rows[0].count,
    2,
  );
  await assert.rejects(
    db.query("update public.policies set catalog_status='ACTIVE'"),
    /catalog_status.*can only be updated to DEFAULT/,
  );
  await db.query(
    "update public.policies set normalized=jsonb_set(normalized,'{normalizerVersion}','\"next-version\"')",
  );
  assert.equal(await disposition(), "REVIEW");
  assert.equal(await candidates(), 0);
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`reset role; set role ${role}`);
    await assert.rejects(
      db.query("select * from public.policy_active_candidates"),
      /permission denied/,
    );
  }
  await db.exec("reset role; set role service_role");
});

test("stricter v2 reassessment archives a legacy review and retains both version histories", async () => {
  const lease = await start();
  await save(lease, page(1, ["a"], 1));
  const payload = await staged(lease, "a", "광산 현대화 장비 및 시설 지원");
  const v1 = {
    version: "policy-relevance-1",
    status: "REVIEW",
    categories: [],
    evidence: [],
    reason: "이전 범위 확인 필요",
  };
  await command("apply", { ...payload, relevance: v1 });
  const source = (
    await db.query<{ source_id: string }>(
      "select source_id from public.policies",
    )
  ).rows[0].source_id;
  const v2 = { ...evaluatePolicyRelevance(payload.normalized.display), version: "policy-relevance-2" };
  assert.equal(v2.version, "policy-relevance-2");
  assert.equal(v2.status, "UNRELATED");
  await command("relevance_store", {
    sourceId: source,
    snapshotId: payload.snapshotId,
    displayHash: payload.normalized.displayHash,
    normalizerVersion: payload.normalized.normalizerVersion,
    relevance: v2,
  });
  assert.equal(
    (
      await db.query<{ catalog_status: string }>(
        "select catalog_status from public.policies",
      )
    ).rows[0].catalog_status,
    "EXCLUDED",
  );
  assert.equal(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from public.policy_relevance_observations",
      )
    ).rows[0].count,
    2,
  );
  const snapshots = (
    await db.query<{ count: number }>(
      "select count(*)::int as count from public.policy_source_snapshots",
    )
  ).rows[0].count;
  assert.equal(snapshots, 1);
});

test("v3 child counseling reassessment activates a legacy review with original and both histories intact", async () => {
  const lease = await start();
  await save(lease, page(1, ["a"], 1));
  const bundle = raw("a", "청소년 상담 서비스 제공");
  bundle.detail[0].tgtrDtlCn = "○ 9세~24세 (위기)청소년";
  bundle.detail[0].alwServCn = "○ 위기 청소년에 대한 상담, 긴급 구조, 학업지원, 자활지원 등의 서비스 제공";
  const normalized = normalizeBokji(bundle);
  const { snapshotId } = await command<{ snapshotId: string }>("snapshot", {
    ...lease, externalId: "a", raw: bundle, rawHash: normalized.rawHash,
    hashVersion: normalized.hashVersion, evidence: [],
  });
  const legacy = {
    version: "policy-relevance-2", status: "REVIEW", categories: [], evidence: [],
    reason: "서비스 관련성을 확정할 근거가 부족하여 검토가 필요합니다.",
  };
  await command("apply", {
    ...lease, externalId: "a", snapshotId, normalized,
    quality: evaluatePolicyQuality(bundle, normalized), changes: { displayChanged: true },
    relevance: legacy,
  });
  const original = (await db.query<{ source_id: string; normalized: unknown }>(
    "select source_id,normalized from public.policies",
  )).rows[0];
  const assessment = evaluatePolicyRelevance(normalized.display);
  assert.equal(assessment.version, "policy-relevance-3");
  assert.equal(assessment.status, "RELATED");
  await command("relevance_store", {
    sourceId: original.source_id, snapshotId, displayHash: normalized.displayHash,
    normalizerVersion: normalized.normalizerVersion, relevance: assessment,
  });
  const updated = (await db.query<{ catalog_status: string; normalized: unknown }>(
    "select catalog_status,normalized from public.policies",
  )).rows[0];
  assert.equal(updated.catalog_status, "ACTIVE");
  assert.deepEqual(updated.normalized, original.normalized);
  assert.deepEqual((await db.query<{ evaluator_version: string }>(
    "select evaluator_version from public.policy_relevance_observations order by evaluator_version",
  )).rows.map((row) => row.evaluator_version), ["policy-relevance-2", "policy-relevance-3"]);
  assert.equal((await db.query<{ count: number }>(
    "select count(*)::int as count from public.policy_source_snapshots",
  )).rows[0].count, 1);
});

async function pendingReviewActivation(display = {
  name: "지역 학생 이용 지원", target: "초등학생 및 중학생", benefit: "체육시설 사용료 감면",
}) {
  const lease = await start();
  await save(lease, page(1, ["review-a"], 1));
  const bundle = raw("review-a", display.name);
  bundle.detail[0].tgtrDtlCn = display.target;
  bundle.detail[0].alwServCn = display.benefit;
  const normalized = normalizeBokji(bundle);
  const { snapshotId } = await command<{ snapshotId: string }>("snapshot", {
    ...lease, externalId: "review-a", raw: bundle, rawHash: normalized.rawHash,
    hashVersion: normalized.hashVersion, evidence: [],
  });
  const previousRelevance = { version: "policy-relevance-3", status: "REVIEW", categories: [], evidence: [], reason: "이전 자동 분류 미확정" };
  await command("apply", {
    ...lease, externalId: "review-a", snapshotId, normalized,
    quality: evaluatePolicyQuality(bundle, normalized), changes: { displayChanged: true }, relevance: previousRelevance,
  });
  const sourceId = (await db.query<{ source_id: string }>("select source_id from public.policies")).rows[0].source_id;
  return {
    sourceId, snapshotId, displayHash: normalized.displayHash, normalizerVersion: normalized.normalizerVersion,
    reviewOnly: true, expectedNormalized: normalized, previousRelevance,
    relevance: {
      version: "policy-relevance-review-1", status: "RELATED", categories: ["아동 돌봄"],
      evidence: [
        { field: "target_text", excerpt: display.target, rule: "실제 지원 대상" },
        { field: "benefit_text", excerpt: display.benefit, rule: "실제 지원 내용" },
      ],
      reason: "저장 원문의 아동 대상 시설 이용 지원 경로를 재검토함. 자격 승인은 아님.",
    },
  };
}

test("review-only activation preserves source and old history, retries idempotently and resists legacy downgrade", async () => {
  const payload = await pendingReviewActivation();
  const sourcesBefore = await dump(["policies", "policy_source_snapshots"]);
  assert.equal((await command("relevance_store", payload)).status, "RELATED");
  assert.equal((await command("relevance_store", payload)).replayed, true);
  assert.equal((await command("relevance_store", { ...payload, relevance: payload.previousRelevance })).preservedReviewed, true);
  const current = (await db.query<{ catalog_status: string; normalized: unknown; relevance: unknown }>("select catalog_status,normalized,relevance from public.policies")).rows[0];
  assert.equal(current.catalog_status, "ACTIVE");
  assert.deepEqual(current.normalized, payload.expectedNormalized);
  assert.deepEqual(current.relevance, payload.relevance);
  assert.deepEqual((await dump(["policy_source_snapshots"]))[0], sourcesBefore[1]);
  assert.equal((await db.query<{ count: number }>("select count(*)::int as count from public.policy_relevance_observations")).rows[0].count, 2);
});

test("review-only activation rejects changed source, changed decision and invented evidence without side effects", async () => {
  const payload = await pendingReviewActivation();
  const beforeState = await dump();
  for (const [modified, reason] of [
    [{ ...payload, reviewOnly: false }, /INVALID_REVIEW_ACTIVATION/],
    [{ ...payload, expectedNormalized: { ...payload.expectedNormalized, extra: "changed" } }, /STALE_REVIEW_SOURCE/],
    [{ ...payload, previousRelevance: { ...payload.previousRelevance, reason: "different" } }, /STALE_REVIEW_DECISION/],
    [{ ...payload, relevance: { ...payload.relevance, evidence: [{ field: "target_text", excerpt: "NOT PRESENT", rule: "invalid" }] } }, /INVALID_REVIEW_EVIDENCE/],
    [{ ...payload, relevance: { ...payload.relevance, categories: ["invented"] } }, /INVALID_REVIEW_EVIDENCE/],
  ] as const) {
    await assert.rejects(command("relevance_store", modified), reason);
    assert.deepEqual(await dump(), beforeState);
  }
  await command("relevance_store", { ...payload, relevance: { ...payload.previousRelevance, version: "policy-relevance-2", status: "UNRELATED", reason: "별도 분류 완료" } });
  await assert.rejects(command("relevance_store", payload), /STALE_REVIEW_DECISION/);
});

test("changing normalized content invalidates review activation even when display identity is unchanged", async () => {
  const payload = await pendingReviewActivation();
  await command("relevance_store", payload);
  await admin("update public.policies set normalized=normalized||'{\"sourceShapeChanged\":true}'::jsonb");
  const current = (await db.query<{ catalog_status: string; relevance: unknown }>("select catalog_status,relevance from public.policies")).rows[0];
  assert.equal(current.catalog_status, "REVIEW");
  assert.equal(current.relevance, null);
  await assert.rejects(command("relevance_store", payload), /STALE_REVIEW_SOURCE/);
});

test("review v2 excludes a pending business policy without deleting source or previous assessments", async () => {
  const original = await pendingReviewActivation({ name: "소상공인 시설 지원", target: "사업자등록을 한 소상공인", benefit: "사업장 시설 개선비 지원" });
  const payload = { ...original, relevance: { ...original.relevance, version: "policy-relevance-review-2", status: "UNRELATED", categories: [], reason: "사업장 시설 개선 지원이며 가족·아동 지원 경로 없음" } };
  const before = await dump(["policy_source_snapshots"]);
  assert.equal((await command("relevance_store", payload)).status, "UNRELATED");
  assert.equal((await command("relevance_store", payload)).replayed, true);
  assert.equal((await command("relevance_store", { ...payload, relevance: original.previousRelevance })).preservedReviewed, true);
  const row = (await db.query<{ catalog_status: string; normalized: unknown }>("select catalog_status,normalized from public.policies")).rows[0];
  assert.equal(row.catalog_status, "EXCLUDED");
  assert.deepEqual(row.normalized, payload.expectedNormalized);
  assert.deepEqual(await dump(["policy_source_snapshots"]), before);
  assert.equal((await db.query<{ n: number }>("select count(*)::int n from public.policy_relevance_observations")).rows[0].n, 2);
  assert.equal((await db.query<{ n: number }>("select count(*)::int n from public.policy_active_candidates")).rows[0].n, 0);
});

test("review v2 requires direct source evidence and rejects invalid excluded categories and stale sources", async () => {
  const original = await pendingReviewActivation();
  const payload = { ...original, relevance: { ...original.relevance, version: "policy-relevance-review-2" } };
  const before = await dump();
  for (const [modified, reason] of [
    [{ ...payload, relevance: { ...payload.relevance, evidence: [{ field: "name", excerpt: "지역 학생 이용 지원", rule: "이름만 확인" }] } }, /INVALID_REVIEW_EVIDENCE/],
    [{ ...payload, relevance: { ...payload.relevance, status: "UNRELATED" } }, /INVALID_REVIEW_ACTIVATION/],
    [{ ...payload, relevance: { ...payload.relevance, status: "REVIEW" } }, /INVALID_REVIEW_ACTIVATION/],
    [{ ...payload, expectedNormalized: { ...payload.expectedNormalized, invented: true } }, /STALE_REVIEW_SOURCE/],
  ] as const) {
    await assert.rejects(command("relevance_store", modified), reason);
    assert.deepEqual(await dump(), before);
  }
  assert.equal((await command("relevance_store", payload)).status, "RELATED");
});

test("review v2 stores a pending reason without approving or excluding the policy", async () => {
  const original = await pendingReviewActivation({ name: "일반 주민 의료지원", target: "지역 주민", benefit: "의료비 지원" });
  const payload = { ...original, relevance: { version: "policy-relevance-review-2", status: "REVIEW", categories: [], evidence: [], reason: "일반 주민 의료지원으로 아동·가족의 별도 지원 대상 확인 필요" } };
  assert.equal((await command("relevance_store", payload)).status, "REVIEW");
  assert.equal((await command("relevance_store", payload)).replayed, true);
  const row = (await db.query<{ catalog_status: string; relevance: unknown; normalized: unknown }>("select catalog_status,relevance,normalized from public.policies")).rows[0];
  assert.equal(row.catalog_status, "REVIEW");
  assert.deepEqual(row.relevance, payload.relevance);
  assert.deepEqual(row.normalized, payload.expectedNormalized);
  assert.equal((await db.query<{ n: number }>("select count(*)::int n from public.policy_relevance_observations")).rows[0].n, 2);
  const changed = { ...payload, previousRelevance: payload.relevance, relevance: { ...payload.relevance, reason: "다른 판정으로 덮어쓰기" } };
  await assert.rejects(command("relevance_store", changed), /RELEVANCE_VERSION_CONFLICT/);
});

test("v3 correction returns only a source-matched v2 exclusion to pending and preserves the exclusion history", async () => {
  const original = await pendingReviewActivation();
  const excluded = { ...original, relevance: { version: "policy-relevance-review-2", status: "UNRELATED", categories: [], evidence: original.relevance.evidence, reason: "합성 제외 판정" } };
  await command("relevance_store", excluded);
  const correction = { ...original, correction: true, previousRelevance: excluded.relevance,
    relevance: { version: "policy-relevance-review-3", status: "REVIEW", categories: [], evidence: [], reason: "명확한 범위 밖으로 단정할 근거가 부족하여 추가 확인 유지" } };
  await assert.rejects(command("relevance_store", { ...correction, correction: false }), /INVALID_REVIEW_ACTIVATION/);
  await assert.rejects(command("relevance_store", { ...correction, previousRelevance: original.previousRelevance }), /STALE_REVIEW_DECISION/);
  await assert.rejects(command("relevance_store", { ...correction, relevance: { ...correction.relevance, status: "RELATED", categories: ["아동 돌봄"] } }), /INVALID_REVIEW_ACTIVATION/);
  assert.equal((await command("relevance_store", correction)).status, "REVIEW");
  assert.equal((await command("relevance_store", correction)).replayed, true);
  assert.equal((await command("relevance_store", { ...original, relevance: original.previousRelevance })).preservedReviewed, true);
  const row = (await db.query<{ catalog_status: string; normalized: unknown }>("select catalog_status,normalized from public.policies")).rows[0];
  assert.equal(row.catalog_status, "REVIEW");
  assert.deepEqual(row.normalized, original.expectedNormalized);
  assert.equal((await db.query<{ n: number }>("select count(*)::int n from public.policy_relevance_observations")).rows[0].n, 3);
});

async function officialReassessment(corrected = false) {
  const original = await pendingReviewActivation();
  const v2 = { version: "policy-relevance-review-2", status: corrected ? "UNRELATED" : "REVIEW", categories: [],
    evidence: corrected ? original.relevance.evidence : [], reason: "이전 재검토 결과" };
  await command("relevance_store", { ...original, relevance: v2 });
  const previous = corrected ? { ...v2, version: "policy-relevance-review-3", status: "REVIEW", evidence: [], reason: "공식 확인 필요" } : v2;
  if (corrected) await command("relevance_store", { ...original, correction: true, previousRelevance: v2, relevance: previous });
  const content = "지역 학생 이용 지원의 대상은 초등학생 및 중학생이며 체육시설 사용료를 감면한다.";
  return {
    ...original, reassessment: true, previousRelevance: previous,
    relevance: {
      version: "policy-relevance-review-4", status: "RELATED", categories: ["아동 돌봄"], evidence: [],
      previousRelevance: structuredClone(previous), sourceConsistency: "CONFIRMED", reason: "공식 학생 지원 대상 확인",
      officialEvidence: [{ originalUrl: "https://www.gov.kr/policy/student", finalUrl: "https://www.gov.kr/policy/student",
        publisher: "담당 지방자치단체", retrievedAt: "2026-09-13T00:00:00.000Z", content,
        contentHash: createHash("sha256").update(content, "utf8").digest("hex"), excerpt: "초등학생 및 중학생",
        field: "target_text", rule: "아동 지원 대상", policyIdentity: "같은 지역·기관의 학생 시설 사용료 감면" }],
    },
  };
}

test("v4 reassesses pending v2 with immutable provenance, source and history and exact retries", async () => {
  const payload = await officialReassessment();
  const snapshots = await dump(["policy_source_snapshots"]);
  const history = (await dump(["policy_relevance_observations"]))[0];
  assert.equal((await command("relevance_store", payload)).status, "RELATED");
  assert.equal((await command("relevance_store", payload)).replayed, true);
  const current = (await db.query<{ normalized: unknown; relevance: unknown; catalog_status: string }>("select normalized,relevance,catalog_status from public.policies")).rows[0];
  assert.deepEqual(current.normalized, payload.expectedNormalized);
  assert.deepEqual(current.relevance, payload.relevance);
  assert.equal(current.catalog_status, "ACTIVE");
  assert.deepEqual(await dump(["policy_source_snapshots"]), snapshots);
  const afterHistory = (await dump(["policy_relevance_observations"]))[0];
  assert.equal(afterHistory.length, history.length + 1);
  for (const observation of history) assert.ok(afterHistory.some((row) => JSON.stringify(row) === JSON.stringify(observation)));
  await assert.rejects(command("relevance_store", { ...payload, previousRelevance: { ...payload.previousRelevance, reason: "다른 선행 평가" } }), /INVALID_REASSESSMENT/);
  await assert.rejects(command("relevance_store", { ...payload, relevance: { ...payload.relevance, reason: "변경 평가" } }), /RELEVANCE_VERSION_CONFLICT/);
});

test("v4 pending from corrected v3 preserves conflict evidence and blocks old review and automatic downgrade", async () => {
  const payload = await officialReassessment(true);
  Object.assign(payload.relevance, { status: "REVIEW", categories: [], sourceConsistency: "CONFLICT" });
  assert.equal((await command("relevance_store", payload)).status, "REVIEW");
  const beforeState = await dump();
  for (const version of ["policy-relevance-review-1", "policy-relevance-review-2", "policy-relevance-review-3"]) {
    await assert.rejects(command("relevance_store", { ...payload, previousRelevance: payload.relevance,
      relevance: { ...payload.previousRelevance, version } }), /STALE_REVIEW_DECISION/);
    assert.deepEqual(await dump(), beforeState);
  }
  for (const version of ["policy-relevance-1", "policy-relevance-2", "policy-relevance-3"]) {
    assert.equal((await command("relevance_store", { ...payload, relevance: { ...payload.previousRelevance, version } })).preservedReviewed, true);
    assert.deepEqual(await dump(), beforeState);
  }
  assert.equal((await command("relevance_store", payload)).replayed, true);
});

test("v4 excludes a pending policy while preserving prior assessments", async () => {
  const payload = await officialReassessment();
  Object.assign(payload.relevance, { status: "UNRELATED", categories: [] });
  assert.equal((await command("relevance_store", payload)).status, "UNRELATED");
  assert.equal((await db.query<{ catalog_status: string }>("select catalog_status from public.policies")).rows[0].catalog_status, "EXCLUDED");
  assert.equal((await db.query<{ n: number }>("select count(*)::int n from public.policy_relevance_observations")).rows[0].n, 3);
});

test("v4 rejects stale source, predecessor, provenance and unconfirmed activation without side effects", async () => {
  const payload = await officialReassessment();
  const beforeState = await dump();
  const official = payload.relevance.officialEvidence[0];
  const stalePrevious = { ...payload.previousRelevance, reason: "변경된 이전 평가" };
  for (const [modified, reason] of [
    [{ ...payload, reassessment: false }, /INVALID_REASSESSMENT/],
    [{ ...payload, expectedNormalized: { ...payload.expectedNormalized, changed: true } }, /STALE_REVIEW_SOURCE/],
    [{ ...payload, snapshotId: randomUUID() }, /STALE_RELEVANCE/],
    [{ ...payload, previousRelevance: stalePrevious, relevance: { ...payload.relevance, previousRelevance: stalePrevious } }, /STALE_REVIEW_DECISION/],
    [{ ...payload, relevance: { ...payload.relevance, officialEvidence: [] } }, /INVALID_OFFICIAL_EVIDENCE/],
    ...[
      { ...official, contentHash: "a".repeat(64) }, { ...official, excerpt: "없는 근거" },
      { ...official, publisher: "" }, { ...official, policyIdentity: "" }, { ...official, content: "바뀐 본문" },
      { ...official, retrievedAt: "invalid" }, { ...official, finalUrl: "file:///tmp/page" },
      { ...official, field: "name" },
    ].map((e) => [{ ...payload, relevance: { ...payload.relevance, officialEvidence: [e] } }, /INVALID_OFFICIAL_EVIDENCE/]),
    ...["CONFLICT", "UNRESOLVED"].map((sourceConsistency) => [{ ...payload, relevance: { ...payload.relevance, sourceConsistency } }, /INVALID_REASSESSMENT/]),
  ] as [object, RegExp][]) {
    await assert.rejects(command("relevance_store", modified), reason);
    assert.deepEqual(await dump(), beforeState);
  }
  await command("relevance_store", payload);
  await admin("update public.policies set normalized=normalized||'{\"sourceShapeChanged\":true}'::jsonb");
  const current = (await db.query<{ relevance: unknown; catalog_status: string }>("select relevance,catalog_status from public.policies")).rows[0];
  assert.equal(current.relevance, null);
  assert.equal(current.catalog_status, "REVIEW");
  await assert.rejects(command("relevance_store", payload), /STALE_REVIEW_SOURCE/);
});


test("v5 activates six-tag content despite condition conflicts and preserves v4 history", async () => {
  const original = await officialReassessment();
  const pending = { ...original, relevance: { ...original.relevance, status: "REVIEW", categories: [], sourceConsistency: "CONFLICT" } };
  await command("relevance_store", pending);
  const display = original.expectedNormalized.display as Record<string, string>;
  const payload = { ...original, previousRelevance: pending.relevance,
    relevance: { version: "policy-relevance-review-5", status: "RELATED", categories: ["아동 교육"],
      previousRelevance: pending.relevance, conditionChecks: ["시설 이용 지원의 적용연도 확인 필요"],
      evidence: ["target_text", "benefit_text"].map(field => ({ field, excerpt: display[field], rule: "합성 검수의 대상·지원 내용 확인" })),
      reason: "여섯 태그 관련성과 상세 자격 확인을 분리" } };
  const before = await dump();
  for (const modified of [
    { ...payload, relevance: { ...payload.relevance, categories: ["아동 돌봄"] } },
    { ...payload, relevance: { ...payload.relevance, conditionChecks: null } },
    { ...payload, relevance: { ...payload.relevance, evidence: payload.relevance.evidence.slice(0, 1) } },
    { ...payload, relevance: { ...payload.relevance, previousRelevance: {} } },
  ]) {
    await assert.rejects(command("relevance_store", modified), /INVALID_/);
    assert.deepEqual(await dump(), before);
  }
  assert.equal((await command("relevance_store", payload)).status, "RELATED");
  assert.equal((await command("relevance_store", payload)).replayed, true);
  const row = (await db.query<{ catalog_status: string; relevance: unknown; normalized: unknown }>("select catalog_status,relevance,normalized from public.policies")).rows[0];
  assert.equal(row.catalog_status, "ACTIVE");
  assert.deepEqual(row.normalized, original.expectedNormalized);
  assert.deepEqual(row.relevance, payload.relevance);
  await assert.rejects(command("relevance_store", pending), /STALE_REVIEW_DECISION/);
  assert.equal((await command("relevance_store", { ...original, relevance: { version: "policy-relevance-3", status: "REVIEW", categories: [], evidence: [], reason: "자동 분류" } })).preservedReviewed, true);
  await assert.rejects(command("relevance_store", { ...payload, relevance: { ...payload.relevance, reason: "변경" } }), /RELEVANCE_VERSION_CONFLICT/);
});


test("v6 excludes actual tag mismatches from pending v5 and prevents stale reactivation", async () => {
  const original = await pendingReviewActivation({ name: "대학생 장학금", target: "대학교 재학생", benefit: "대학 등록금 장학금" });
  const pending = { ...original, relevance: { version: "policy-relevance-review-5", status: "REVIEW", categories: [], evidence: [],
    previousRelevance: original.previousRelevance, conditionChecks: ["학교급 검토"], reason: "학교급 검토" } };
  await command("relevance_store", pending);
  const payload = { ...original, previousRelevance: pending.relevance,
    relevance: { version: "policy-relevance-review-6", status: "UNRELATED", categories: [], conditionChecks: [],
      previousRelevance: pending.relevance, reason: "대학 등록금은 아동 교육 태그에 미부합",
      evidence: [{ field: "benefit_text", excerpt: "대학 등록금 장학금", rule: "대학 등록금" }] } };
  const before = await dump();
  await assert.rejects(command("relevance_store", { ...payload, relevance: { ...payload.relevance, evidence: [{ field: "name", excerpt: "대학생 장학금", rule: "제목만 확인" }] } }), /INVALID_TAG_REVIEW/);
  assert.deepEqual(await dump(), before);
  assert.equal((await command("relevance_store", payload)).status, "UNRELATED");
  assert.equal((await command("relevance_store", payload)).replayed, true);
  const row = (await db.query<{ catalog_status: string; normalized: unknown }>("select catalog_status,normalized from public.policies")).rows[0];
  assert.equal(row.catalog_status, "EXCLUDED");
  assert.deepEqual(row.normalized, original.expectedNormalized);
  await assert.rejects(command("relevance_store", pending), /STALE_REVIEW_DECISION/);
  await assert.rejects(command("relevance_store", { ...payload, relevance: { ...payload.relevance, reason: "바뀐 판정" } }), /RELEVANCE_VERSION_CONFLICT/);
  assert.equal((await command("relevance_store", { ...original, relevance: original.previousRelevance })).preservedReviewed, true);
});

test("v6 activates matching tags from pending v5 and preserves condition checks", async () => {
  const original = await pendingReviewActivation({ name: "아동 진료비 지원", target: "지역 아동", benefit: "외래 진료비 지원" });
  const pending = { ...original, relevance: { version: "policy-relevance-review-5", status: "REVIEW", categories: [], evidence: [],
    previousRelevance: original.previousRelevance, conditionChecks: ["지원 연령 확인"], reason: "의료 지원 범위 검토" } };
  await command("relevance_store", pending);
  const display = original.expectedNormalized.display as Record<string, string>;
  const payload = { ...original, previousRelevance: pending.relevance,
    relevance: { version: "policy-relevance-review-6", status: "RELATED", categories: ["의료·건강"], conditionChecks: ["지원 연령 확인"],
      previousRelevance: pending.relevance, reason: "아동 외래 진료비 지원은 의료·건강 태그에 부합",
      evidence: ["target_text", "benefit_text"].map(field => ({ field, excerpt: display[field], rule: "대상과 의료 지원 내용을 함께 확인" })) } };
  assert.equal((await command("relevance_store", payload)).status, "RELATED");
  assert.equal((await command("relevance_store", payload)).replayed, true);
  const row = (await db.query<{ catalog_status: string; relevance: unknown }>("select catalog_status,relevance from public.policies")).rows[0];
  assert.equal(row.catalog_status, "ACTIVE");
  assert.deepEqual(row.relevance, payload.relevance);
  await assert.rejects(command("relevance_store", pending), /STALE_REVIEW_DECISION/);
});

test("v6 records genuinely unclear content without changing the pending catalog status", async () => {
  const original = await pendingReviewActivation({ name: "학생 지원", target: "학생", benefit: "지원 내용은 별도 안내" });
  const payload = { ...original,
    relevance: { version: "policy-relevance-review-6", status: "REVIEW", categories: [], evidence: [], conditionChecks: [],
      previousRelevance: original.previousRelevance, reason: "학교급과 실제 지원 내용이 없어 태그 관련성을 판단할 수 없음" } };
  assert.equal((await command("relevance_store", payload)).status, "REVIEW");
  assert.equal((await command("relevance_store", payload)).replayed, true);
  const row = (await db.query<{ catalog_status: string; relevance: unknown }>("select catalog_status,relevance from public.policies")).rows[0];
  assert.equal(row.catalog_status, "REVIEW");
  assert.deepEqual(row.relevance, payload.relevance);
  await assert.rejects(command("relevance_store", { ...payload, relevance: { ...payload.relevance, reason: "다른 보류 판정" } }), /RELEVANCE_VERSION_CONFLICT/);
});

test("신규 수집 v4는 여섯 태그와 직접 근거를 저장하고 이전 자동 평가의 덮어쓰기를 막는다", async () => {
  const lease = await start();
  await save(lease, page(1, ["v4-active"], 1));
  const bundle = raw("v4-active", "주민 의료비 지원");
  bundle.detail[0].tgtrDtlCn = "소득과 거주기간 기준을 충족하는 지역 주민";
  bundle.detail[0].alwServCn = "외래 진료비와 약제비 지원";
  const normalized = normalizeBokji(bundle);
  const { snapshotId } = await command<{ snapshotId: string }>("snapshot", {
    ...lease, externalId: "v4-active", raw: bundle, rawHash: normalized.rawHash,
    hashVersion: normalized.hashVersion, evidence: [],
  });
  const relevance = evaluateCollectionRelevance(normalized.display);
  assert.equal(relevance.status, "RELATED");
  await command("apply", {
    ...lease, externalId: "v4-active", snapshotId, normalized,
    quality: evaluatePolicyQuality(bundle, normalized), changes: { displayChanged: true }, relevance,
  });
  const row = (await db.query<{ source_id: string; catalog_status: string; relevance: typeof relevance }>(
    "select source_id,catalog_status,relevance from public.policies",
  )).rows[0];
  assert.equal(row.catalog_status, "ACTIVE");
  assert.deepEqual(row.relevance, relevance);
  const old = evaluatePolicyRelevance(normalized.display);
  const preserved = await command<{ preservedNewer: boolean }>("relevance_store", {
    sourceId: row.source_id, snapshotId, displayHash: normalized.displayHash,
    normalizerVersion: normalized.normalizerVersion, relevance: old,
  });
  assert.equal(preserved.preservedNewer, true);
  assert.deepEqual((await db.query<{ relevance: unknown }>("select relevance from public.policies")).rows[0].relevance, relevance);

  const before = await dump();
  await assert.rejects(command("relevance_store", {
    sourceId: row.source_id, snapshotId, displayHash: normalized.displayHash,
    normalizerVersion: normalized.normalizerVersion,
    relevance: { ...relevance, evidence: relevance.evidence.slice(0, 1) },
  }), /INVALID_COLLECTION_RELEVANCE/);
  assert.deepEqual(await dump(), before);
});

test("신규 수집 v4 보류는 v6 수동 검수로 이어지고 목록 제외는 이름 근거를 요구한다", async () => {
  const lease = await start();
  await save(lease, page(1, ["v4-review", "v4-out"], 2));
  const bundle = raw("v4-review", "지정 장학금");
  bundle.detail[0].tgtrDtlCn = "학생";
  bundle.detail[0].alwServCn = "장학금 지원";
  const normalized = normalizeBokji(bundle);
  const { snapshotId } = await command<{ snapshotId: string }>("snapshot", {
    ...lease, externalId: "v4-review", raw: bundle, rawHash: normalized.rawHash,
    hashVersion: normalized.hashVersion, evidence: [],
  });
  const previousRelevance = evaluateCollectionRelevance(normalized.display);
  assert.equal(previousRelevance.status, "REVIEW");
  await command("apply", {
    ...lease, externalId: "v4-review", snapshotId, normalized,
    quality: evaluatePolicyQuality(bundle, normalized), changes: { displayChanged: true }, relevance: previousRelevance,
  });
  const sourceId = (await db.query<{ source_id: string }>("select source_id from public.policies")).rows[0].source_id;
  const review = {
    version: "policy-relevance-review-6", status: "REVIEW", categories: [], evidence: [],
    conditionChecks: ["교육 대상 학교급 확인"], previousRelevance,
    reason: "학교급이 없어 아동 교육 관련성을 확정할 수 없음",
  };
  const payload = {
    sourceId, snapshotId, displayHash: normalized.displayHash,
    normalizerVersion: normalized.normalizerVersion, reviewOnly: true,
    expectedNormalized: normalized, previousRelevance, relevance: review,
  };
  assert.equal((await command("relevance_store", payload)).status, "REVIEW");
  assert.equal((await command("relevance_store", payload)).replayed, true);

  const outside = evaluateCollectionRelevance({ name: "중소기업 수출 장비 지원" });
  assert.equal(outside.status, "REVIEW");
  const outsideBundle = raw("v4-out", "중소기업 수출 장비 지원");
  outsideBundle.detail[0].tgtrDtlCn = "수출 중소기업";
  outsideBundle.detail[0].alwServCn = "수출 장비 구입비 지원";
  const outsideNormalized = normalizeBokji(outsideBundle);
  const outsideRelevance = evaluateCollectionRelevance(outsideNormalized.display);
  assert.equal(outsideRelevance.status, "UNRELATED");
  const outsideSnapshot = await command<{ snapshotId: string }>("snapshot", {
    ...lease, externalId: "v4-out", raw: outsideBundle,
    rawHash: outsideNormalized.rawHash, hashVersion: outsideNormalized.hashVersion, evidence: [],
  });
  const invalid = {
    ...outsideRelevance,
    evidence: outsideRelevance.evidence.map((evidence) =>
      evidence.field === "benefit_text"
        ? { ...evidence, excerpt: "장비 구입비 지원" }
        : evidence,
    ),
  };
  await assert.rejects(command("auto_exclude", {
    ...lease, externalId: "v4-out", phase: "DETAIL", snapshotId: outsideSnapshot.snapshotId,
    normalized: outsideNormalized, relevance: invalid,
  }), /INVALID_SCOPE_EXCLUSION/);
  assert.equal((await command("auto_exclude", {
    ...lease, externalId: "v4-out", phase: "DETAIL", snapshotId: outsideSnapshot.snapshotId,
    normalized: outsideNormalized, relevance: outsideRelevance,
  })).status, "EXCLUDED");
  const excluded = (await db.query<{
    scope_normalized: typeof outsideNormalized;
    scope_relevance: typeof outsideRelevance;
  }>("select scope_normalized,scope_relevance from public.policy_sync_items where run_id=$1 and external_id='v4-out'", [lease.runId])).rows[0];
  assert.deepEqual(excluded.scope_normalized, outsideNormalized);
  assert.deepEqual(excluded.scope_relevance, outsideRelevance);
  assert.equal((await db.query<{ count: number }>(
    "select count(*)::integer as count from public.policies p join public.policy_sources s on s.id=p.source_id where s.external_id='v4-out'",
  )).rows[0].count, 0);
});
