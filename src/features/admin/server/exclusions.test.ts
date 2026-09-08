import assert from "node:assert/strict";
import { test } from "node:test";
import module from "node:module";

// Node 24 hooks isolate the Next server boundary without weakening production guards.
const { registerHooks } = module as unknown as {
  registerHooks(hooks: {
    resolve(
      specifier: string,
      context: unknown,
      next: (specifier: string, context: unknown) => unknown,
    ): unknown;
  }): { deregister(): void };
};
let authorized = true;
let guardCalls = 0;
const state = globalThis as typeof globalThis & {
  __adminExclusionsTestGuard?: () => Promise<void>;
};
state.__adminExclusionsTestGuard = async () => {
  guardCalls++;
  if (!authorized) throw new Error("admin-required");
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only")
      return { url: "data:text/javascript,export {};", shortCircuit: true };
    if (specifier === "./auth")
      return {
        url: "data:text/javascript,export const requireAdmin = () => globalThis.__adminExclusionsTestGuard();",
        shortCircuit: true,
      };
    return next(specifier, context);
  },
});
const { recentExclusions } = await import("./exclusions.ts");
hooks.deregister();

test("exclusion audit is guarded, projected and bounded", async (t) => {
  const oldUrl = process.env.SUPABASE_URL,
    oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "synthetic-private-secret";
  t.after(() => {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = oldKey;
    delete state.__adminExclusionsTestGuard;
  });
  const row = {
    run_id: "run-id",
    external_id: "policy-id",
    provider: "GOV24",
    scope_phase: "LIST",
    updated_at: "2026-09-08T00:00:00Z",
    scope_relevance: {
      version: "policy-relevance-1",
      status: "UNRELATED",
      categories: [],
      reason: "성인 전용 지원",
      evidence: [
        {
          field: "target_text",
          excerpt: "성인 전용",
          rule: "adult",
          raw: "excluded",
        },
      ],
    },
    raw: "excluded",
  };
  let payload: unknown = { items: [row], raw: "excluded" };
  const mock = t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      assert.ok(guardCalls > 0);
      assert.equal(
        new URL(String(input)).pathname,
        "/rest/v1/rpc/policy_admin_report",
      );
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.redirect, "error");
      assert.equal(
        new Headers(init?.headers).get("apikey"),
        "synthetic-private-secret",
      );
      assert.deepEqual(JSON.parse(init?.body as string), {
        p_action: "exclusions",
        p_filters: { limit: 30 },
      });
      return Response.json(payload);
    },
  );
  authorized = false;
  await assert.rejects(recentExclusions(), /admin-required/);
  assert.equal(mock.mock.callCount(), 0);
  authorized = true;
  assert.deepEqual(await recentExclusions(), [
    {
      run_id: "run-id",
      external_id: "policy-id",
      provider: "GOV24",
      phase: "LIST",
      updated_at: "2026-09-08T00:00:00Z",
      reason: "성인 전용 지원",
      evidence: [{ field: "target_text", excerpt: "성인 전용", rule: "adult" }],
      truncated: false,
    },
  ]);
  for (const version of ["policy-relevance-2", "policy-relevance-3"]) {
    payload = { items: [{ ...row, scope_relevance: { ...row.scope_relevance, version } }] };
    assert.equal((await recentExclusions()).length, 1);
  }
  payload = {
    items: [
      {
        ...row,
        scope_phase: "DETAIL",
        scope_relevance: {
          ...row.scope_relevance,
          evidence: Array.from({ length: 41 }, () => ({
            field: "target_text",
            excerpt: "x".repeat(1001),
            rule: "adult",
          })),
        },
      },
    ],
  };
  const [bounded] = await recentExclusions();
  assert.equal(bounded.phase, "DETAIL");
  assert.equal(bounded.truncated, true);
  assert.equal(bounded.evidence.length, 40);
  assert.equal(bounded.evidence[0].excerpt.length, 1000);
  for (const invalid of [
    { ...row, scope_phase: "UNKNOWN" },
    {
      ...row,
      scope_relevance: { ...row.scope_relevance, version: "unknown-version" },
    },
    { ...row, provider: "UNKNOWN" },
    { ...row, scope_relevance: { ...row.scope_relevance, status: "RELATED" } },
    {
      ...row,
      scope_relevance: { ...row.scope_relevance, evidence: [{ excerpt: 42 }] },
    },
  ]) {
    payload = { items: [invalid] };
    await assert.rejects(recentExclusions(), /admin-response-invalid/);
  }
  payload = { items: Array.from({ length: 31 }, () => row) };
  await assert.rejects(recentExclusions(), /admin-response-invalid/);
});
