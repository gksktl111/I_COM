import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { runAutomatic } from "../../src/features/policy/server/automatic.ts";
import type { Provider } from "../../src/features/policy/server/automatic-source.ts";
import { createRepository } from "../../src/features/policy/server/repository.ts";

async function main() {
  const { values } = parseArgs({
    options: {
      help: { type: "boolean" },
      provider: { type: "string" },
      config: { type: "string" },
      resume: { type: "string" },
      "call-budget": { type: "string" },
      "max-items": { type: "string" },
    },
  });
  if (values.help) {
    console.log(
      "policy:auto --provider gov24|central|local [--config JSON] [--resume UUID] [--call-budget 40] [--max-items N]\nPOLICY_SYNC_ENABLED=true 필요. 기본 범위는 해당 출처 전체이며 목록·진행·품질을 DB에 저장. 배포 예약은 별도 설정.",
    );
    return;
  }
  try {
    process.loadEnvFile(".env.local");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  if (process.env.POLICY_SYNC_ENABLED !== "true")
    throw new Error("writes-disabled");
  const providers: Record<string, Provider> = {
    gov24: "GOV24",
    central: "BOKJIRO_CENTRAL",
    local: "BOKJIRO_LOCAL",
  };
  const provider = providers[values.provider ?? ""];
  if (!provider) throw new Error("provider-required");
  if (
    values.resume &&
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(values.resume)
  )
    throw new Error("invalid-run-id");
  const repository = createRepository();
  let config = {
    filters: {} as Record<string, string>,
    perPage: 10,
    maxPages: 1000,
    dailyLimit: 100,
  };
  if (values.config) config = JSON.parse(await readFile(values.config, "utf8"));
  else if (values.resume)
    config = (
      await repository.command<{ job: { config: typeof config } }>(
        "auto_state",
        { provider, runId: values.resume },
      )
    ).job.config;
  const keyName =
    provider === "GOV24"
      ? "GOV24_API_KEY"
      : provider === "BOKJIRO_CENTRAL"
        ? "BOKJIRO_CENTRAL_API_KEY"
        : "BOKJIRO_LOCAL_API_KEY";
  const dir = ".local/policy-sync/automatic";
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const result = await runAutomatic({
    provider,
    filters: config.filters,
    perPage: config.perPage,
    maxPages: config.maxPages,
    dailyLimit: config.dailyLimit,
    repository,
    key: process.env[keyName] ?? "",
    resumeRunId: values.resume,
    callBudget: Number(values["call-budget"] ?? 40),
    ...(values["max-items"] === undefined
      ? {}
      : { maxItems: Number(values["max-items"]) }),
    onStarted: async (runId) => {
      await writeFile(
        `${dir}/${runId}.json`,
        JSON.stringify({ runId, provider, status: "STARTED", config }),
        { mode: 0o600 },
      );
      console.log(JSON.stringify({ runId, provider, status: "STARTED" }));
    },
  });
  await writeFile(
    `${dir}/${result.runId}.json`,
    JSON.stringify({ ...result, provider, config }, null, 2),
    { mode: 0o600 },
  );
  console.log(JSON.stringify(result, null, 2));
  if (["FAILED", "PARTIAL"].includes(result.status)) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "자동 수집 중단: 설정·서버 연결과 출력된 runId의 실행 보고서를 확인하세요. 원본 오류·인증키는 출력하지 않습니다.",
  );
  process.exitCode = 1;
});
