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
  __adminDataTestGuard?: () => Promise<void>;
};
state.__adminDataTestGuard = async () => {
  guardCalls++;
  if (!authorized) throw new Error("admin-required");
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only")
      return { url: "data:text/javascript,export {};", shortCircuit: true };
    if (specifier === "./auth")
      return {
        url: "data:text/javascript,export const requireAdmin = () => globalThis.__adminDataTestGuard();",
        shortCircuit: true,
      };
    return next(specifier, context);
  },
});
const { listUsers, listPolicies, relevanceOverview, catalogOverview } = await import(
  "./data.ts"
);
hooks.deregister();

test("admin reads guard before privileged requests, validate filters, and return safe projections", async (t) => {
  const oldUrl = process.env.SUPABASE_URL,
    oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "synthetic-private-secret";
  t.after(() => {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = oldKey;
    delete state.__adminDataTestGuard;
  });
  let response = new Response();
  let catalogMode = false;
  let requestUrl = new URL("https://example.invalid");
  let requestBody: string | undefined;
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      assert.ok(guardCalls > 0);
      requestUrl = new URL(String(input));
      requestBody = init?.body as string | undefined;
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.redirect, "error");
      assert.ok(init?.signal instanceof AbortSignal);
      assert.equal(
        new Headers(init?.headers).get("apikey"),
        "synthetic-private-secret",
      );
      assert.equal(new Headers(init?.headers).get("authorization"), null);
      if (catalogMode) {
        assert.equal(init?.method, "HEAD");
        assert.equal(new Headers(init?.headers).get("prefer"), "count=exact");
        assert.equal(requestUrl.pathname, "/rest/v1/policies");
        const status = requestUrl.searchParams.get("catalog_status");
        const provider = requestUrl.searchParams.get("policy_sources.provider");
        assert.ok(status === "eq.ACTIVE" || status === "eq.REVIEW");
        if (provider) {
          assert.equal(status, "eq.ACTIVE");
          assert.equal(requestUrl.searchParams.get("select"), "source_id,policy_sources!inner(provider)");
        }
        const counts: Record<string, number> = {
          "eq.BOKJIRO_CENTRAL": 40, "eq.BOKJIRO_LOCAL": 110, "eq.GOV24": 154,
        };
        const count = provider ? counts[provider] : status === "eq.ACTIVE" ? 304 : 352;
        assert.notEqual(count, undefined);
        return new Response(null, { headers: { "content-range": `*/${count}` } });
      }
      return response;
    },
  );

  authorized = false;
  await assert.rejects(listUsers(), /admin-required/);
  await assert.rejects(listPolicies(), /admin-required/);
  await assert.rejects(relevanceOverview(), /admin-required/);
  await assert.rejects(catalogOverview(), /admin-required/);
  await assert.rejects(
    listPolicies({ relevanceStatus: "RELATED", category: "양육·보육" }),
    /admin-required/,
  );
  assert.equal(fetchMock.mock.callCount(), 0);
  authorized = true;
  for (const page of [0, -1, 1.5, NaN, Infinity, 10_001]) {
    await assert.rejects(listUsers(page), /invalid-admin-page/);
    await assert.rejects(listPolicies({ page }), /invalid-admin-page/);
  }
  for (const query of ["foo*,id.eq.secret", "foo%", "foo_", "a".repeat(101)])
    await assert.rejects(listPolicies({ query }), /invalid-admin-query/);
  await assert.rejects(
    listPolicies({ provider: "GOV24,external_id.eq.secret" }),
    /invalid-admin-provider/,
  );
  await assert.rejects(
    listPolicies({ relevanceStatus: "RELATED,or=true" }),
    /invalid-admin-relevance-status/,
  );
  for (const catalogStatus of ["", "RELATED", "ACTIVE,or=true"])
    await assert.rejects(
      listPolicies({ catalogStatus }),
      /invalid-admin-catalog-status/,
    );
  for (const category of ['육아"],"secret":true', "a".repeat(81)])
    await assert.rejects(listPolicies({ category }), /invalid-admin-category/);
  assert.equal(fetchMock.mock.callCount(), 0);

  catalogMode = true;
  assert.deepEqual(await catalogOverview(), {
    active: 304, review: 352, sources: [
      { name: "복지로 중앙", count: 40 },
      { name: "복지로 지자체", count: 110 },
      { name: "Gov24", count: 154 },
    ],
  });
  catalogMode = false;
  for (const range of ["*/0", "*/12000"]) {
    response = new Response(null, { headers: { "content-range": range } });
    assert.equal((await catalogOverview()).active, Number(range.split("/")[1]));
  }
  for (const range of ["*/*", "*/-1", "*/1.5", "*/"]) {
    response = new Response(null, { headers: { "content-range": range } });
    await assert.rejects(catalogOverview(), /admin-response-invalid/);
  }

  const overview = {
    total: 10,
    related: 4,
    unrelated: 3,
    review: 2,
    unassessed: 1,
  };
  response = Response.json({ ...overview, secret: "excluded" });
  assert.deepEqual(await relevanceOverview(), overview);
  assert.equal(requestUrl.pathname, "/rest/v1/rpc/policy_admin_report");
  assert.deepEqual(JSON.parse(requestBody!), {
    p_action: "relevance_overview",
    p_filters: {},
  });
  for (const total of [-1, 1.5, "10", null]) {
    response = Response.json({ ...overview, total });
    await assert.rejects(relevanceOverview(), /admin-response-invalid/);
  }

  response = Response.json({
    users: [
      {
        id: "user-id",
        email: "alice@example.com",
        created_at: "2026-01-01",
        user_metadata: { phone: "private-phone" },
        app_metadata: { private: true },
        identities: [{ token: "private-token" }],
      },
    ],
  });
  assert.deepEqual(await listUsers(2), {
    items: [
      {
        id: "user-id",
        email: "a***@example.com",
        created_at: "2026-01-01",
        last_sign_in_at: null,
        banned_until: null,
      },
    ],
    page: 2,
    pageSize: 30,
    hasNext: false,
  });
  assert.equal(requestUrl.pathname, "/auth/v1/admin/users");
  assert.equal(requestUrl.searchParams.get("page"), "2");
  assert.equal(requestUrl.searchParams.get("per_page"), "30");

  const policy = {
    source_id: "policy-id",
    catalog_status: "ACTIVE",
    name: "육아 지원",
    source_url: "javascript:alert(1)",
    policy_sources: {
      provider: "GOV24",
      external_id: "service-id",
      private: "excluded",
    },
    normalized: { private: "excluded" },
    raw: "excluded",
  };
  response = Response.json(Array.from({ length: 31 }, () => policy));
  const policies = await listPolicies({
    query: "육아 지원",
    provider: "GOV24",
    page: 2,
  });
  assert.equal(policies.items.length, 30);
  assert.equal(policies.hasNext, true);
  assert.equal(policies.items[0].name, "육아 지원");
  assert.equal(policies.items[0].source_url, null);
  assert.equal(policies.items[0].relevance, null);
  assert.equal(policies.items[0].catalog_status, "ACTIVE");
  assert.equal(requestUrl.searchParams.get("catalog_status"), "eq.ACTIVE");
  assert.ok(
    requestUrl.searchParams
      .get("select")
      ?.split(",")
      .includes("catalog_status"),
  );
  assert.ok(!JSON.stringify(policies).includes("excluded"));
  assert.equal(
    requestUrl.searchParams.get("normalized->display->>name"),
    "ilike.*육아 지원*",
  );
  assert.equal(
    requestUrl.searchParams.get("policy_sources.provider"),
    "eq.GOV24",
  );
  assert.equal(requestUrl.searchParams.get("offset"), "30");
  assert.ok(
    requestUrl.searchParams
      .get("select")
      ?.includes("policy_sources!inner(provider,external_id)"),
  );

  const relevance = {
    version: "policy-relevance-1",
    status: "RELATED",
    categories: ["양육·보육"],
    evidence: [
      {
        field: "target_text",
        excerpt: "영유아 가정",
        rule: "childcare",
        private: "excluded",
      },
    ],
    reason: "육아 가정을 지원합니다.",
    private: "excluded",
  };
  response = Response.json([
    { ...policy, relevance, relevance_assessed_at: "2026-09-08T00:00:00Z" },
  ]);
  const related = await listPolicies({
    relevanceStatus: "RELATED",
    category: " 양육·보육 ",
  });
  assert.equal(requestUrl.searchParams.get("relevance->>status"), "eq.RELATED");
  assert.equal(requestUrl.searchParams.get("catalog_status"), "eq.ACTIVE");
  assert.equal(
    requestUrl.searchParams.get("relevance"),
    'cs.{"categories":["양육·보육"]}',
  );
  assert.deepEqual(related.items[0].relevance, {
    version: "policy-relevance-1",
    status: "RELATED",
    categories: ["양육·보육"],
    evidence: [
      { field: "target_text", excerpt: "영유아 가정", rule: "childcare" },
    ],
    reason: "육아 가정을 지원합니다.",
    truncated: false,
  });
  assert.equal(related.items[0].relevance_assessed_at, "2026-09-08T00:00:00Z");
  assert.ok(!JSON.stringify(related).includes("excluded"));
  for (const version of ["policy-relevance-2", "policy-relevance-3"]) {
    response = Response.json([{ ...policy, relevance: { ...relevance, version } }]);
    assert.equal((await listPolicies()).items[0].relevance?.version, version);
  }
  response = Response.json([
    { ...policy, relevance: { ...relevance, version: "unknown-version" } },
  ]);
  await assert.rejects(listPolicies(), /admin-response-invalid/);
  response = Response.json([{ ...policy, relevance }]);
  for (const status of ["UNRELATED", "REVIEW", "UNASSESSED", undefined]) {
    response = Response.json([policy]);
    await listPolicies({ relevanceStatus: status });
    assert.equal(
      requestUrl.searchParams.get("relevance->>status"),
      status === "UNASSESSED" ? "is.null" : status ? `eq.${status}` : null,
    );
    assert.equal(requestUrl.searchParams.get("relevance"), null);
  }
  for (const catalogStatus of ["ACTIVE", "REVIEW", "EXCLUDED", "ALL"]) {
    response = Response.json([
      {
        ...policy,
        catalog_status: catalogStatus === "ALL" ? "EXCLUDED" : catalogStatus,
      },
    ]);
    const catalog = await listPolicies({
      catalogStatus,
      relevanceStatus: "UNRELATED",
      category: "양육·보육",
      page: 2,
    });
    assert.equal(
      requestUrl.searchParams.get("catalog_status"),
      catalogStatus === "ALL" ? null : `eq.${catalogStatus}`,
    );
    assert.equal(
      catalog.items[0].catalog_status,
      catalogStatus === "ALL" ? "EXCLUDED" : catalogStatus,
    );
    assert.equal(
      requestUrl.searchParams.get("relevance->>status"),
      "eq.UNRELATED",
    );
    assert.equal(
      requestUrl.searchParams.get("relevance"),
      'cs.{"categories":["양육·보육"]}',
    );
    assert.equal(requestUrl.searchParams.get("offset"), "30");
  }
  for (const catalog_status of [undefined, null, "ALL", "RELATED", 42]) {
    response = Response.json([{ ...policy, catalog_status }]);
    await assert.rejects(listPolicies({ catalogStatus: "ALL" }), {
      message: "admin-response-invalid",
    });
  }
  for (const invalid of [
    { ...relevance, status: "PUBLIC" },
    { ...relevance, version: "unknown" },
    { ...relevance, categories: [42] },
    { ...relevance, reason: { secret: "excluded" } },
  ]) {
    response = Response.json([{ ...policy, relevance: invalid }]);
    await assert.rejects(listPolicies(), { message: "admin-response-invalid" });
  }

  response = Response.json([
    {
      ...policy,
      relevance: {
        ...relevance,
        evidence: Array.from({ length: 41 }, () => ({
          ...relevance.evidence[0],
          excerpt: "x".repeat(1001),
        })),
      },
    },
  ]);
  const bounded = (await listPolicies()).items[0].relevance;
  assert.equal(bounded?.truncated, true);
  assert.equal(bounded?.evidence.length, 40);
  assert.equal(bounded?.evidence[0].excerpt.length, 1000);

  response = new Response("reflected synthetic-private-secret", {
    status: 403,
  });
  await assert.rejects(listUsers(), { message: "admin-http-403" });
  response = new Response("synthetic-private-secret");
  await assert.rejects(listPolicies(), { message: "admin-response-invalid" });
  fetchMock.mock.mockImplementation(async () => {
    throw new Error("synthetic-private-secret");
  });
  await assert.rejects(listUsers(), { message: "admin-transport-failed" });
  process.env.SUPABASE_URL = "https://example.supabase.co.attacker.invalid";
  await assert.rejects(listUsers(), { message: "invalid-supabase-url" });
});
