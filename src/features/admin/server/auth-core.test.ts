import { test } from "node:test";
import assert from "node:assert/strict";
import { isAdministrator, verifyAdministrator } from "./auth-core.ts";

const admin = {
  id: "user",
  email_confirmed_at: "2026-09-08",
  app_metadata: { role: "admin" },
};
test("administrator requires confirmed server-owned role, not user metadata", () => {
  assert.equal(isAdministrator(admin), true);
  const forged = {
    ...admin,
    app_metadata: {},
    user_metadata: { role: "admin" },
  };
  assert.equal(isAdministrator(forged), false);
  assert.equal(
    isAdministrator({ ...admin, email_confirmed_at: undefined }),
    false,
  );
  assert.equal(isAdministrator({ ...admin, is_anonymous: true }), false);
  assert.equal(
    isAdministrator({ ...admin, banned_until: "2099-01-01" }),
    false,
  );
  assert.equal(isAdministrator(null), false);
});
test("server verifies token remotely without cache and fails closed on revocation/network failure", async () => {
  process.env.SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-secret";
  const mock: typeof fetch = async (url, init) => {
    assert.equal(String(url), "https://test.supabase.co/auth/v1/user");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer access",
    );
    return Response.json(admin);
  };
  assert.deepEqual(await verifyAdministrator("access", mock), admin);
  assert.equal(
    await verifyAdministrator(
      "forged",
      async () => new Response(null, { status: 401 }),
    ),
    null,
  );
  assert.equal(
    await verifyAdministrator("access", async () =>
      Response.json({ ...admin, app_metadata: {} }),
    ),
    null,
  );
  assert.equal(
    await verifyAdministrator("access", async () => {
      throw new Error("offline");
    }),
    null,
  );
});
