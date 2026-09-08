import assert from "node:assert/strict";
import { test } from "node:test";
import module from "node:module";
import { NextRequest } from "next/server.js";

type CookieWrite = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};
const boundary = {
  token: undefined as string | undefined,
  writes: [] as CookieWrite[],
  mutations: 0,
  revalidations: 0,
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
  __adminAccessTest?: typeof boundary;
};
globals.__adminAccessTest = boundary;

// Stub framework boundaries and mutation sinks, keeping the real auth verifier/actions.
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
        "export const cookies = () => globalThis.__adminAccessTest.cookies();",
      );
    if (specifier === "next/navigation")
      return source(
        "export const redirect = url => globalThis.__adminAccessTest.redirect(url);",
      );
    if (specifier === "next/cache")
      return source(
        "export const revalidatePath = () => { globalThis.__adminAccessTest.revalidations++; };",
      );
    if (specifier === "next/server") return next("next/server.js", context);
    if (specifier === "@/features/admin/server/auth")
      return {
        url: new URL("./auth.ts", import.meta.url).href,
        shortCircuit: true,
      };
    if (
      specifier === "@/features/admin/server/auth-core" ||
      specifier === "./auth-core"
    )
      return {
        url: new URL("./auth-core.ts", import.meta.url).href,
        shortCircuit: true,
      };
    if (specifier === "@/features/policy/server/automatic")
      return source(
        "export const runAutomatic = async () => { globalThis.__adminAccessTest.mutations++; return { runId: 'run' }; };",
      );
    if (specifier === "@/features/policy/server/repository")
      return source(
        "export const createRepository = () => { globalThis.__adminAccessTest.mutations++; return {}; };",
      );
    if (specifier === "@/features/admin/server/notices")
      return source(
        "export const saveAdminNotice = async () => { globalThis.__adminAccessTest.mutations++; }; export const archiveAdminNotice = saveAdminNotice;",
      );
    return next(specifier, context);
  },
});
const { requireAdmin } = await import("./auth.ts");
const { loginAdmin } = await import("../../../app/admin/login/actions.ts");
const { POST: logout } = await import("../../../app/admin/logout/route.ts");
const { collectPolicies } = await import(
  "../../../app/admin/(protected)/collection/actions.ts"
);
const { saveNoticeAction, archiveNoticeAction } = await import(
  "../../../app/admin/(protected)/notices/actions.ts"
);
hooks.deregister();

const admin = {
  id: "admin-id",
  email: "admin@example.test",
  email_confirmed_at: "2026-09-08",
  app_metadata: { role: "admin" },
};

