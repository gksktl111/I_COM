import { test } from "node:test";
import assert from "node:assert/strict";
import module from "node:module";
const jar = new Map<string, string>();
const writes: Array<{
  name: string;
  value: string;
  options: Record<string, unknown>;
}> = [];
const globals = globalThis as typeof globalThis & { __setupCookies?: unknown };
globals.__setupCookies = {
  get: (name: string) => (jar.has(name) ? { value: jar.get(name) } : undefined),
  set: (name: string, value: string, options: Record<string, unknown>) => {
    writes.push({ name, value, options });
    if (value) jar.set(name, value);
    else jar.delete(name);
  },
};
const { registerHooks } = module as unknown as {
  registerHooks(options: {
    resolve: (
      s: string,
      c: unknown,
      n: (s: string, c: unknown) => unknown,
    ) => unknown;
  }): { deregister(): void };
};
const hook = registerHooks({
  resolve(s, c, n) {
    if (s === "next/headers")
      return {
        url: "data:text/javascript,export const cookies=async()=>globalThis.__setupCookies;",
        shortCircuit: true,
      };
    if (s === "@/features/admin/server/auth-core")
      return {
        url: new URL("./auth-core.ts", import.meta.url).href,
        shortCircuit: true,
      };
    return n(s, c);
  },
});
const { setAdminPassword } = await import(
  "../../../app/admin/setup/actions.ts"
);
hook.deregister();
test("password setup requires an invite and current admin, protects retry cookie, clears on success", async (t) => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "synthetic";
  const calls: string[] = [];
  let role = "admin";
  let rejectVerify = false;
  let rejectUpdate = false;
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      calls.push(`${init?.method ?? "GET"} ${path}`);
      if (path.endsWith("/verify")) {
        assert.equal(JSON.parse(String(init?.body)).type, "invite");
        return rejectVerify
          ? new Response(null, { status: 403 })
          : Response.json({ access_token: "verified", expires_in: 3600 });
      }
      if (path.endsWith("/user") && init?.method === "PUT")
        return rejectUpdate
          ? new Response(null, { status: 422 })
          : Response.json({ id: "admin" });
      if (path.endsWith("/user"))
        return Response.json({
          id: "admin",
          email_confirmed_at: "2026-09-08",
          app_metadata: { role },
        });
      return new Response(null, { status: 204 });
    },
  );
  const form = new FormData();
  form.set("password", "unique-long-password");
  form.set("confirm", "unique-long-password");
  assert.ok((await setAdminPassword({}, form)).error);
  assert.equal(calls.length, 0);
  form.set("token_hash", "a".repeat(64));
  rejectVerify = true;
  assert.ok((await setAdminPassword({}, form)).error);
  assert.equal(writes.length, 0);
  rejectVerify = false;
  role = "user";
  assert.ok((await setAdminPassword({}, form)).error);
  assert.equal(
    calls.some((c) => c.startsWith("PUT")),
    false,
  );
  role = "admin";
  rejectUpdate = true;
  assert.ok((await setAdminPassword({}, form)).error);
  assert.deepEqual(writes.at(-1)?.options, {
    httpOnly: true,
    secure: false,
    sameSite: "strict",
    path: "/admin/setup",
    maxAge: 600,
  });
  const previousVerify = calls.filter((c) => c.endsWith("/verify")).length;
  rejectUpdate = false;
  form.delete("token_hash");
  assert.deepEqual(await setAdminPassword({}, form), { success: true });
  assert.equal(
    calls.filter((c) => c.endsWith("/verify")).length,
    previousVerify,
  );
  assert.equal(writes.at(-1)?.options.maxAge, 0);
  assert.equal(jar.size, 0);
  form.set("confirm", "different");
  const count = calls.length;
  assert.ok((await setAdminPassword({}, form)).error);
  assert.equal(calls.length, count);
});
