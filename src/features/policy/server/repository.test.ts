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
    let applied: Record<string, unknown> = {};
    const writer = createRepository(async (_url, init) => {
      applied = JSON.parse(String(init?.body)).p_payload;
      return Response.json({ status: "SUCCESS" });
    });
    await writer.command("apply", {
      normalized: {
        display: {
          name: "어업경영자금 지원",
          target_text: "어업 경영자",
          benefit_text: "어선 장비 구입비 지원",
        },
      },
      relevance: { status: "RELATED" },
    });
    assert.equal(
      (applied.relevance as { status: string }).status,
      "UNRELATED",
      "all apply callers receive evaluated relevance, not a caller-provided label",
    );
    assert.equal(
      (applied.relevance as { version: string }).version,
      "policy-relevance-4",
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
