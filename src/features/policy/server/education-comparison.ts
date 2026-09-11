import sample from "../../../../docs/fixtures/policy-recommendation/education-sample-20260909.json" with { type: "json" };
import mappingA from "../../../../docs/fixtures/policy-recommendation/education-mapping-a-20260909.json" with { type: "json" };
import mappingB from "../../../../docs/fixtures/policy-recommendation/education-mapping-b-20260909.json" with { type: "json" };
import { createHash } from "node:crypto";
import { createGuidedRecommendationService } from "./guided-recommendation.ts";
import {
  createCategoryRecommendationService,
  type CategoryBankRequest,
} from "./category-recommendation.ts";
import {
  educationPreparedCatalog as educationDraftCatalog,
  educationPreparationQueue,
  educationPreparedSourceVersions as educationSourceVersions,
} from "./catalogs/education-prepared.ts";
import { projectBankFacts } from "../recommendation/bank-facts.ts";
import { evaluateRecommendation } from "../recommendation/engine.ts";
import { evaluatePredicate } from "../recommendation/eligibility.ts";
import type { BankAnswer } from "../recommendation/category-bank.ts";
import type { PublicPolicy } from "../public/types.ts";
import type { RecommendationCatalog } from "./recommendation-release.ts";
import type { Request } from "../recommendation/types.ts";

export const COMPARISON_TIME = "2026-09-11T00:00:00.000Z";
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const mappings = [...mappingA.items, ...mappingB.items];
const sampleIdFor = (id: string) =>
  sample.items.find((item) => item.source_id === id)?.sample_id ?? id;

export type EducationComparisonScenario = {
  id: string;
  description: string;
  request: CategoryBankRequest;
};
type School = { stage: string; region: string; grade?: string; entry?: string };
function scenario(
  id: string,
  description: string,
  needs: string[],
  home: [string, string] | null,
  schools: (School | null)[],
): EducationComparisonScenario {
  const children = schools.map((_, i) => ({
    id: `child-${i + 1}`,
    sex: null,
    birthYear: null,
  }));
  const bankAnswers: BankAnswer[] = [];
  schools.forEach((school, i) => {
    const subjectId = children[i].id;
    bankAnswers.push({ questionId: "C-TIMING", subjectId, state: "DONT_KNOW" });
    if (!school) {
      bankAnswers.push({ questionId: "E01", subjectId, state: "DONT_KNOW" });
    } else {
      for (const [questionId, value] of [
        ["E01", "ENROLLED"],
        ["E02", school.stage],
        ["E03", school.grade ?? "G1"],
        ["E04", school.region],
      ])
        bankAnswers.push({ questionId, subjectId, state: "PROVIDED", value });
    }
    if (needs.some((need) => ["uniform", "entry-preparation"].includes(need)))
      bankAnswers.push(
        school
          ? {
              questionId: "E05",
              subjectId,
              state: "PROVIDED",
              value: school.entry ?? "FIRST",
            }
          : { questionId: "E05", subjectId, state: "SKIPPED" },
      );
  });
  return {
    id,
    description,
    request: {
      flow: "CATEGORY_BANK_V1",
      revision: 0,
      category: "education",
      needs,
      childProfiles: children,
      bankAnswers,
      phase: "RESULTS",
      ...(home
        ? {
            residence: {
              region: home[0],
              district: home[1],
              basis: "REGISTERED_RESIDENCE",
              reference: "CURRENT",
            } as const,
          }
        : {}),
    },
  };
}

