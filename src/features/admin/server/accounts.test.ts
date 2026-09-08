import assert from "node:assert/strict";
import { test } from "node:test";
import module from "node:module";

const admin = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.test",
  email_confirmed_at: "2026-09-08",
  app_metadata: { role: "admin" },
};
const targetId = "22222222-2222-4222-8222-222222222222";
const secret = "synthetic-private-password";
const boundary = {
  token: "verified-token" as string | undefined,
  writes: [] as {
    name: string;
    value: string;
    options: Record<string, unknown>;
  }[],
  revalidations: [] as string[],
  cookies: async () => ({
    get: () => (boundary.token ? { value: boundary.token } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      boundary.writes.push({ name, value, options });
    },
  }),
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
};
const globals = globalThis as typeof globalThis & {
  __adminAccountsTest?: typeof boundary;
};
globals.__adminAccountsTest = boundary;
const { registerHooks } = module as unknown as {
  registerHooks(hooks: {
    resolve(
      specifier: string,
      context: unknown,
      next: (specifier: string, context: unknown) => unknown,
    ): unknown;
  }): { deregister(): void };
};
const source = (code: string) => ({
  url: `data:text/javascript,${encodeURIComponent(code)}`,
  shortCircuit: true,
});
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return source("export {};");
    if (specifier === "next/headers")
      return source(
        "export const cookies = () => globalThis.__adminAccountsTest.cookies();",
      );
    if (specifier === "next/navigation")
      return source(
        "export const redirect = url => globalThis.__adminAccountsTest.redirect(url);",
      );
    if (specifier === "next/cache")
      return source(
        "export const revalidatePath = path => globalThis.__adminAccountsTest.revalidations.push(path);",
      );
    for (const name of ["auth", "auth-core", "accounts"]) {
      if (
        specifier === `./${name}` ||
        specifier === `@/features/admin/server/${name}`
      )
        return {
          url: new URL(`./${name}.ts`, import.meta.url).href,
          shortCircuit: true,
        };
    }
    return next(specifier, context);
  },
});
const { listAdminAccounts, registerAdminAccount, updateAdminPassword } =
  await import("./accounts.ts");
const { createAdminAccount, changeAdminPassword } = await import(
  "../../../app/admin/(protected)/accounts/actions.ts"
);
hooks.deregister();

function form(overrides: Record<string, string> = {}) {
  const value = new FormData();
  for (const [key, entry] of Object.entries({
    email: " New@Example.Test ",
    password: secret,
    confirm: secret,
    targetId,
    ...overrides,
  }))
    value.set(key, entry);
  return value;
}

