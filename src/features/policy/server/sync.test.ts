import assert from "node:assert/strict";
import { test } from "node:test";
import { syncPolicies, modificationHold } from "./sync.ts";
import { normalizeBundle } from "./normalize.ts";
import type { RawBundle } from "./normalize.ts";
import type { PolicyRepository } from "./repository.ts";

const selected = Array.from({ length: 5 }, (_, i) => ({
  id: String(i),
  reason: "synthetic",
  filters: { "cond[서비스명::LIKE]": "test" },
}));
function bundle(id: string): RawBundle {
  return {
    externalId: id,
    apiVersion: "v3",
    list: { 서비스ID: id, 서비스명: "test", 수정일시: "20260907000000" },
    detail: [{ 서비스ID: id, 서비스명: "test", 수정일시: "2026-09-07" }],
    conditions: [{ 서비스ID: id, JA0110: 0 }],
    evidence: [],
  };
}
function api(counter: { calls: number }, failId?: string): typeof fetch {
  return async (input) => {
    counter.calls++;
    const u = new URL(String(input)),
      ep = u.pathname.split("/").at(-1),
      id = u.searchParams.get("cond[서비스ID::EQ]") ?? "0";
    const page = Number(u.searchParams.get("page")),
      perPage = Number(u.searchParams.get("perPage"));
    if (ep === "serviceDetail" && id === failId)
      return new Response("{}", { status: 400 });
    const b = bundle(id),
      all =
        ep === "serviceList"
          ? selected.map((s) => bundle(s.id).list)
          : ep === "serviceDetail"
            ? b.detail
            : b.conditions;
    const data = all.slice((page - 1) * perPage, page * perPage);
    return new Response(
      JSON.stringify({
        page,
        perPage,
        currentCount: data.length,
        matchCount: all.length,
        totalCount: 5,
        data,
      }),
    );
  };
}
test("dry-run makes API requests and comparisons but zero lease/run/item writes", async () => {
  const actions: string[] = [],
    counter = { calls: 0 };
  const repository: PolicyRepository = {
    async command<T>(action: string) {
      actions.push(action);
      assert.equal(action, "current");
      return null as T;
    },
  };
  const result = await syncPolicies({
    repository,
    selected,
    dryRun: true,
    trigger: "manual",
    key: "test-key",
    budget: 30,
    perPage: 5,
    maxPages: 3,
    fetcher: api(counter),
  });
  assert.equal(result.status, "SUCCESS");
  assert.equal(counter.calls, 22);
  assert.equal(actions.length, 5);
});
test("failed detail holds one policy while other policies finish", async () => {
  const counter = { calls: 0 };
  const repository: PolicyRepository = {
    async command<T>() {
      return null as T;
    },
  };
  const result = await syncPolicies({
    repository,
    selected,
    dryRun: true,
    trigger: "manual",
    key: "test-key",
    budget: 30,
    perPage: 5,
    maxPages: 3,
    fetcher: api(counter, "1"),
  });
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.items.filter((i) => i.status === "SUCCESS").length, 4);
  assert.equal(result.items.find((i) => i.id === "1")?.status, "FAILED");
});
test("reprocess uses stored snapshots with no network", async () => {
  const repository: PolicyRepository = {
    async command<T>(action: string, p: Record<string, unknown>) {
      assert.equal(action, "current");
      const raw = bundle(String(p.externalId));
      return { snapshotId: "s", raw, normalized: normalizeBundle(raw) } as T;
    },
  };
  const result = await syncPolicies({
    repository,
    selected,
    dryRun: true,
    trigger: "reprocess",
    budget: 1,
    perPage: 5,
    maxPages: 3,
    fetcher: async () => {
      throw Error("network forbidden");
    },
  });
  assert.equal(result.status, "SUCCESS");
  assert.equal(result.calls, 0);
  assert.ok(result.items.every((i) => i.changes?.rawChanged === false));
});
test("older or unverified dates never replace current policy", () => {
  const current = normalizeBundle(bundle("1")),
    older = bundle("1");
  older.detail[0]["수정일시"] = "2026-09-06";
  assert.equal(
    modificationHold(current, normalizeBundle(older)),
    "modification-time-regressed",
  );
  older.detail[0]["수정일시"] = null;
  assert.equal(
    modificationHold(current, normalizeBundle(older)),
    "unverified-modification-time",
  );
});
