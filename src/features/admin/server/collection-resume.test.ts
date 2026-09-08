import assert from "node:assert/strict";
import { test } from "node:test";
import module from "node:module";
import type { runAutomatic } from "../../policy/server/automatic.ts";

type Options = Parameters<typeof runAutomatic>[0];
const runId = "11111111-2222-3333-4444-555555555555";
const savedConfig = {
  filters: { "cond[서비스명::LIKE]": "청년" },
  perPage: 50,
  maxPages: 240,
  dailyLimit: 300,
};
const boundary = {
  authorized: true,
  created: 0,
  commands: [] as { action: string; payload: Record<string, unknown> }[],
  runs: [] as Options[],
  failure: "" as "" | "state" | "run",
  requireAdmin: async () => {
    if (!boundary.authorized) boundary.redirect("/admin/login");
  },
  redirect: (url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  },
  repository: {
    command: async (action: string, payload: Record<string, unknown>) => {
      boundary.commands.push({ action, payload });
      if (boundary.failure === "state")
        throw new Error("private state with synthetic-secret");
      return { job: { config: savedConfig }, raw: "private-state" };
    },
  },
  run: async (options: Options) => {
    boundary.runs.push(options);
    if (boundary.failure === "run")
      throw new Error("private upstream body with synthetic-secret");
    return { runId };
  },
};
const globals = globalThis as typeof globalThis & {
  __collectionResumeTest?: typeof boundary;
};
globals.__collectionResumeTest = boundary;
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
    if (specifier === "next/navigation")
      return source(
        "export const redirect = url => globalThis.__collectionResumeTest.redirect(url);",
      );
    if (specifier === "@/features/admin/server/auth")
      return source(
        "export const requireAdmin = () => globalThis.__collectionResumeTest.requireAdmin();",
      );
    if (specifier === "@/features/policy/server/repository")
      return source(
        "export const createRepository = () => { const b = globalThis.__collectionResumeTest; b.created++; return b.repository; };",
      );
    if (specifier === "@/features/policy/server/automatic")
      return source(
        "export const runAutomatic = options => globalThis.__collectionResumeTest.run(options);",
      );
    return next(specifier, context);
  },
});
const { collectPolicies } = await import(
  "../../../app/admin/(protected)/collection/actions.ts"
);
hooks.deregister();

test("admin collection resumes persisted configuration", async (t) => {
  const saved = {
    enabled: process.env.POLICY_SYNC_ENABLED,
    key: process.env.GOV24_API_KEY,
  };
  process.env.POLICY_SYNC_ENABLED = "true";
  process.env.GOV24_API_KEY = "synthetic-secret";
  t.after(() => {
    if (saved.enabled === undefined) delete process.env.POLICY_SYNC_ENABLED;
    else process.env.POLICY_SYNC_ENABLED = saved.enabled;
    if (saved.key === undefined) delete process.env.GOV24_API_KEY;
    else process.env.GOV24_API_KEY = saved.key;
    delete globals.__collectionResumeTest;
  });
  let fetches = 0;
  t.mock.method(globalThis, "fetch", async () => {
    fetches++;
    throw new Error("unexpected network access");
  });
  t.beforeEach(() => {
    boundary.authorized = true;
    boundary.created = 0;
    boundary.commands.length = 0;
    boundary.runs.length = 0;
    boundary.failure = "";
  });
  const form = (resume = true) => {
    const data = new FormData();
    data.set("provider", "GOV24");
    data.set("keyword", "new keyword");
    if (resume) data.set("runId", runId);
    return data;
  };

  await t.test("resume uses the recorded keyword and CLI limits", async () => {
    await assert.rejects(collectPolicies(form()), {
      message: `REDIRECT:/admin/collection?run=${runId}&updated=1`,
    });
    assert.deepEqual(boundary.commands, [
      { action: "auto_state", payload: { provider: "GOV24", runId } },
    ]);
    assert.equal(boundary.runs.length, 1);
    const options = boundary.runs[0];
    for (const key of ["filters", "perPage", "maxPages", "dailyLimit"] as const)
      assert.deepEqual(options[key], savedConfig[key]);
    assert.equal(options.repository, boundary.repository);
    assert.equal(options.resumeRunId, runId);
    assert.equal(options.callBudget, 10);
    assert.equal(options.maxItems, 5);
  });

  await t.test("new runs retain web defaults and the entered keyword", async () => {
    await assert.rejects(collectPolicies(form(false)), {
      message: `REDIRECT:/admin/collection?run=${runId}&updated=1`,
    });
    assert.deepEqual(boundary.commands, []);
    assert.equal(boundary.runs.length, 1);
    const options = boundary.runs[0];
    assert.deepEqual(options.filters, { "cond[서비스명::LIKE]": "new keyword" });
    assert.equal(options.perPage, 10);
    assert.equal(options.maxPages, 1000);
    assert.equal(options.dailyLimit, 100);
    assert.equal(options.resumeRunId, undefined);
  });

  await t.test("unauthorized resumes never access state or start a run", async () => {
    boundary.authorized = false;
    await assert.rejects(collectPolicies(form()), {
      message: "REDIRECT:/admin/login",
    });
    assert.equal(boundary.created, 0);
    assert.deepEqual(boundary.commands, []);
    assert.deepEqual(boundary.runs, []);
    assert.equal(fetches, 0);
  });

  for (const failure of ["state", "run"] as const)
    await t.test(`${failure} failures expose only a generic error and run ID`, async () => {
      boundary.failure = failure;
      await assert.rejects(collectPolicies(form()), {
        message: `REDIRECT:/admin/collection?error=execution&run=${runId}`,
      });
      assert.equal(boundary.runs.length, failure === "state" ? 0 : 1);
    });
});