/** Synthetic inputs use actual bank codes; no historical residence or age inference. */
export function educationComparisonScenarios(): EducationComparisonScenario[] {
  return [
    scenario(
      "uniform-high-busan",
      "기장군 현재 거주·부산 고등학교·교복 필요",
      ["uniform"],
      ["부산광역시", "기장군"],
      [{ stage: "HIGH", region: "부산광역시|기장군" }],
    ),
    scenario(
      "uniform-middle-busan",
      "기장군 현재 거주·부산 중학교·교복 필요",
      ["uniform"],
      ["부산광역시", "기장군"],
      [{ stage: "MIDDLE", region: "부산광역시|기장군" }],
    ),
    scenario(
      "uniform-middle-outside-busan",
      "기장군 현재 거주·울산 중학교·교복 필요",
      ["uniform"],
      ["부산광역시", "기장군"],
      [{ stage: "MIDDLE", region: "울산광역시|남구" }],
    ),
    scenario(
      "entry-elementary-outside-seoul",
      "관악구 현재 거주·경기 초등학교 1학년·입학준비 필요",
      ["entry-preparation"],
      ["서울특별시", "관악구"],
      [{ stage: "ELEMENTARY", region: "경기도|수원시 영통구" }],
    ),
    scenario(
      "entry-elementary-seoul",
      "관악구 현재 거주·서울 초등학교 1학년·입학준비 필요",
      ["entry-preparation"],
      ["서울특별시", "관악구"],
      [{ stage: "ELEMENTARY", region: "서울특별시|관악구" }],
    ),
    scenario(
      "learning-elementary",
      "현행 지역 사전의 전남광주통합특별시 동구·초등학교 4학년·학습 필요",
      ["learning"],
      ["전남광주통합특별시", "동구"],
      [{ stage: "ELEMENTARY", grade: "G4", region: "전남광주통합특별시|동구" }],
    ),
    scenario(
      "two-children-different-schools",
      "첫째 부산 고등학교·둘째 경기 초등학교, 교복과 입학준비 필요",
      ["uniform", "entry-preparation"],
      ["서울특별시", "관악구"],
      [
        { stage: "HIGH", region: "부산광역시|기장군" },
        { stage: "ELEMENTARY", region: "경기도|수원시 영통구" },
      ],
    ),
    scenario(
      "unknown-uniform",
      "거주지·학교급 모름, 입학유형 건너뜀·교복 필요",
      ["uniform"],
      null,
      [null],
    ),
    scenario(
      "unknown-all-purposes",
      "거주지·학교급 모름·세부 목적 선택 없음",
      [],
      null,
      [null],
    ),
  ];
}

export function educationSamplePolicies(): PublicPolicy[] {
  return sample.items.map((item) => ({
    id: item.source_id,
    ...item.display,
    required_documents_text: null,
    reception_text: null,
    contact_text: null,
    updated_at: null,
  }));
}

