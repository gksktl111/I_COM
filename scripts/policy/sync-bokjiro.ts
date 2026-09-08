import { readFile, mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { createRepository } from "../../src/features/policy/server/repository.ts";
import {
  syncBokjiro,
  validateBokjiSelection,
} from "../../src/features/policy/server/bokjiro-sync.ts";
import type { BokjiProvider } from "../../src/features/policy/server/bokjiro.ts";
import { redact } from "../../src/features/policy/server/gov24/probe.ts";
async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean" },
      provider: { type: "string" },
      selection: { type: "string" },
      "dry-run": { type: "boolean" },
      reprocess: { type: "boolean" },
      resume: { type: "string" },
      budget: { type: "string" },
      "per-page": { type: "string" },
      "max-pages": { type: "string" },
    },
  });
  if (values.help) {
    console.log(
      "policy:sync:bokjiro --provider central|local [--dry-run] [--reprocess] [--resume UUID] [--selection FILE] [--budget 40] [--per-page 50] [--max-pages 10]\n실제 저장은 POLICY_SYNC_ENABLED=true 필요. 출처별 선정 표본만 저장.",
    );
    return;
  }
  try {
    process.loadEnvFile(".env.local");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  if (!["central", "local"].includes(values.provider ?? ""))
    throw new Error("provider-required");
  if (!values["dry-run"] && process.env.POLICY_SYNC_ENABLED !== "true")
    throw new Error("writes-disabled");
  const provider: BokjiProvider =
    values.provider === "central" ? "BOKJIRO_CENTRAL" : "BOKJIRO_LOCAL";
  const selections = JSON.parse(
    await readFile(
      values.selection ?? "scripts/policy/bokjiro-selection.json",
      "utf8",
    ),
  );
  let selected = validateBokjiSelection(selections[provider]);
  const repository = createRepository();
  const trigger = values.reprocess ? "reprocess" : "manual";
  if (values.resume) {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(values.resume))
      throw new Error("invalid-run-id");
    const old = await repository.command<{
      run: { scope: unknown; trigger: string };
    } | null>("run", { provider, runId: values.resume });
    if (!old || old.run.trigger !== trigger) throw new Error("resume-mismatch");
    selected = validateBokjiSelection(old.run.scope);
  }
  const clean = (input: unknown) => {
    let output = input;
    for (const [name, key] of Object.entries(process.env))
      if (/KEY|TOKEN|SECRET/.test(name) && key && key.length >= 8) {
        output = redact(output, key);
        try {
          output = redact(output, decodeURIComponent(key));
        } catch {
          /* Non-encoded key. */
        }
      }
    return output;
  };
  const dir = `.local/policy-sync/bokjiro-${values.provider}-${randomUUID()}`;
  await mkdir(dir, { recursive: true, mode: 0o700 });
  let sequence = 0;
  const result = await syncBokjiro({
    provider,
    selected,
    repository,
    trigger,
    resumeRunId: values.resume,
    key: process.env[
      provider === "BOKJIRO_CENTRAL"
        ? "BOKJIRO_CENTRAL_API_KEY"
        : "BOKJIRO_LOCAL_API_KEY"
    ],
    dryRun: !!values["dry-run"],
    budget: Number(values.budget ?? 40),
    perPage: Number(values["per-page"] ?? 50),
    maxPages: Number(values["max-pages"] ?? 10),
    capture: async (capture) => {
      await writeFile(
        `${dir}/request-${++sequence}.json`,
        JSON.stringify(clean(capture), null, 2),
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
  if (!["SUCCESS", "SKIPPED"].includes(String(result.status)))
    process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "복지로 수집 실패: 환경설정·선정 목록·DB 상태와 비밀값이 제거된 실행 기록을 확인하세요.",
  );
  process.exitCode = 1;
});
