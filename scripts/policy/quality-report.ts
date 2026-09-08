import { parseArgs } from "node:util";
import { writeFile } from "node:fs/promises";
import { createPolicyQualityReader } from "../../src/features/policy/server/admin-quality.ts";
import type { Provider } from "../../src/features/policy/server/automatic-source.ts";

async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean" },
      provider: { type: "string" },
      run: { type: "string" },
      status: { type: "string" },
      code: { type: "string" },
      limit: { type: "string" },
      "before-id": { type: "string" },
      output: { type: "string" },
    },
  });
  if (values.help) {
    console.log(
      "policy:quality [--provider GOV24|BOKJIRO_CENTRAL|BOKJIRO_LOCAL] [--run UUID] [--status REVIEW|ERROR] [--code CODE] [--limit 50] [--before-id ID] [--output FILE]",
    );
    return;
  }
  try {
    process.loadEnvFile(".env.local");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const reader = createPolicyQualityReader();
  const provider = values.provider as Provider | undefined;
  const result = {
    overview: await reader.overview(provider),
    quality: await reader.quality({
      provider,
      runId: values.run,
      status: values.status,
      code: values.code,
      limit: Number(values.limit ?? 50),
      beforeId: values["before-id"],
    }),
  };
  if (values.output)
    await writeFile(values.output, JSON.stringify(result, null, 2) + "\n", {
      mode: 0o600,
    });
  else console.log(JSON.stringify(result, null, 2));
}
main().catch(() => {
  console.error("품질 보고서 조회 실패: 서버 설정과 조회 조건을 확인하세요.");
  process.exitCode = 1;
});