export async function createEducationComparisonReport({
  publicRelease,
  reviewDecisionCount,
  scenarios = educationComparisonScenarios(),
}: {
  publicRelease: RecommendationCatalog;
  reviewDecisionCount: number;
  scenarios?: EducationComparisonScenario[];
}) {
  const originalDraftDigest = digest(educationDraftCatalog);
  const draft = structuredClone(educationDraftCatalog);
  // Internal simulation only: preserve incomplete paths and all unresolved expressions.
  for (const policy of draft.policies) {
    policy.release = "FIXTURE";
    for (const rule of policy.rules) rule.review = "FIXTURE";
  }
  const baseline = createCategoryRecommendationService({
    loadPolicies: async () => educationSamplePolicies(),
    classifyScope: () => undefined,
    filterResidence: false,
  });
  const currentProvisional = createCategoryRecommendationService({
    loadPolicies: async () => educationSamplePolicies(),
  });
  const actualUserFlow = createGuidedRecommendationService({
    loadCatalog: async () => publicRelease,
    recommendProvisional: currentProvisional,
    now: () => new Date(COMPARISON_TIME),
  });
  const coverage = sample.items.map((item) => {
    const mapping = mappings.find((m) => m.sample_id === item.sample_id);
    if (!mapping) throw new Error(`missing-sample-mapping:${item.sample_id}`);
    const policy = educationDraftCatalog.policies.find(
      (p) => p.id === item.source_id,
    );
    const source = educationSourceVersions[item.source_id];
    return {
      sampleId: item.sample_id,
      policyId: item.source_id,
      title: item.display.name,
      disposition: mapping.education_disposition,
      dispositionReason: mapping.disposition_reason,
      mappingKind:
        item.sample_id <= "E10" ? mappingA.review_kind : mappingB.review_kind,
      mappedPaths: mapping.service_paths.map((path) => ({
        id: path.path_id,
        purpose: path.purpose,
        beneficiary: path.beneficiary,
        completeness: path.condition_completeness,
        questionIds: path.question_ids,
        userQuestionsMissing: path.missing_user_questions,
        policyGaps: path.policy_gaps,
        evidenceCount: path.evidence.length,
      })),
      draftCoverage: policy ? "INCOMPLETE_DRAFT" : "NOT_IN_DRAFT_CATALOG",
      draftPolicyRelease: policy?.release ?? null,
      draftPaths:
        policy?.paths.map((path) => ({
          id: path.id,
          complete: path.complete,
          purposes: path.purposes,
          purposesComplete: path.purposesComplete ?? null,
        })) ?? [],
      officialDraftGaps:
        educationPreparationQueue.find(
          (entry) => entry.policyId === item.source_id,
        )?.details ?? [],
      archivedSource: {
        snapshotId: item.snapshot_id,
        normalizedFingerprint: item.normalized_sha256,
      },
      draftSource: source ?? null,
      archivedSourceMatchesDraft: source
        ? source.snapshotId === item.snapshot_id &&
          source.normalizedFingerprint === item.normalized_sha256
        : null,
    };
  });
  const results = [];
  for (const scenario of scenarios) {
    const projected = projectBankFacts(
      scenario.request,
      scenario.request.bankAnswers,
      COMPARISON_TIME,
    );
    const engineRequest: Request = {
      ...projected,
      revision: scenario.request.revision,
      category: "education",
      needs: scenario.request.needs,
      householdId: "HOUSEHOLD",
      subjectsComplete: true,
      questionCount: 0,
      phase: "RESULTS",
      evaluatedAt: COMPARISON_TIME,
      view: "CURRENT",
      mode: "FIXTURE",
    };
    const base = await baseline(scenario.request);
    const simulation = evaluateRecommendation(draft, engineRequest);
    const currentPublic = evaluateRecommendation(publicRelease.catalog, {
      ...engineRequest,
      mode: "PUBLIC",
    });
    const actual = await actualUserFlow(scenario.request);
    const candidates = new Set(simulation.cards.map((card) => card.policyId));
    const rankedSampleIds = base.policies.map((item) =>
      sampleIdFor(item.policy.id),
    );
    results.push({
      id: scenario.id,
      description: scenario.description,
      input: structuredClone(scenario.request),
      projectedFacts: projected,
      baseline: {
        method: "ARCHIVED_TEXT_RELEVANCE",
        candidateCount: base.candidateCount,
        rankedSampleIds,
        top5: rankedSampleIds.slice(0, 5),
        rankedPolicies: base.policies.map((item, index) => ({
          rank: index + 1,
          sampleId: sampleIdFor(item.policy.id),
          policyId: item.policy.id,
          score: item.score,
          reasons: item.reasons,
        })),
        absentSampleIds: coverage
          .filter(
            (item) => !base.policies.some((p) => p.policy.id === item.policyId),
          )
          .map((item) => item.sampleId),
      },
      currentPublic: {
        coverage: publicRelease.coverage,
        candidateCount: currentPublic.candidateCount,
        rankedSampleIds: currentPublic.cards.map((card) =>
          sampleIdFor(card.policyId),
        ),
      },
      actualUserFlow: {
        dataSource: "ARCHIVED_20_ROWS_WITH_CURRENT_GUIDED_SERVICE",
        method: actual.method,
        candidateCount: actual.candidateCount,
        rankedSampleIds: actual.policies.map((item) =>
          sampleIdFor(item.policy.id),
        ),
        top5: actual.top5.map(sampleIdFor),
        addedSampleIds: actual.policies
          .filter(
            (item) =>
              !base.policies.some(
                (before) => before.policy.id === item.policy.id,
              ),
          )
          .map((item) => sampleIdFor(item.policy.id)),
        removedSampleIds: base.policies
          .filter(
            (item) =>
              !actual.policies.some(
                (after) => after.policy.id === item.policy.id,
              ),
          )
          .map((item) => sampleIdFor(item.policy.id)),
      },
      draftSimulation: {
        mode: "FIXTURE_INTERNAL_ONLY",
        candidateCount: simulation.candidateCount,
        rankedSampleIds: simulation.cards.map((card) =>
          sampleIdFor(card.policyId),
        ),
        cards: simulation.cards.map((card) => {
          const policy = draft.policies.find((p) => p.id === card.policyId)!;
          return {
            sampleId: sampleIdFor(card.policyId),
            policyId: card.policyId,
            eligibility: card.eligibility,
            representative: {
              pathId: card.representative.pathId,
              subject: card.representative.subject,
              rank: card.representative.rank,
              needFit: card.representative.features[0].value,
            },
            tags: card.tags,
            unknowns: card.checksNeeded,
            paths: card.pathResults.map((path) => ({
              pathId: path.pathId,
              subject: path.subject,
              eligibility: path.eligibility,
              availability: path.availability,
            })),
            subjectRuleEvaluations: projected.selectedChildren.map((id) => ({
              subject: { kind: "CHILD" as const, id },
              rules: policy.rules.map((rule) => ({
                ruleId: rule.id,
                label: rule.label,
                result: evaluatePredicate(rule, {
                  answers: projected.answers,
                  beneficiary: { kind: "CHILD", id },
                  household: { kind: "HOUSEHOLD", id: "HOUSEHOLD" },
                  sourceVersion: policy.sourceVersion,
                  mode: "FIXTURE",
                }),
              })),
            })),
          };
        }),
        eligibilityExcludedSampleIds: draft.policies
          .filter(
            (p) =>
              !candidates.has(p.id) &&
              p.paths.every(
                (path) =>
                  path.availability === "UNKNOWN" ||
                  path.availability === "OPEN",
              ),
          )
          .map((p) => sampleIdFor(p.id)),
        notInDraftSampleIds: coverage
          .filter((item) => item.draftCoverage === "NOT_IN_DRAFT_CATALOG")
          .map((item) => item.sampleId),
      },
    });
  }
  if (originalDraftDigest !== digest(educationDraftCatalog))
    throw new Error("production-draft-mutated");
  const exposureFindings = results.flatMap((result) =>
    result.baseline.top5.flatMap((sampleId) => {
      const item = coverage.find((item) => item.sampleId === sampleId)!;
      return ["E18", "E20"].includes(sampleId)
        ? [
            {
              scenarioId: result.id,
              sampleId,
              baselineRank:
                result.baseline.rankedSampleIds.indexOf(sampleId) + 1,
              disposition: item.disposition,
              reason: item.dispositionReason,
            },
          ]
        : [];
    }),
  );
  return {
    schemaVersion: 1,
    evaluatedAt: COMPARISON_TIME,
    scope: "OFFLINE_ARCHIVED_20_VS_CURRENT_REGISTRY_AND_INTERNAL_DRAFT",
    evidence: {
      sampleMode: sample.mode,
      selection: sample.selection,
      remoteStateVerified: sample.current_remote_state_verified,
      sampleDigest: digest(sample),
      mappingADigest: digest(mappingA),
      mappingBDigest: digest(mappingB),
      draftDigest: originalDraftDigest,
      draftVersion: educationDraftCatalog.version,
      publicCatalogVersion: publicRelease.catalog.version,
      publicPolicyIds: publicRelease.catalog.policies.map((p) => p.id),
      reviewDecisionCount,
    },
    limitations: [
      "20건은 목적 표집한 보존 자료이며 독립 성능 평가 표본이 아닙니다. 정확도·효과 개선 비율을 산출하지 않습니다.",
      "baseline은 보존 표시 문자열의 관련성 추천입니다. 현재 원격 공개 데이터의 재조회 결과가 아닙니다.",
      "baseline의 classifyScope는 항상 undefined로 고정해 수정 전 분야 발견을 보존합니다. 현재 잠정 서비스는 기본 분류 보정을 적용합니다. 이는 분야 발견 교정이며 자격 정확도·추천 효과는 미검증입니다.",
      "현재 PUBLIC 규칙 경로는 실제 검수 등록부를 사용합니다. 규칙 0건은 사용자 목록 0건이 아닙니다. 현재 guided 서비스는 미승인 분야에 분류 보정을 적용한 PROVISIONAL 추천을 제공하며, 이 보고서에서는 같은 보존 20건으로 실제 분기를 실행합니다.",
      "초안은 복사본의 release/rule만 FIXTURE로 바꾼 내부 계산입니다. HUMAN 승인 생성이나 production 등록부 변경을 하지 않습니다.",
      "경로·목적의 불완전성과 UNRESOLVED는 유지합니다. 일부 원자 조건 TRUE/FALSE도 정책 전체 자격 확정이나 효과 검증이 아닙니다.",
      "현재 가구 주소를 학생의 과거 기준일·신청일 거주로 대체하지 않습니다. 입학 연도·법정 학교 여부·중복 지원 등의 추가 사실은 만들지 않습니다.",
      `초안에 없는 ${sample.items.length - educationDraftCatalog.policies.length}건은 NOT_IN_DRAFT_CATALOG이며 INELIGIBLE이 아닙니다. 현재 승인과 완전한 경로가 없으므로 추천 효과는 미검증입니다.`,
    ],
    counts: {
      samplePolicies: coverage.length,
      mappingPaths: coverage.reduce(
        (n, item) => n + item.mappedPaths.length,
        0,
      ),
      draftPolicies: educationDraftCatalog.policies.length,
      draftPaths: educationDraftCatalog.policies.reduce(
        (n, p) => n + p.paths.length,
        0,
      ),
      scenarios: results.length,
    },
    coverage,
    scenarios: results,
    findings: { baselineTop5E18E20: exposureFindings },
  };
}
export type EducationComparisonReport = Awaited<
  ReturnType<typeof createEducationComparisonReport>