test("administrator account management boundaries", async (t) => {
  const saved = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SECRET_KEY,
  };
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "synthetic-service-key";
  t.after(() => {
    if (saved.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = saved.key;
    delete globals.__adminAccountsTest;
  });
  const requests: { path: string; method: string; init?: RequestInit }[] = [];
  let verifiedUser: unknown = admin;
  let respond: (path: string, init?: RequestInit) => Response = () =>
    Response.json({});
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "https://test.supabase.co");
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.redirect, "error");
      if (url.pathname === "/auth/v1/user") return Response.json(verifiedUser);
      const path = url.pathname.slice("/auth/v1/".length) + url.search;
      requests.push({ path, method: init?.method ?? "GET", init });
      return respond(path, init);
    },
  );
  function reset() {
    requests.length = 0;
    boundary.writes.length = 0;
    boundary.revalidations.length = 0;
    boundary.token = "verified-token";
    verifiedUser = admin;
    respond = () => Response.json({});
  }

  await t.test(
    "unauthenticated and ordinary users cannot read or mutate through services or direct actions",
    async () => {
      for (const token of [undefined, "ordinary-token"]) {
        reset();
        boundary.token = token;
        verifiedUser = {
          ...admin,
          app_metadata: {},
          user_metadata: { role: "admin" },
        };
        for (const operation of [
          () => listAdminAccounts(),
          () => registerAdminAccount(form()),
          () => updateAdminPassword(form()),
          () => createAdminAccount({}, form()),
          () => changeAdminPassword({}, form()),
        ])
          await assert.rejects(operation(), {
            message: "REDIRECT:/admin/login",
          });
        assert.equal(requests.length, 0);
        assert.equal(boundary.writes.length, 0);
        assert.equal(boundary.revalidations.length, 0);
      }
    },
  );

  await t.test(
    "list filters administrators and projects only display fields, preserving scanned-page navigation",
    async () => {
      reset();
      const record = {
        ...admin,
        created_at: "2026-01-01",
        last_sign_in_at: "2026-09-08",
        password: secret,
        encrypted_password: secret,
        user_metadata: { phone: secret },
        identities: [{ token: secret }],
        access_token: secret,
      };
      respond = () =>
        Response.json({
          users: [
            record,
            {
              ...record,
              id: targetId,
              app_metadata: {},
              user_metadata: { role: "admin" },
            },
          ],
        });
      assert.deepEqual(await listAdminAccounts(2), {
        items: [
          {
            id: admin.id,
            email: admin.email,
            created_at: record.created_at,
            last_sign_in_at: record.last_sign_in_at,
            confirmed: true,
          },
        ],
        page: 2,
        hasNext: false,
      });
      assert.equal(requests[0].path, "admin/users?page=2&per_page=50");
      respond = () =>
        Response.json({
          users: Array.from({ length: 50 }, () => ({
            id: targetId,
            app_metadata: {},
          })),
        });
      assert.deepEqual(await listAdminAccounts(3), {
        items: [],
        page: 3,
        hasNext: true,
      });
      requests.length = 0;
      for (const page of [0, -1, 1.5, NaN, Infinity, 10001])
        await assert.rejects(listAdminAccounts(page));
      assert.equal(requests.length, 0);
    },
  );

  await t.test(
    "creation sends validated credentials and fixed administrator metadata only",
    async () => {
      reset();
      const result = await createAdminAccount(
        {},
        form({
          role: "owner",
          id: targetId,
          app_metadata: '{"role":"owner"}',
          created_by_admin: targetId,
        }),
      );
      assert.ok(result.success);
      assert.equal(requests.length, 1);
      assert.equal(requests[0].path, "admin/users");
      assert.equal(requests[0].method, "POST");
      assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
        email: "new@example.test",
        password: secret,
        email_confirm: true,
        app_metadata: { role: "admin", created_by_admin: admin.id },
      });
      assert.ok(boundary.revalidations.includes("/admin/accounts"));
      assert.ok(!JSON.stringify(result).includes(secret));
    },
  );

  await t.test(
    "invalid input fails before provider requests and duplicates never promote or update existing accounts",
    async () => {
      reset();
      for (const email of [
        "",
        "missing-at",
        "a@b",
        "a b@example.test",
        "a".repeat(255) + "@example.test",
      ]) {
        assert.ok((await createAdminAccount({}, form({ email }))).error);
      }
      for (const overrides of [
        { password: "short", confirm: "short" },
        { password: "a".repeat(257), confirm: "a".repeat(257) },
        { password: secret, confirm: "does-not-match" },
      ]) {
        assert.ok((await createAdminAccount({}, form(overrides))).error);
        assert.ok((await changeAdminPassword({}, form(overrides))).error);
      }
      assert.ok(
        (await changeAdminPassword({}, form({ targetId: "../other-user" })))
          .error,
      );
      assert.equal(requests.length, 0);
      for (const field of ["code", "error_code"]) {
        requests.length = 0;
        respond = () =>
          Response.json(
            { [field]: "email_exists", message: secret },
            { status: 422 },
          );
        const result = await createAdminAccount({}, form());
        assert.match(result.error ?? "", /이미 등록된 이메일/);
        assert.ok(!JSON.stringify(result).includes(secret));
        assert.deepEqual(
          requests.map(({ method, path }) => ({ method, path })),
          [{ method: "POST", path: "admin/users" }],
        );
      }
      assert.equal(boundary.revalidations.length, 0);
    },
  );

  await t.test(
    "password reset rejects nonadministrators and mismatched provider identities",
    async () => {
      for (const target of [
        { id: targetId, app_metadata: {}, user_metadata: { role: "admin" } },
        { ...admin, id: admin.id },
      ]) {
        reset();
        respond = () => Response.json(target);
        const result = await changeAdminPassword({}, form());
        assert.ok(result.error);
        assert.deepEqual(
          requests.map(({ method }) => method),
          ["GET"],
        );
        assert.equal(boundary.revalidations.length, 0);
      }
    },
  );

  await t.test(
    "another administrator password update writes only password and preserves the actor session",
    async () => {
      reset();
      respond = () =>
        Response.json({ ...admin, id: targetId, password: secret });
      const result = await changeAdminPassword(
        {},
        form({ role: "owner", email: "attacker@example.test" }),
      );
      assert.ok(result.success);
      assert.deepEqual(
        requests.map(({ method, path }) => ({ method, path })),
        [
          { method: "GET", path: `admin/users/${targetId}` },
          { method: "PUT", path: `admin/users/${targetId}` },
        ],
      );
      assert.deepEqual(JSON.parse(String(requests[1].init?.body)), {
        password: secret,
      });
      assert.equal(boundary.writes.length, 0);
      assert.ok(!JSON.stringify(result).includes(secret));
    },
  );

  await t.test(
    "own password update expires scoped cookie and redirects even if provider logout fails",
    async () => {
      reset();
      respond = (path) => {
        if (path === "logout?scope=local") throw new Error(secret);
        return Response.json(admin);
      };
      await assert.rejects(
        changeAdminPassword({}, form({ targetId: admin.id })),
        { message: "REDIRECT:/admin/login?updated=password" },
      );
      assert.deepEqual(
        requests.map(({ method }) => method),
        ["GET", "PUT", "POST"],
      );
      assert.equal(
        new Headers(requests[2].init?.headers).get("authorization"),
        "Bearer verified-token",
      );
      assert.deepEqual(boundary.writes, [
        {
          name: "icom-admin-access",
          value: "",
          options: {
            path: "/admin",
            maxAge: 0,
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
          },
        },
      ]);
    },
  );

  await t.test(
    "transport, provider and malformed-response errors never reflect secrets",
    async () => {
      reset();
      for (const failure of [
        () => {
          throw new Error(secret);
        },
        () => Response.json({ message: secret }, { status: 500 }),
        () =>
          Response.json(
            { code: "weak_password", message: secret },
            { status: 422 },
          ),
        () => new Response(secret),
      ]) {
        respond = failure;
        for (const operation of [createAdminAccount, changeAdminPassword]) {
          const result = await operation({}, form());
          assert.ok(result.error);
          assert.ok(!JSON.stringify(result).includes(secret));
          assert.ok(!JSON.stringify(result).includes("synthetic-service-key"));
        }
        await assert.rejects(listAdminAccounts(), (error: Error) => {
          assert.ok(!error.message.includes(secret));
          return true;
        });
      }
      assert.equal(boundary.writes.length, 0);
      assert.equal(boundary.revalidations.length, 0);
    },
  );
});
