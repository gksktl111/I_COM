import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import module from "node:module";
import { hashJson } from "./normalize.ts";

const { registerHooks } = module as unknown as {
  registerHooks(hooks: {
    resolve(
      specifier: string,
      context: unknown,
      next: (specifier: string, context: unknown) => unknown,
    ): unknown;
  }): { deregister(): void };
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only")
      return { url: "data:text/javascript,export {};", shortCircuit: true };
    return next(specifier, context);
  },
});
const { readRecommendationSourcePage } = await import(
  "./recommendation-sources.ts"
);
hooks.deregister();

const sourceId = "00000000-0000-0000-0000-000000000001";
function fixture() {
  const display = {
    name: "아동 지원",
    benefit_text: "지원 내용",
    source_url: "https://www.gov.kr/policy",
    application_url: "javascript:alert(1)",
    private: "hidden-display-field",
  };
  return {
    source_id: sourceId,
    applied_snapshot_id: "10000000-0000-0000-0000-000000000001",
    updated_at: "2026-09-11T00:00:00Z",
    raw: "hidden-raw",
    relevance: { reason: "hidden-assessment" },
    normalized: {
      display,
      displayHash: hashJson(display),
      normalizerVersion: "bokjiro-2",
      conditionsHash: "a".repeat(64),
      extra: "hidden-normalized-field",
    },
  };
}
function environment(t: TestContext) {
  const oldUrl = process.env.SUPABASE_URL,
    oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "synthetic-private-secret";
  t.after(() => {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = oldKey;
  });
}

test("source read binds normalized-only changes while projecting public display only", async (t) => {
  environment(t);
  const row = fixture();
  const mocked = t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/rest/v1/policy_active_candidates");
      assert.equal(
        url.searchParams.get("select"),
        "source_id,applied_snapshot_id,normalized,updated_at,relevance",
      );
      assert.equal(
        new Headers(init?.headers).get("apikey"),
        "synthetic-private-secret",
      );
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      assert.ok(init?.signal);
      return Response.json([row]);
    },
  );
  const first = (await readRecommendationSourcePage()).items[0];
  row.normalized.conditionsHash = "b".repeat(64);
  const second = (await readRecommendationSourcePage()).items[0];
  assert.deepEqual(first.policy, second.policy);
  assert.equal(first.source.displayHash, second.source.displayHash);
  assert.notEqual(
    first.source.normalizedFingerprint,
    second.source.normalizedFingerprint,
  );
  assert.equal(second.source.normalizedFingerprint, hashJson(row.normalized));
  assert.equal(first.policy.application_url, null);
  assert.doesNotMatch(
    JSON.stringify(first),
    /hidden-|synthetic-private-secret|"raw"|"normalized"|"relevance"/,
  );
  assert.doesNotMatch(
    JSON.stringify(first.policy),
    /snapshot|fingerprint|Hash|normalizer/i,
  );
  assert.equal(mocked.mock.callCount(), 2);
});

test("malformed source identities and rows fail the whole page without leaking upstream data", async (t) => {
  environment(t);
  let body: unknown = [];
  t.mock.method(globalThis, "fetch", async () => Response.json(body));
  const row = fixture();
  for (const bad of [
    null,
    [],
    {},
    { ...row, source_id: "wrong" },
    { ...row, applied_snapshot_id: null },
    { ...row, normalized: { ...row.normalized, normalizerVersion: "" } },
    { ...row, normalized: { ...row.normalized, displayHash: "wrong" } },
    { ...row, normalized: { ...row.normalized, display: { name: "" } } },
  ]) {
    body = [row, bad];
    await assert.rejects(readRecommendationSourcePage(), {
      message: "recommendation-data-unavailable",
    });
  }
  body = { secret: "upstream-error" };
  await assert.rejects(readRecommendationSourcePage(), {
    message: "recommendation-data-unavailable",
  });
  body = [row, row];
  await assert.rejects(readRecommendationSourcePage(), {
    message: "recommendation-data-unavailable",
  });
  body = [row];
  await assert.rejects(
    readRecommendationSourcePage({
      id: "00000000-0000-0000-0000-000000000002",
    }),
    { message: "recommendation-data-unavailable" },
  );
});

test("source paging preserves offsets and detail filters; invalid filters never call upstream", async (t) => {
  environment(t);
  let rows = Array.from({ length: 1000 }, (_, i) => ({
    ...fixture(),
    source_id: `00000000-0000-0000-0000-${String(i + 1).padStart(12, "0")}`,
  }));
  const urls: URL[] = [];
  const mocked = t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request) => {
      urls.push(new URL(String(input)));
      return Response.json(rows);
    },
  );
  assert.equal(
    (await readRecommendationSourcePage({ offset: 2000 })).nextOffset,
    3000,
  );
  rows = [];
  assert.deepEqual(await readRecommendationSourcePage({ offset: 3000 }), {
    items: [],
    nextOffset: null,
  });
  rows = [fixture()];
  assert.equal(
    (await readRecommendationSourcePage({ id: sourceId })).nextOffset,
    null,
  );
  assert.equal(urls[0].searchParams.get("offset"), "2000");
  assert.equal(urls[1].searchParams.get("offset"), "3000");
  const url = urls[2];
  assert.equal(url.searchParams.get("source_id"), `eq.${sourceId}`);
  assert.equal(url.searchParams.get("limit"), "1");
  const calls = mocked.mock.callCount();
  for (const id of ["bad", "id,or=(true)"])
    await assert.rejects(
      readRecommendationSourcePage({ id }),
      /invalid-policy-filter/,
    );
  for (const offset of [-1, 0.5, NaN, 100001])
    await assert.rejects(
      readRecommendationSourcePage({ offset }),
      /invalid-policy-filter/,
    );
  assert.equal(mocked.mock.callCount(), calls);
  process.env.SUPABASE_URL = "https://attacker.invalid";
  await assert.rejects(readRecommendationSourcePage(), {
    message: "recommendation-data-unavailable",
  });
  assert.equal(mocked.mock.callCount(), calls);
});
