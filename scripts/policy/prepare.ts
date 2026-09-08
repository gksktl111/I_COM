import { mkdir, writeFile, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  collectSelection,
  validateSelection,
} from "../../src/features/policy/server/collect.ts";
import { ProbeClient } from "../../src/features/policy/server/gov24/probe.ts";
import type { Capture } from "../../src/features/policy/server/gov24/probe.ts";
import { normalizeBundle } from "../../src/features/policy/server/normalize.ts";

// Fresh API collection and local preparation only. No repository/DB access.
async function main() {
  process.loadEnvFile(".env.local");
  if (!process.env.GOV24_API_KEY) throw new Error("Missing Gov24 key");
  const selected = validateSelection(
    JSON.parse(await readFile("scripts/policy/selection.json", "utf8")),
  );
  const dir = `.local/policy-prepared/${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const captures: Capture[] = [],
    results: Record<string, unknown>[] = [];
  const client = new ProbeClient(process.env.GOV24_API_KEY, 100, async (c) => {
    captures.push(c);
    await writeFile(
      `${dir}/request-${String(captures.length).padStart(3, "0")}.json`,
      JSON.stringify(c, null, 2),
      { mode: 0o600 },
    );
  });
  let interrupted = false;
  try {
    await collectSelection(
      client,
      captures,
      selected,
      { perPage: 100, maxPages: 20 },
      async (selection, raw, error) => {
        if (!raw) {
          results.push({ id: selection.id, status: "FAILED", error });
          return;
        }
        try {
          const normalized = normalizeBundle(raw);
          await writeFile(
            `${dir}/policy-${selection.id}.json`,
            JSON.stringify({ raw, normalized }, null, 2),
            { mode: 0o600 },
          );
          results.push({
            id: selection.id,
            status: "PREPARED",
            name: normalized.display.name,
            warnings: normalized.warnings,
          });
        } catch {
          results.push({
            id: selection.id,
            status: "FAILED",
            error: "normalization-or-file-write-failed",
          });
        }
      },
    );
  } catch {
    interrupted = true;
  }
  const complete =
    !interrupted &&
    results.length === selected.length &&
    results.every((r) => r.status === "PREPARED");
  const summary = {
    at: new Date().toISOString(),
    mode: "local-preparation",
    databaseAccess: false,
    calls: client.calls,
    complete,
    results,
  };
  await writeFile(`${dir}/summary.json`, JSON.stringify(summary, null, 2), {
    mode: 0o600,
  });
  console.log(JSON.stringify(summary, null, 2));
  console.log(`Saved: ${dir}`);
  if (!complete) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Policy preparation failed; check environment and sanitized artifacts.",
  );
  process.exitCode = 1;
});
