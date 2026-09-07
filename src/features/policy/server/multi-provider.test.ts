import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

let db: PGlite;
type Lease = {
  provider?: string;
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
  const lease = await command<Lease>("start", {
    runId: randomUUID(),
    trigger: "manual",
    scope: scope(ids),
    ...extra,
  });
  return { ...lease, ...extra };
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
    raw:
      lease.provider && lease.provider !== "GOV24"
        ? bokjiRaw(lease.provider, id, version)
        : raw(id, version, evidence),
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
async function current(provider?: string, id = "policy-a") {
  return command<Current | null>("current", { provider, externalId: id });
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
  await db.exec(
    await readFile(
      new URL(
        "../../../../supabase/migrations/20260907192856_policy_multiple_providers.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
beforeEach(async () => {
  await admin(
    "truncate public.policy_sync_locks, public.policy_sync_items, public.policies, public.policy_source_snapshots, public.policy_sources, public.policy_sync_runs; insert into public.policy_sync_locks(name) values ('GOV24'), ('BOKJIRO_CENTRAL'), ('BOKJIRO_LOCAL');",
  );
});
after(async () => {
  await db?.close();
});

const central = "BOKJIRO_CENTRAL";
const local = "BOKJIRO_LOCAL";
function bokjiRaw(provider: string, id = "policy-a", version = "A") {
  return {
    provider,
    apiVersion: "v1",
    externalId: id,
    list: { servId: id, servNm: version },
    detail: [{ servId: id, servNm: version }],
    xml: { list: "<list/>", detail: "<detail/>" },
    evidence: [],
  };
}

test("omitted provider preserves Gov24 while identical IDs remain independent across providers", async () => {
  const snapshots = [];
  for (const provider of [undefined, central, local]) {
    const lease = await start(undefined, { provider });
    const saved = await snapshot(lease);
    snapshots.push(saved.snapshotId);
    await apply(lease, saved.snapshotId);
    assert.equal((await finish(lease)).status, "SUCCESS");
    assert.equal((await current(provider))?.snapshotId, saved.snapshotId);
    const result = await command<{ run: { provider: string } }>("run", lease);
    assert.equal(result.run.provider, provider ?? "GOV24");
  }
  assert.equal(new Set(snapshots).size, 3);
  assert.equal((await current("GOV24"))?.snapshotId, snapshots[0]);
  assert.equal((await current(central))?.snapshotId, snapshots[1]);
  assert.equal((await current(local))?.snapshotId, snapshots[2]);
});

test("provider locks contend independently and foreign-provider run access is fenced", async () => {
  const first = await start(undefined, { provider: central });
  assert.equal(
    (await start(undefined, { provider: central })).status,
    "SKIPPED",
  );
  const other = await start(undefined, { provider: local });
  assert.equal(other.status, "RUNNING");
  assert.equal(await command("run", { ...first, provider: local }), null);
  await assert.rejects(
    start(undefined, { provider: local, resumeRunId: first.runId }),
    /INVALID_RESUME/,
  );
  for (const action of ["heartbeat", "snapshot", "apply", "fail", "finish"]) {
    await assert.rejects(
      command(action, {
        ...first,
        provider: local,
        externalId: "policy-a",
        calls: 0,
      }),
      /STALE_LEASE/,
    );
  }
  await command("heartbeat", first);
  await command("heartbeat", other);
  await finish(first);
  const resumed = await start(undefined, {
    provider: central,
    resumeRunId: first.runId,
  });
  assert.equal(resumed.runId, first.runId);
  assert.ok(resumed.generation > first.generation);
});

test("Bokji snapshot identity requires matching provider and string list/detail IDs", async () => {
  for (const provider of [central, local]) {
    const lease = await start(undefined, { provider });
    const valid = bokjiRaw(provider);
    for (const invalid of [
      { ...valid, provider: provider === central ? local : central },
      { ...valid, provider: undefined },
      { ...valid, externalId: "different" },
      { ...valid, list: { servId: "different" } },
      { ...valid, list: { servId: 123 } },
      { ...valid, detail: [{ servId: "different" }] },
      { ...valid, detail: [{ servId: 123 }] },
      { ...valid, detail: [] },
      { ...valid, detail: [...valid.detail, ...valid.detail] },
    ]) {
      await assert.rejects(
        command("snapshot", {
          ...lease,
          externalId: "policy-a",
          raw: invalid,
          rawHash: "A",
          hashVersion: "v1",
        }),
        /INVALID_RAW_IDENTITY/,
      );
    }
    assert.equal(await current(provider), null);
    const saved = await snapshot(lease);
    await apply(lease, saved.snapshotId);
    await finish(lease);
  }
});

test("reprocessing deduplicates raw snapshots and rejects another provider's snapshot", async () => {
  const first = await start(undefined, { provider: central });
  const a = await snapshot(first);
  await apply(first, a.snapshotId);
  await finish(first);
  const other = await start(undefined, { provider: local });
  const foreign = await snapshot(other);
  const next = await start(undefined, {
    provider: central,
    trigger: "reprocess",
  });
  const reused = await snapshot(next);
  assert.equal(reused.snapshotId, a.snapshotId);
  await assert.rejects(
    apply(next, foreign.snapshotId),
    /SNAPSHOT_SOURCE_MISMATCH/,
  );
  assert.equal((await current(central))?.snapshotId, a.snapshotId);
  await apply(next, reused.snapshotId);
  await finish(next);
  const repeated = await start(undefined, {
    provider: central,
    trigger: "reprocess",
  });
  assert.equal((await snapshot(repeated)).snapshotId, a.snapshotId);
  await apply(repeated, a.snapshotId);
  await finish(repeated);
  const result = await db.query<{ count: number }>(
    "select count(*)::int as count from public.policy_source_snapshots",
  );
  assert.equal(result.rows[0].count, 2);
});

test("Bokji apply rolls back display and pointer when item completion fails", async () => {
  const first = await start(undefined, { provider: local });
  const a = await snapshot(first);
  await apply(first, a.snapshotId);
  await finish(first);
  const next = await start(undefined, {
    provider: local,
    trigger: "reprocess",
  });
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
  assert.equal((await current(local))?.snapshotId, a.snapshotId);
  assert.deepEqual((await current(local))?.normalized.display, { name: "A" });
  const run = await command<{
    items: { status: string; before_snapshot_id: string | null }[];
  }>("run", next);
  assert.equal(run.items[0].status, "PENDING");
  assert.equal(run.items[0].before_snapshot_id, null);
});

test("migration preserves denied anonymous and authenticated table and RPC privileges", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`reset role; set role ${role}`);
    for (const table of [
      "policy_sources",
      "policy_source_snapshots",
      "policies",
      "policy_sync_runs",
      "policy_sync_items",
      "policy_sync_locks",
    ]) {
      await assert.rejects(
        db.query(`select * from public.${table}`),
        /permission denied/,
      );
    }
    for (const provider of ["GOV24", central, local]) {
      await assert.rejects(current(provider), /permission denied/);
      await assert.rejects(start(undefined, { provider }), /permission denied/);
    }
  }
  await db.exec("reset role; set role service_role");
});