>;

const cell = (value: string) =>
  value.replaceAll("|", "\\|").replaceAll("\n", " ");
export function renderEducationComparisonMarkdown(
  report: EducationComparisonReport,
): string {
  const lines = [
    "# 교육 20건 추천 비교",
    "",
    `고정 평가 시각: ${report.evaluatedAt}`,
    "",
    "**내부 비교 자료 · 실정책 승인 없음 · 추천 효과 미검증**",
    "",
    `보존 정책 ${report.counts.samplePolicies}건 / 매핑 경로 ${report.counts.mappingPaths}개 / 구현 초안 ${report.counts.draftPolicies}건·${report.counts.draftPaths}경로 / 시나리오 ${report.counts.scenarios}개`,
    "",
    `실제 검수 결정 ${report.evidence.reviewDecisionCount}건. 현재 PUBLIC 규칙 정책 ${report.evidence.publicPolicyIds.length}건. 이는 사용자 추천 목록이 비었다는 뜻이 아닙니다. 미승인 분야의 실제 서비스는 잠정 추천을 제공합니다. 공개 카탈로그 버전: \`${report.evidence.publicCatalogVersion}\`.`,
    "",
    "## 해석 한계",
    "",
    ...report.limitations.map((line) => `- ${line}`),
    "",
    "## 전체 20건 매핑·구현 범위",
    "",
    "| 표본 | 정책 | 설계 처분 | 매핑 경로 | 초안 경로 | 구현 범위 |",
    "| --- | --- | --- | ---: | ---: | --- |",
    ...report.coverage.map(
      (item) =>
        `| ${item.sampleId} | ${cell(item.title)} | ${item.disposition} | ${item.mappedPaths.length} | ${item.draftPaths.length} | ${item.draftCoverage} |`,
    ),
    "",
    "## 시나리오별 결과",
    "",
  ];
  for (const scenario of report.scenarios) {
    lines.push(
      `### ${scenario.id}`,
      "",
      scenario.description,
      "",
      `- 실제 bank 코드: ${scenario.input.bankAnswers.map((a) => `${a.subjectId}/${a.questionId}=${a.value ?? a.state}`).join(", ")}`,
      `- Baseline 전체 순서: ${scenario.baseline.rankedSampleIds.join(" → ") || "없음"}`,
      `- Baseline Top 5: ${scenario.baseline.top5.join(", ") || "없음"}`,
      `- 현재 PUBLIC 규칙 경로: ${scenario.currentPublic.coverage}, ${scenario.currentPublic.candidateCount}건. 순서: ${scenario.currentPublic.rankedSampleIds.join(", ") || "없음"}`,
      `- 실제 사용자 흐름(같은 보존 표본): ${scenario.actualUserFlow.method}, ${scenario.actualUserFlow.candidateCount}건. 순서: ${scenario.actualUserFlow.rankedSampleIds.join(" → ") || "없음"}`,
      `- 수정 전후 분야 발견 변화: 추가 ${scenario.actualUserFlow.addedSampleIds.join(", ") || "없음"}; 제외 ${scenario.actualUserFlow.removedSampleIds.join(", ") || "없음"}. 분야 발견 교정이며 자격 정확도는 미검증입니다.`,
      `- 내부 초안 순서: ${scenario.draftSimulation.rankedSampleIds.join(" → ") || "없음"}`,
      `- 초안 자격 제외: ${scenario.draftSimulation.eligibilityExcludedSampleIds.join(", ") || "없음"}; 초안 미구현: ${scenario.draftSimulation.notInDraftSampleIds.join(", ")}`,
      "",
      "| 초안 | 대표 상태 | 필요 관련성 | 대상별 상태 | 원자 규칙 비교 | 미확인 원인 |",
      "| --- | --- | --- | --- | --- | --- |",
      ...scenario.draftSimulation.cards.map((card) => {
        const rules = card.subjectRuleEvaluations
          .map(
            (subject) =>
              `${subject.subject.id}: ${
                subject.rules
                  .filter((r) => r.result.value !== "UNKNOWN")
                  .map((r) => `${r.ruleId}=${r.result.value}`)
                  .join(", ") || "확정 비교 없음"
              }`,
          )
          .join("; ");
        return `| ${card.sampleId} | ${card.eligibility} | ${card.representative.needFit} | ${card.tags.map((tag) => `${tag.subject.id}:${tag.eligibility}`).join(", ")} | ${cell(rules)} | ${[...new Set(card.unknowns.map((u) => u.kind))].join(", ")} |`;
      }),
      "",
    );
  }
  lines.push("## 실제 관찰", "");
  for (const finding of report.findings.baselineTop5E18E20)
    lines.push(
      `- ${finding.scenarioId}: ${finding.sampleId}가 baseline ${finding.baselineRank}위. 매핑 처분 ${finding.disposition}: ${finding.reason}`,
    );
  if (!report.findings.baselineTop5E18E20.length)
    lines.push(
      "- 이 시나리오들에서는 E18/E20의 baseline Top 5 노출이 관찰되지 않았습니다.",
    );
  lines.push("", "## 표본별 보완 사항", "");
  for (const item of report.coverage) {
    lines.push(
      `### ${item.sampleId} ${item.title}`,
      "",
      item.dispositionReason,
      ...item.mappedPaths.map(
        (path) =>
          `- ${path.id}: ${path.purpose} / ${path.completeness}; 미확인: ${path.policyGaps.join(" / ")}`,
      ),
      ...item.officialDraftGaps.map((gap) => `- 공식 초안 검수 과제: ${gap}`),
      "",
    );
  }
  lines.push(
    "## 재현 정보",
    "",
    "입력과 원자 규칙·경로별 미확인 사유는 함께 생성한 JSON에 보존됩니다.",
    "",
    `- 표본 SHA-256: \`${report.evidence.sampleDigest}\``,
    `- 매핑 A/B SHA-256: \`${report.evidence.mappingADigest}\` / \`${report.evidence.mappingBDigest}\``,
    `- 원본 초안 SHA-256: \`${report.evidence.draftDigest}\``,
    "",
  );
  return lines.join("\n");
}
