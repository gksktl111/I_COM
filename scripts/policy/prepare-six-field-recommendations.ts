import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { prepareSixFieldCatalog } from "../../src/features/policy/server/catalogs/six-field-prepared.ts";
const { values } = parseArgs({
  strict: true,
  options: {
    "out-dir": { type: "string", default: "/tmp/icom-six-field-prepared" },
  },
});
const result = prepareSixFieldCatalog();
const report = {
  scope: "ALL_SIX_FIELDS_REQUIRED",
  kind: "OFFLINE_DRAFT_SAMPLE",
  catalogVersion: result.catalog.version,
  policyCount: result.catalog.policies.length,
  ruleCount: result.catalog.policies.reduce((n, p) => n + p.rules.length, 0),
  questionCount: result.catalog.questions.length,
  fields: result.fields,
  queue: result.queue,
  limitations: [
    "분야별 표본의 조건 초안이며 전체 정책 준비 또는 공개 적용 완료가 아닙니다.",
    "미검수 상태를 HUMAN 승인으로 바꾸지 않습니다.",
  ],
};
const output = resolve(values["out-dir"]!);
await mkdir(output, { recursive: true });
await writeFile(
  join(output, "six-field-preparation.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    output,
    policyCount: report.policyCount,
    fields: report.fields,
  }),
);
if (result.queue.some((row) => row.status === "INVALID")) process.exitCode = 1;
