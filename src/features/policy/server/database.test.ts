import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

let db: PGlite;
type Lease = {
  runId: string;
  generation: number;
  status: string;
  completedIds: string[];
};
type Current = {
  snapshotId: string;
  raw: Record<string, unknown>;
  normalized: Record<string, unknown>;
};
const scope = (ids = ["policy-a"]) =>
  ids.map((id) => ({
    id,
    reason: "SQL behavior fixture",
    filters: { "cond[서비스명::LIKE]": "양육" },
  }));
async function command<T = Record<string, unknown>>(
  action: string,
  payload: object,
): Promise<T> {
  const result = await db.query<{ value: T }>(
    "select public.policy_sync_command($1,$2::jsonb) as value",
    [action, JSON.stringify(payload)],
  );
  return result.rows[0].value;
}
async function admin(sql: string) {
  await db.exec("reset role");
  try {
    return await db.exec(sql);
  } finally {
    await db.exec("set role service_role");
  }
}
async function start(ids = ["policy-a"], extra: object = {}) {
  return command<Lease>("start", {
    runId: randomUUID(),
    trigger: "manual",
    scope: scope(ids),
    ...extra,
  });
}
function raw(id: string, version: string, evidence = "first") {
  return {
    externalId: id,
    apiVersion: "v3",
    list: { 서비스ID: id, 서비스명: version },
    detail: [{ 서비스ID: id, 서비스명: version }],
    conditions: [{ 서비스ID: id, JA0101: "Y" }],
    evidence: [{ at: evidence }],
  };
}
async function snapshot(
  lease: Lease,
  id = "policy-a",
  version = "A",
  evidence = "first",
) {
  return command<{ snapshotId: string }>("snapshot", {
    ...lease,
    externalId: id,
    raw: raw(id, version, evidence),
    rawHash: version,
    hashVersion: "v1",
    evidence: [{ at: evidence }],
  });
}
async function apply(
  lease: Lease,
  snapshotId: string,
  id = "policy-a",
  version = "A",
) {
  return command("apply", {
    ...lease,
    externalId: id,
    snapshotId,
    normalized: {
      display: { name: version },
      rawHash: version,
      hashVersion: "v1",
      normalizerVersion: "v1",
      displayHash: version,
    },
    changes: { displayChanged: true },
  });
}
async function current(id = "policy-a") {
  return command<Current | null>("current", { externalId: id });
}
async function finish(lease: Lease) {
  return command("finish", { ...lease, calls: 4 });
}