test("administrator session and direct action boundaries", async (t) => {
  const saved = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SECRET_KEY,
  };
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "synthetic-secret";
  t.after(() => {
    if (saved.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = saved.url;
    if (saved.key === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = saved.key;
    delete globals.__adminAccessTest;
  });
  const requests: { url: string; init?: RequestInit }[] = [];
  let respond: (url: string) => Response = () =>
    new Response(null, { status: 401 });
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      assert.ok(url.startsWith("https://test.supabase.co/auth/v1/"));
      assert.equal(init?.cache, "no-store");
      assert.equal(init?.redirect, "error");
      requests.push({ url, init });
      return respond(url);
    },
  );
  const form = new FormData();
  form.set("email", "admin@example.test");
  form.set("password", "synthetic-password");

  await t.test(
    "ordinary password login fails and never writes an admin cookie",
    async () => {
      respond = (url) =>
        url.includes("token?")
          ? Response.json({ access_token: "ordinary-token", expires_in: 3600 })
          : url.endsWith("/user")
            ? Response.json({
                ...admin,
                app_metadata: {},
                user_metadata: { role: "admin" },
              })
            : new Response(null, { status: 204 });
      await assert.rejects(loginAdmin(form), {
        message: "REDIRECT:/admin/login?error=credentials",
      });
      assert.equal(boundary.writes.length, 0);
      assert.ok(
        requests.some((request) => request.url.endsWith("logout?scope=local")),
      );
    },
  );

  await t.test(
    "verified administrator gets a bounded protected cookie",
    async () => {
      requests.length = 0;
      respond = (url) =>
        url.includes("token?")
          ? Response.json({ access_token: "verified-token", expires_in: 7200 })
          : Response.json(admin);
      await assert.rejects(loginAdmin(form), { message: "REDIRECT:/admin" });
      assert.equal(requests.length, 2);
      assert.equal(
        new Headers(requests[1].init?.headers).get("authorization"),
        "Bearer verified-token",
      );
      assert.deepEqual(boundary.writes.pop(), {
        name: "icom-admin-access",
        value: "verified-token",
        options: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/admin",
          maxAge: 3600,
        },
      });
      respond = (url) =>
        url.includes("token?")
          ? Response.json({ access_token: "expired-token", expires_in: 0 })
          : Response.json(admin);
      await assert.rejects(loginAdmin(form), {
        message: "REDIRECT:/admin/login?error=credentials",
      });
      assert.equal(boundary.writes.length, 0);
    },
  );

  await t.test(
    "missing, forged, expired, and demoted tokens fail the real guard",
    async () => {
      boundary.token = undefined;
      const before = requests.length;
      await assert.rejects(requireAdmin(), {
        message: "REDIRECT:/admin/login",
      });
      assert.equal(requests.length, before);
      for (const token of ["forged-admin-jwt", "expired-admin-jwt"]) {
        boundary.token = token;
        respond = () => new Response(null, { status: 401 });
        await assert.rejects(requireAdmin(), {
          message: "REDIRECT:/admin/login",
        });
      }
      boundary.token = "previously-admin-token";
      respond = () =>
        Response.json({
          ...admin,
          app_metadata: {},
          user_metadata: { role: "admin" },
        });
      await assert.rejects(requireAdmin(), {
        message: "REDIRECT:/admin/login",
      });
      respond = () => Response.json(admin);
      assert.deepEqual(await requireAdmin(), {
        id: admin.id,
        email: admin.email,
      });
    },
  );

  await t.test(
    "direct collection and notice actions cannot mutate without authorization",
    async () => {
      for (const token of [undefined, "ordinary-token"]) {
        boundary.token = token;
        respond = () => Response.json({ ...admin, app_metadata: {} });
        for (const action of [
          collectPolicies,
          saveNoticeAction,
          archiveNoticeAction,
        ])
          await assert.rejects(action(new FormData()), {
            message: "REDIRECT:/admin/login",
          });
      }
      assert.equal(boundary.mutations, 0);
      assert.equal(boundary.revalidations, 0);
    },
  );

  await t.test(
    "logout rejects foreign or missing origins and expires the scoped cookie on provider failure",
    async () => {
      boundary.token = "verified-token";
      const before = requests.length;
      for (const origin of [undefined, "https://attacker.example"]) {
        const request = new NextRequest("https://icom.example/admin/logout", {
          method: "POST",
          headers: origin ? { origin } : {},
        });
        const response = await logout(request);
        assert.equal(response.status, 403);
        assert.equal(response.headers.get("set-cookie"), null);
      }
      assert.equal(requests.length, before);
      respond = () => {
        throw new Error("upstream reflected synthetic-secret");
      };
      const response = await logout(
        new NextRequest("https://icom.example/admin/logout", {
          method: "POST",
          headers: { origin: "https://icom.example" },
        }),
      );
      assert.equal(response.status, 303);
      assert.equal(
        response.headers.get("location"),
        "https://icom.example/admin/login",
      );
      assert.equal(response.headers.get("cache-control"), "no-store");
      const cookie = response.headers.get("set-cookie")!;
      assert.match(cookie, /icom-admin-access=;/);
      assert.match(cookie, /Path=\/admin;/);
      assert.match(cookie, /Max-Age=0/);
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=strict/i);
      assert.ok(!cookie.includes("synthetic-secret"));
    },
  );
});
