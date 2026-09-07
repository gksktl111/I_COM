import assert from "node:assert/strict";
import { test } from "node:test";
import { createRepository } from "./repository.ts";

test("Data API sends private headers only to configured host and hides upstream errors", async () => {
  const oldUrl = process.env.SUPABASE_URL,
    oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "synthetic-private-secret";
  try {
    const repository = createRepository(async (url, init) => {
      assert.equal(
        String(url),
        "https://example.supabase.co/rest/v1/rpc/policy_sync_command",
      );
      assert.equal(init?.redirect, "error");
      assert.equal(
        new Headers(init?.headers).get("apikey"),
        "synthetic-private-secret",
      );
      assert.ok(!String(init?.body).includes("synthetic-private-secret"));
      return new Response("reflected synthetic-private-secret", {
        status: 403,
      });
    });
    await assert.rejects(
      repository.command("current", { externalId: "id" }),
      (e) => e instanceof Error && e.message === "database-http-403",
    );
    process.env.SUPABASE_URL = "https://example.supabase.co.attacker.invalid";
    assert.throws(() => createRepository(), /invalid-supabase-url/);
  } finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});