before(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated, service_role;",
  );
  await db.exec(
    await readFile(
      new URL(
        "../../../../supabase/migrations/20260907181933_policy_ingestion.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
beforeEach(async () => {
  await admin(
    "truncate public.policy_sync_locks, public.policy_sync_items, public.policies, public.policy_source_snapshots, public.policy_sources, public.policy_sync_runs; insert into public.policy_sync_locks(name) values ('GOV24');",
  );
});
after(async () => {
  await db?.close();
});

test("snapshot reuse preserves A→B→A application history and this-run evidence", async () => {
  assert.equal(await current(), null);
  const first = await start();
  const a = await snapshot(first);
  await apply(first, a.snapshotId);
  assert.deepEqual(await finish(first), {
    status: "SUCCESS",
    success: 1,
    failed: 0,
    pending: 0,
  });
  const second = await start();
  const b = await snapshot(second, "policy-a", "B");
  await apply(second, b.snapshotId, "policy-a", "B");
  await finish(second);
  const third = await start();
  const reused = await snapshot(third, "policy-a", "A", "later");
  assert.equal(reused.snapshotId, a.snapshotId);
  await apply(third, reused.snapshotId);
  await finish(third);
  assert.equal((await current())?.snapshotId, a.snapshotId);
  const rows = await db.query<{ count: number }>(
    "select count(*)::int as count from public.policy_source_snapshots",
  );
  assert.equal(rows.rows[0].count, 2);
  const run = await command<{
    items: { before_snapshot_id: string; evidence: unknown }[];
  }>("run", third);
  assert.equal(run.items[0].before_snapshot_id, b.snapshotId);
  assert.deepEqual(run.items[0].evidence, [{ at: "later" }]);
  assert.deepEqual((await current())?.raw.evidence, [{ at: "first" }]);
  await assert.rejects(command("heartbeat", third), /STALE_LEASE/);
});

test("failed item update rolls back the earlier display write and pointer atomically", async () => {
  const first = await start();
  const a = await snapshot(first);
  await apply(first, a.snapshotId);
  await finish(first);
  const next = await start();
  const b = await snapshot(next, "policy-a", "B");
  await admin(`create function public.test_reject_success() returns trigger language plpgsql as $$ begin
    if new.status = 'SUCCESS' then raise exception 'FORCED_ITEM_FAILURE'; end if; return new; end $$;
    create trigger test_reject_success before update on public.policy_sync_items for each row execute function public.test_reject_success();`);
  try {
    await assert.rejects(
      apply(next, b.snapshotId, "policy-a", "B"),
      /FORCED_ITEM_FAILURE/,
    );
  } finally {
    await admin(
      "drop trigger test_reject_success on public.policy_sync_items; drop function public.test_reject_success();",
    );
  }
  assert.equal((await current())?.snapshotId, a.snapshotId);
  assert.deepEqual((await current())?.normalized.display, { name: "A" });
  const run = await command<{
    items: { status: string; before_snapshot_id: string | null }[];
  }>("run", next);
  assert.equal(run.items[0].status, "PENDING");
  assert.equal(run.items[0].before_snapshot_id, null);
  await command("fail", {
    ...next,
    externalId: "policy-a",
    errorCode: "APPLY_FAILED",
  });
  assert.equal((await current())?.snapshotId, a.snapshotId);
  assert.deepEqual(await finish(next), {
    status: "FAILED",
    success: 0,
    failed: 1,
    pending: 0,
  });
});

test("lease contention skips; expiry and generation fencing reject stale writers", async () => {
  const first = await start();
  const skipped = await start();
  assert.equal(skipped.status, "SKIPPED");
  assert.notEqual(skipped.runId, first.runId);
  await assert.rejects(snapshot(skipped), /STALE_LEASE/);
  await assert.rejects(
    command("heartbeat", { ...first, generation: first.generation + 1 }),
    /STALE_LEASE/,
  );
  await admin(
    "update public.policy_sync_locks set expires_at = clock_timestamp() - interval '1 second'",
  );
  for (const action of ["heartbeat", "snapshot", "apply", "fail", "finish"]) {
    await assert.rejects(
      command(action, { ...first, externalId: "policy-a", calls: 0 }),
      /STALE_LEASE/,
    );
  }
  const takeover = await start();
  assert.ok(takeover.generation > first.generation);
  await assert.rejects(snapshot(first), /STALE_LEASE/);
  await command("heartbeat", takeover);
  assert.deepEqual(await finish(takeover), {
    status: "FAILED",
    success: 0,
    failed: 0,
    pending: 1,
  });
});

test("resume preserves SUCCESS, resets unfinished bundle, and rejects changed scope/trigger", async () => {
  const first = await start(["policy-a", "policy-b"]);
  const a = await snapshot(first);
  await apply(first, a.snapshotId);
  await snapshot(first, "policy-b");
  assert.deepEqual(await finish(first), {
    status: "PARTIAL",
    success: 1,
    failed: 0,
    pending: 1,
  });
  await assert.rejects(
    start(["policy-a"], { resumeRunId: first.runId }),
    /INVALID_RESUME/,
  );
  await assert.rejects(
    start(["policy-a", "policy-b"], {
      resumeRunId: first.runId,
      trigger: "scheduled",
    }),
    /INVALID_RESUME/,
  );
  const resumed = await start(["policy-a", "policy-b"], {
    resumeRunId: first.runId,
  });
  assert.equal(resumed.runId, first.runId);
  assert.ok(resumed.generation > first.generation);
  assert.deepEqual(resumed.completedIds, ["policy-a"]);
  for (const action of ["snapshot", "apply", "fail"])
    await assert.rejects(
      command(action, { ...resumed, externalId: "policy-a" }),
      /ITEM_ALREADY_SUCCESS/,
    );
  const run = await command<{
    items: { external_id: string; snapshot_id: string | null }[];
  }>("run", resumed);
  assert.equal(
    run.items.find((x) => x.external_id === "policy-b")?.snapshot_id,
    null,
  );
  const b = await snapshot(resumed, "policy-b");
  await apply(resumed, b.snapshotId, "policy-b");
  assert.equal((await finish(resumed)).status, "SUCCESS");
  await assert.rejects(
    start(["policy-a", "policy-b"], { resumeRunId: first.runId }),
    /INVALID_RESUME/,
  );
});

test("scope, source ownership, raw identity and hash reuse are checked before applying", async () => {
  const lease = await start(["policy-a", "policy-b", "123"]);
  await assert.rejects(snapshot(lease, "outside"), /OUTSIDE_SCOPE/);
  await assert.rejects(
    command("snapshot", {
      ...lease,
      externalId: "policy-a",
      raw: raw("policy-b", "A"),
      rawHash: "A",
      hashVersion: "v1",
    }),
    /INVALID_RAW_IDENTITY/,
  );
  await assert.rejects(
    command("snapshot", {
      ...lease,
      externalId: "123",
      raw: { ...raw("123", "A"), list: { 서비스ID: 123 } },
      rawHash: "A",
      hashVersion: "v1",
    }),
    /INVALID_RAW_IDENTITY/,
  );
  const a = await snapshot(lease);
  const b = await snapshot(lease, "policy-b");
  await assert.rejects(apply(lease, b.snapshotId), /SNAPSHOT_SOURCE_MISMATCH/);
  assert.equal(await current(), null);
  await assert.rejects(
    command("snapshot", {
      ...lease,
      externalId: "policy-a",
      raw: raw("policy-a", "changed"),
      rawHash: "A",
      hashVersion: "v1",
    }),
    /RAW_HASH_COLLISION/,
  );
  await assert.rejects(
    db.query(
      "insert into public.policies(source_id,applied_snapshot_id,normalized) select id,$1,'{}'::jsonb from public.policy_sources where external_id='policy-a'",
      [b.snapshotId],
    ),
    /foreign key/,
  );
  await apply(lease, a.snapshotId);
  assert.equal((await current())?.snapshotId, a.snapshotId);
});

test("anonymous and authenticated roles cannot read tables or call RPC; server cannot delete", async () => {
  const tables = [
    "policy_sources",
    "policy_source_snapshots",
    "policies",
    "policy_sync_runs",
    "policy_sync_items",
    "policy_sync_locks",
  ];
  const flags = await db.query<{ relrowsecurity: boolean }>(
    "select relrowsecurity from pg_class where relnamespace = 'public'::regnamespace and relname = any($1)",
    [tables],
  );
  assert.equal(flags.rows.length, tables.length);
  assert.ok(flags.rows.every((x) => x.relrowsecurity));
  const security = await db.query<{ prosecdef: boolean; proconfig: string[] }>(
    "select prosecdef, proconfig from pg_proc where oid = 'public.policy_sync_command(text,jsonb)'::regprocedure",
  );
  assert.equal(security.rows[0].prosecdef, false);
  assert.ok(
    security.rows[0].proconfig.includes("search_path=pg_catalog, public"),
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`reset role; set role ${role}`);
    for (const table of tables)
      await assert.rejects(
        db.query(`select * from public.${table}`),
        /permission denied/,
      );
    await assert.rejects(
      command("current", { externalId: "policy-a" }),
      /permission denied/,
    );
  }
  await db.exec("reset role; set role service_role");
  await start();
  for (const table of tables)
    await assert.rejects(
      db.query(`delete from public.${table}`),
      /permission denied/,
    );
});

test("failed and interrupted evidence survives resume, replacement and later success", async () => {
  const first = await start(["policy-a", "policy-b"]);
  const rejectedEvidence = {
    raw: { unsupported: "normalization failed before snapshot" },
  };
  await command("fail", {
    ...first,
    externalId: "policy-a",
    errorCode: "NORMALIZATION_FAILED",
    evidence: rejectedEvidence,
  });
  const interrupted = await snapshot(first, "policy-b", "A", "interrupted");
  await finish(first);
  const resumed = await start(["policy-a", "policy-b"], {
    resumeRunId: first.runId,
  });
  const a = await snapshot(resumed);
  await apply(resumed, a.snapshotId);
  const replaced = await snapshot(resumed, "policy-b", "B", "replaced");
  const b = await snapshot(resumed, "policy-b", "C", "successful");
  await apply(resumed, b.snapshotId, "policy-b", "C");
  await finish(resumed);
  type Item = {
    external_id: string;
    status: string;
    error_code: string | null;
    attempt_history: {
      state: string;
      errorCode: string | null;
      evidence: unknown;
      snapshotId: string | null;
      attempt: number;
      at: string;
    }[];
  };
  const result = await command<{ items: Item[] }>("run", resumed);
  const aItem = result.items.find((x) => x.external_id === "policy-a")!;
  assert.equal(aItem.status, "SUCCESS");
  assert.equal(aItem.error_code, null);
  assert.equal(aItem.attempt_history[0].errorCode, "NORMALIZATION_FAILED");
  assert.deepEqual(aItem.attempt_history[0].evidence, rejectedEvidence);
  assert.equal(aItem.attempt_history[0].snapshotId, null);
  assert.equal(aItem.attempt_history[0].attempt, 1);
  assert.ok(aItem.attempt_history[0].at);
  const bHistory = result.items.find(
    (x) => x.external_id === "policy-b",
  )!.attempt_history;
  assert.deepEqual(
    bHistory.map((x) => [x.state, x.snapshotId, x.evidence]),
    [
      ["INCOMPLETE", interrupted.snapshotId, [{ at: "interrupted" }]],
      ["INCOMPLETE", replaced.snapshotId, [{ at: "replaced" }]],
    ],
  );
});

test("raw-only changes update the applied pointer while preserving display timestamp", async () => {
  const first = await start();
  const a = await snapshot(first);
  await apply(first, a.snapshotId);
  await finish(first);
  const timestamp = async () =>
    (
      await db.query<{ value: string }>(
        "select updated_at::text as value from public.policies",
      )
    ).rows[0].value;
  const originalTime = await timestamp();
  const next = await start();
  const b = await snapshot(next, "policy-a", "B");
  await command("apply", {
    ...next,
    externalId: "policy-a",
    snapshotId: b.snapshotId,
    normalized: {
      display: { name: "A" },
      rawHash: "B",
      displayHash: "A",
      hashVersion: "v1",
      normalizerVersion: "v1",
      warnings: ["raw changed"],
    },
    changes: { rawChanged: true, displayChanged: false },
  });
  await finish(next);
  assert.equal((await current())?.snapshotId, b.snapshotId);
  assert.equal(await timestamp(), originalTime);
  assert.deepEqual((await current())?.normalized.warnings, ["raw changed"]);
  const renormalize = await start();
  await snapshot(renormalize, "policy-a", "B");
  await command("apply", {
    ...renormalize,
    externalId: "policy-a",
    snapshotId: b.snapshotId,
    normalized: {
      display: { name: "A" },
      rawHash: "B",
      displayHash: "A",
      hashVersion: "v1",
      normalizerVersion: "v2",
    },
    changes: {},
  });
  assert.notEqual(await timestamp(), originalTime);
});
