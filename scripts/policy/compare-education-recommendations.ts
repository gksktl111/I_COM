import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import module from "node:module";
import {
  COMPARISON_TIME,
  createEducationComparisonReport,
  renderEducationComparisonMarkdown,
} from "../../src/features/policy/server/education-comparison.ts";

const usage = `교육 20건 오프라인 비교 (Node 24)
node --experimental-strip-types scripts/policy/compare-education-recommendations.ts [--out-dir /tmp/icom-education-comparison]

보존 20건의 문구 관련성 baseline, 현재 검수 등록부, 내부 FIXTURE 초안을 비교합니다.
네트워크·DB 조회나 실정책 승인 변경은 하지 않습니다. 고정 시나리오와 시각으로 JSON/Markdown을 생성합니다.`;

async function main() {
  const { values } = parseArgs({
    strict: true,
    options: {
      "out-dir": { type: "string", default: "/tmp/icom-education-comparison" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  // Node CLI has no Next bundler. Match existing server tests' server-only marker shim.
  const { registerHooks } = module as unknown as {
    registerHooks(hooks: {
      resolve(
        s: string,
        c: unknown,
        next: (s: string, c: unknown) => unknown,
      ): unknown;
    }): { deregister(): void };
  };
  const hooks = registerHooks({
    resolve(s, c, next) {
      return s === "server-only"
        ? { url: "data:text/javascript,export {};", shortCircuit: true }
        : next(s, c);
    },
  });
  let registry;
  try {
    registry = await import(
      "../../src/features/policy/server/released-catalog.ts"
    );
  } finally {
    hooks.deregister();
  }
  const registryBefore = JSON.stringify(registry.educationRecommendationDraft);
  const publicRelease = await registry.createReviewedCatalogLoader(
    registry.educationRecommendationDraft,
    async () => {
      throw new Error(
        "offline-comparison-cannot-verify-new-review-source: 현재 검수 등록부에 정책이 추가되었습니다. 최신 소스 검증 없이 공개 상태를 추정하지 않습니다.",
      );
    },
    () => new Date(COMPARISON_TIME),
  )();
  const report = await createEducationComparisonReport({
    publicRelease,
    reviewDecisionCount: registry.educationReviewDecisions.length,
  });
  if (JSON.stringify(registry.educationRecommendationDraft) !== registryBefore)
    throw new Error("production-registry-mutated");
  const output = resolve(values["out-dir"]!);
  await mkdir(output, { recursive: true });
  const json = join(output, "education-recommendation-comparison.json");
  const markdown = join(output, "education-recommendation-comparison.md");
  await writeFile(json, JSON.stringify(report, null, 2) + "\n");
  await writeFile(markdown, renderEducationComparisonMarkdown(report));
  console.log(
    JSON.stringify(
      {
        json,
        markdown,
        counts: report.counts,
        currentPublicRulePolicies: report.evidence.publicPolicyIds.length,
        actualUserFlowMethods: [
          ...new Set(
            report.scenarios.map((scenario) => scenario.actualUserFlow.method),
          ),
        ],
        baselineTop5E18E20: report.findings.baselineTop5E18E20,
        discoveryChanges: report.scenarios.map((scenario) => ({
          scenarioId: scenario.id,
          added: scenario.actualUserFlow.addedSampleIds,
          removed: scenario.actualUserFlow.removedSampleIds,
        })),
        conclusion:
          "분야 발견 교정이며 자격 정확도 미검증; 승인·완전 경로 없는 초안은 내부 비교만 수행",
      },
      null,
      2,
    ),
  );
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "education-comparison-failed",
  );
  process.exitCode = 1;
});
