import assert from "node:assert/strict";
import { test } from "node:test";
import module from "node:module";

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
  __directoryGuard?: () => Promise<void>;
};
state.__directoryGuard = async () => {
  guardCalls++;
  if (!authorized) throw new Error("admin-required");
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only")
      return { url: "data:text/javascript,export {};", shortCircuit: true };
    if (specifier === "./auth")
      return {
        url: "data:text/javascript,export const requireAdmin = () => globalThis.__directoryGuard();",
        shortCircuit: true,
      };
    if (specifier === "./auth-core")
      return {
        url: new URL("./auth-core.ts", import.meta.url).href,
        shortCircuit: true,
      };
    return next(specifier, context);
  },
});
const { loadUserDirectory, normalizeUserFilters } = await import(
  "./user-directory.ts"
);
hooks.deregister();

const now = Date.parse("2026-09-08T12:00:00Z");
const daysAgo = (days: number) =>
  new Date(now - days * 86_400_000).toISOString();
const user = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  email: `${id}@example.com`,
  created_at: daysAgo(50),
  email_confirmed_at: daysAgo(50),
  app_metadata: { provider: "email" },
  ...extra,
});

test("complete administrator user directory", async (t) => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-secret";
  t.after(() => {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = oldKey;
    delete state.__directoryGuard;
  });
  t.mock.method(Date, "now", () => now);
  let pages: unknown[][] = [];
  let calls = 0;
  let failPage = 0;
  const fetchMock = t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    assert.ok(guardCalls > 0);
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("per_page"), "1000");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    assert.equal(new Headers(init?.headers).get("apikey"), "test-secret");
    assert.equal(new Headers(init?.headers).get("authorization"), null);
    calls++;
    const page = Number(url.searchParams.get("page"));
    if (page === failPage) return new Response("unavailable", { status: 503 });
    return Response.json({ users: pages[page - 1] ?? [] });
  });

  await t.test("normalizes defaults and invalid filters", () => {
    assert.deepEqual(
      normalizeUserFilters({
        q: ["a", "b"],
        page: ["2"],
        perPage: ["15"],
        provider: ["google"],
      }),
      normalizeUserFilters(),
    );
    assert.deepEqual(normalizeUserFilters(), {
      q: "",
      provider: "all",
      status: "all",
      sort: "newest",
      activity: "all",
      perPage: 30,
      page: 1,
    });
    assert.deepEqual(
      normalizeUserFilters({
        q: `  ${"a".repeat(120)}  `,
        provider: "bad",
        status: "bad",
        sort: "bad",
        activity: "bad",
        perPage: "16",
        page: "1.5",
      }),
      {
        q: "a".repeat(100),
        provider: "all",
        status: "all",
        sort: "newest",
        activity: "all",
        perPage: 30,
        page: 1,
      },
    );
  });
  await t.test(
    "searches original email beyond first upstream page and applies intersecting filters",
    async () => {
      calls = 0;
      pages = [
        Array.from({ length: 1000 }, (_, i) => user(`first-${i}`)),
        [
          user("uuid-target", {
            email: "private.person@example.com",
            created_at: daysAgo(2),
            last_sign_in_at: daysAgo(3),
            app_metadata: {
              provider: "google",
              providers: ["google", "email"],
            },
            user_metadata: { private: "secret" },
            phone: "raw-phone",
            access_token: "token",
          }),
          user("wrong-provider", {
            email: "private.other@example.com",
            last_sign_in_at: daysAgo(3),
          }),
        ],
      ];
      const result = await loadUserDirectory({
        q: "PRIVATE.PERSON",
        provider: "google",
        status: "active",
        activity: "7d",
        page: "999",
        perPage: "15",
      });
      assert.equal(calls, 2);
      assert.equal(result.total, 1);
      assert.equal(result.summary.total, 1002);
      assert.equal(result.summary.recentlyJoined, 1);
      assert.equal(result.page, 1);
      assert.equal(result.filters.page, 1);
      assert.deepEqual(result.items[0], {
        id: "uuid-target",
        email: "p***@example.com",
        created_at: daysAgo(2),
        last_sign_in_at: daysAgo(3),
        banned_until: null,
        status: "active",
        providers: ["google"],
      });
      assert.equal((await loadUserDirectory({ q: "UUID-TARGET" })).total, 1);
      assert.equal(
        (await loadUserDirectory({ q: "private.person", provider: "naver" }))
          .total,
        0,
      );
    },
  );
  await t.test(
    "restrictions, legacy accounts and recent activity without confirmation states",
    async () => {
      pages = [
        [
          user("restricted", {
            email_confirmed_at: null,
            banned_until: daysAgo(-1),
          }),
          user("phone", {
            email_confirmed_at: null,
            phone_confirmed_at: daysAgo(2),
            banned_until: daysAgo(1),
            last_sign_in_at: daysAgo(20),
            app_metadata: { providers: ["naver", "github"] },
          }),
          user("legacy", { email_confirmed_at: null, app_metadata: {} }),
          user("recent", {
            last_sign_in_at: daysAgo(5),
            app_metadata: { provider: "kakao" },
          }),
          user("older", { last_sign_in_at: daysAgo(70) }),
        ],
      ];
      const result = await loadUserDirectory();
      assert.deepEqual(result.summary, {
        total: 5,
        recentlyJoined: 0,
        restricted: 1,
        recentlyActive: 2,
      });
      assert.equal(
        result.items.find((u) => u.id === "phone")?.status,
        "active",
      );
      assert.equal((await loadUserDirectory({ activity: "never" })).total, 2);
      assert.equal((await loadUserDirectory({ activity: "30d" })).total, 2);
      assert.equal((await loadUserDirectory({ activity: "90d" })).total, 3);
      assert.equal(
        (await loadUserDirectory({ status: "restricted" })).total,
        1,
      );
      assert.equal((await loadUserDirectory({ status: "active" })).total, 4);
      assert.equal(
        result.items.find((u) => u.id === "legacy")?.status,
        "active",
      );
      assert.deepEqual(
        result.items.find((u) => u.id === "legacy")?.providers,
        [],
      );
      assert.deepEqual(
        result.items.find((u) => u.id === "older")?.providers,
        [],
      );
      assert.deepEqual(result.items.find((u) => u.id === "phone")?.providers, [
        "naver",
      ]);
      assert.ok(result.items.every((u) => !("confirmed" in u)));
      for (const provider of ["email", "other"]) {
        const unfiltered = await loadUserDirectory({
          provider,
          status: "unconfirmed",
        });
        assert.equal(unfiltered.total, 5);
        assert.equal(unfiltered.filters.provider, "all");
        assert.equal(unfiltered.filters.status, "all");
      }
    },
  );
  await t.test(
    "sorts and clamps pagination after filtering, with null dates last",
    async () => {
      pages = [
        [
          user("old", { created_at: daysAgo(80), last_sign_in_at: daysAgo(1) }),
          user("new", { created_at: daysAgo(1), last_sign_in_at: daysAgo(5) }),
          user("missing", { created_at: null }),
        ],
      ];
      assert.deepEqual(
        (await loadUserDirectory()).items.map((u) => u.id),
        ["new", "old", "missing"],
      );
      assert.deepEqual(
        (await loadUserDirectory({ sort: "oldest" })).items.map((u) => u.id),
        ["old", "new", "missing"],
      );
      assert.deepEqual(
        (await loadUserDirectory({ sort: "recent_login" })).items.map(
          (u) => u.id,
        ),
        ["old", "new", "missing"],
      );
      pages = [Array.from({ length: 31 }, (_, i) => user(String(i)))];
      const result = await loadUserDirectory({ perPage: "15", page: "999" });
      assert.equal(result.page, 3);
      assert.equal(result.items.length, 1);
      const empty = await loadUserDirectory({ q: "absent", page: "999" });
      assert.equal(empty.page, 1);
      assert.equal(empty.total, 0);
    },
  );
  await t.test("guard rejects before any privileged request", async () => {
    authorized = false;
    calls = 0;
    try {
      await assert.rejects(loadUserDirectory(), /admin-required/);
      assert.equal(calls, 0);
    } finally {
      authorized = true;
    }
  });
  await t.test(
    "fails on late upstream error and duplicate IDs instead of returning partial totals",
    async () => {
      pages = [
        Array.from({ length: 1000 }, (_, i) => user(`u-${i}`)),
        [user("u-0")],
      ];
      failPage = 2;
      await assert.rejects(loadUserDirectory(), /ADMIN_USERS_FETCH_FAILED/);
      failPage = 0;
      await assert.rejects(
        loadUserDirectory(),
        /ADMIN_USERS_UNSTABLE_PAGINATION/,
      );
      pages = [[{ id: 1 }]];
      await assert.rejects(loadUserDirectory(), /ADMIN_USERS_INVALID_RESPONSE/);
    },
  );
  await t.test(
    "fails when a full hundredth page cannot establish completion",
    async () => {
      calls = 0;
      fetchMock.mock.mockImplementation(async () => {
        const page = calls++;
        return Response.json({
          users: Array.from({ length: 1000 }, (_, i) => user(`${page}-${i}`)),
        });
      });
      await assert.rejects(loadUserDirectory(), /ADMIN_USERS_PAGE_LIMIT/);
      assert.equal(calls, 100);
    },
  );
  await t.test(
    "enforces total time budget even across successful responses",
    async (st) => {
      let elapsed = 0;
      st.mock.method(performance, "now", () => elapsed);
      fetchMock.mock.mockImplementation(async () => {
        elapsed = 30_001;
        return Response.json({ users: [] });
      });
      await assert.rejects(loadUserDirectory(), /ADMIN_USERS_TIME_LIMIT/);
    },
  );
});
