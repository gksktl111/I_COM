import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import {
  prepareEducationCatalog,
  type EducationPreparation,
  type EducationPreparationSource,
} from "../../src/features/policy/server/catalogs/education-prepared.ts";

const usage = `교육 정책 초안 준비 (Node 24, 오프라인 전용)
node --experimental-strip-types scripts/policy/prepare-recommendation-catalog.ts [--out-dir /tmp/icom-policy-prepared]

기본값은 보존된 20건 원본과 12건 템플릿 입력입니다. 수동 초안 2건의 기존 원본 버전을 유지합니다.
--sources FILE, --inputs FILE은 같은 {items:[...]} 형식의 로컬 검증 입력을 사용합니다.
네트워크·DB·환경 인증키를 사용하지 않으며 HUMAN 승인·공개·완전성을 변경하지 않습니다.
INVALID 입력은 격리하고 부분 산출물을 저장하되 종료 코드 1로 보고합니다.`;
const cell = (value: string) =>
  value.replaceAll("|", "\\|").replaceAll("\n", " ");
function renderSummary(result: EducationPreparation): string {
  const s = result.summary;
  return `# 교육 정책 준비 결과

상태: **${s.status}**. 보존 원본의 오프라인 조합 결과이며 현행 공식 검수나 공개 승인이 아닙니다.
${s.invalidCount ? "INVALID 입력이 있어 일부 초안만 생성했습니다. 전체 성공으로 해석하지 않습니다." : "입력 검증을 통과한 준비 초안입니다. 미검수·불완전 경로의 공개·자격 판정을 허용하지 않습니다."}

| 항목 | 건수 |
| --- | ---: |
| 원본 | ${s.sourceCount} |
| 준비 초안 정책 | ${s.policyCount} |
| 수동 / 템플릿 준비 | ${s.manualCount} / ${s.templateCount} |
| 조건 규칙 | ${s.ruleCount} |
| 중복 ID 통합 후 공통 질문 | ${s.questionCount} |
| 검토 보류 | ${s.heldCount} |
| INVALID | ${s.invalidCount} |
| HUMAN 공개 / 규칙 | ${s.humanReleaseCount} / ${s.humanRuleCount} |
| 완전 정책 / 경로 | ${s.completePolicyCount} / ${s.completePathCount} |

수동 2건은 기존 기준 원본 버전을 유지합니다. 템플릿은 해당 보존 원본의 전체 정제값 지문과 정확 인용에 연결됩니다. 정확 인용은 해석의 정확성이나 완전성 승인이 아닙니다. 보류의 범위 분류·근거 부족·템플릿 미구현은 큐에서 구분합니다.

| 표본 | 방법 | 상태 | 분야 판단 | 규칙 / 질문 | 사유 코드 |
| --- | --- | --- | --- | ---: | --- |
${result.queue.map((q) => `| ${cell(q.sampleId)} | ${q.method} | ${q.status} | ${cell(q.disposition)} | ${q.ruleCount} / ${q.questionCount} | ${q.codes.map(cell).join(", ")} |`).join("\n")}

원문 근거·보류 사유·버전 연결은 catalog.json과 queue.json을 함께 확인합니다. 정책별 질문 건수는 공통 질문을 중복 포함하므로 합산하면 전체 고유 질문 수와 다를 수 있습니다.
`;
}
async function items(path: string): Promise<unknown[]> {
  const data: unknown = JSON.parse(await readFile(resolve(path), "utf8"));
  if (
    !data ||
    typeof data !== "object" ||
    !("items" in data) ||
    !Array.isArray(data.items)
  )
    throw new Error("invalid-preparation-input-file");
  return data.items;
}
async function main() {
  const { values } = parseArgs({
    strict: true,
    options: {
      "out-dir": { type: "string", default: "/tmp/icom-policy-prepared" },
      sources: { type: "string" },
      inputs: { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  const result = prepareEducationCatalog({
    ...(values.sources
      ? {
          sources: (await items(
            values.sources,
          )) as EducationPreparationSource[],
        }
      : {}),
    ...(values.inputs ? { inputs: await items(values.inputs) } : {}),
  });
  const output = resolve(values["out-dir"]!);
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, "catalog.json"),
    JSON.stringify(
      {
        schemaVersion: "education-prepared-catalog-1",
        catalog: result.catalog,
        sourceVersions: result.sourceVersions,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    join(output, "queue.json"),
    JSON.stringify(
      {
        schemaVersion: "education-preparation-queue-1",
        summary: result.summary,
        items: result.queue,
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(join(output, "summary.md"), renderSummary(result));
  console.log(JSON.stringify({ output, ...result.summary }));
  if (result.summary.invalidCount) process.exitCode = 1;
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "education-preparation-failed",
  );
  process.exitCode = 1;
});
