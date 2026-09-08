import { readFile, mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { syncPolicies } from "../../src/features/policy/server/sync.ts";
import { validateSelection } from "../../src/features/policy/server/collect.ts";
import { createRepository } from "../../src/features/policy/server/repository.ts";
import {
  redact,
  decodeKey,
} from "../../src/features/policy/server/gov24/probe.ts";

async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean" },
      "dry-run": { type: "boolean" },
      reprocess: { type: "boolean" },
      selection: { type: "string" },
      resume: { type: "string" },
      budget: { type: "string" },
      "per-page": { type: "string" },
      "max-pages": { type: "string" },
    },
  });
  if (values.help) {
    console.log(
      "policy:sync [--selection scripts/policy/selection.json] [--dry-run] [--resume RUN_UUID] [--reprocess] [--budget 100] [--per-page 100] [--max-pages 20]\nWrites require POLICY_SYNC_ENABLED=true. dry-run performs no database writes. Reprocess uses stored snapshots without Gov24 calls.",
    );
    return;
  }
  try {
    process.loadEnvFile(".env.local");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  if (!values["dry-run"] && process.env.POLICY_SYNC_ENABLED !== "true")
    throw new Error("POLICY_SYNC_ENABLED=true is required for writes");
  const repository = createRepository();
  let selected = validateSelection(
    JSON.parse(
      await readFile(
        values.selection ?? "scripts/policy/selection.json",
        "utf8",
      ),
    ),
  );
  if (values.resume) {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(values.resume))
      throw new Error("Invalid run ID");
    const old = await repository.command<{
      run: { scope: unknown; trigger: string };
    }>("run", { runId: values.resume });
    selected = validateSelection(old.run.scope);
    if (old.run.trigger !== (values.reprocess ? "reprocess" : "manual"))
      throw new Error("Resume trigger differs");
  }
  const dir = `.local/policy-sync/${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
  await mkdir(dir, { recursive: true, mode: 0o700 });
  let sequence = 0;
  const clean = (input: unknown) => {
    let result = input;
    for (const name of [
      "GOV24_API_KEY",
      "SUPABASE_SECRET_KEY",
      "STITCH_API_KEY",
      "POLICY_SYNC_CRON_SECRET",
    ]) {
      const key = process.env[name];
      if (key) {
        result = redact(result, key);
        if (name === "GOV24_API_KEY") result = redact(result, decodeKey(key));
      }
    }
    return result;
  };
  const result = await syncPolicies({
    repository,
    selected,
    dryRun: !!values["dry-run"],
    resumeRunId: values.resume,
    trigger: values.reprocess ? "reprocess" : "manual",
    key: process.env.GOV24_API_KEY,
    budget: Number(values.budget ?? 100),
    perPage: Number(values["per-page"] ?? 100),
    maxPages: Number(values["max-pages"] ?? 20),
    capture: async (c) => {
      await writeFile(
        `${dir}/request-${String(++sequence).padStart(3, "0")}.json`,
        JSON.stringify(clean(c), null, 2),
        { mode: 0o600 },
      );
    },
  });
  await writeFile(
    `${dir}/summary.json`,
    JSON.stringify(clean(result), null, 2),
    { mode: 0o600 },
  );
  console.log(JSON.stringify(clean(result), null, 2));
  console.log(`Saved: ${dir}`);
  if (!["SUCCESS", "SKIPPED"].includes(result.status)) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Policy sync failed. Check environment, database migration, run state and sanitized artifacts; no upstream error text is logged.",
  );
  process.exitCode = 1;
});
