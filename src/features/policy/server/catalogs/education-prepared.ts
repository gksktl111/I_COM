import supplementalEvidence from "../../../../../docs/fixtures/policy-recommendation/education-supplemental-evidence-20260911.json" with { type: "json" };
import sourceBundle from "../../../../../docs/fixtures/policy-recommendation/education-template-sources-20260911.json" with { type: "json" };
import recipeBundle from "../../../../../docs/fixtures/policy-recommendation/education-template-inputs-20260911.json" with { type: "json" };
import mappingA from "../../../../../docs/fixtures/policy-recommendation/education-mapping-a-20260909.json" with { type: "json" };
import mappingB from "../../../../../docs/fixtures/policy-recommendation/education-mapping-b-20260909.json" with { type: "json" };
import archivedSample from "../../../../../docs/fixtures/policy-recommendation/education-sample-20260909.json" with { type: "json" };
import {
  compilePolicyTemplates,
  type PreparationIssue,
  type TemplateSource,
} from "../../recommendation/template-compiler.ts";
import { validateCatalog } from "../../recommendation/engine.ts";
import type {
  Catalog,
  QuestionDefinition,
} from "../../recommendation/types.ts";
import { hashJson } from "../normalize.ts";
import type { RecommendationSource } from "../recommendation-sources.ts";
import {
  educationDraftCatalog,
  educationReviewGaps,
  educationSourceVersions,
} from "./education-2026.ts";

export type EducationPreparationSource = RecommendationSource & {
  sampleId: string;
};
export type EducationPreparationIssue = PreparationIssue & {
  method: "MANUAL" | "TEMPLATE" | "NOT_PREPARED";
  disposition: string;
  archivedDisposition?: string;
  disposition_reason: string;
  /** A HOLD is not a compiler failure or an eligibility rejection. */
  holdReason?: "INSUFFICIENT_EVIDENCE" | "SCOPE_REVIEW" | "NOT_IMPLEMENTED";
  sourceVersion?: string;
  observedSourceVersion?: string;
};
export type EducationPreparation = {
  catalog: Catalog;
  sourceVersions: Record<string, RecommendationSource["source"]>;
  queue: EducationPreparationIssue[];
  summary: {
    status: "PREPARED_DRAFT" | "PARTIAL_INVALID";
    sourceCount: number;
    preparedDraftCount: number;
    manualCount: number;
    templateCount: number;
    heldCount: number;
    invalidCount: number;
    policyCount: number;
    ruleCount: number;
    questionCount: number;
    humanReleaseCount: number;
    humanRuleCount: number;
    completePolicyCount: number;
    completePathCount: number;
  };
};

const mappings = [...mappingA.items, ...mappingB.items];
// Dispositions refer to this fixed sample identity, not the order of fresh rows.
const samplePolicyIds = new Map(
  archivedSample.items.map((item) => [item.sample_id, item.source_id]),
);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fingerprint = /^[a-f0-9]{64}$/;
function mergeCatalogs(manual: Catalog, compiled: Catalog): Catalog {
  const policies = [...structuredClone(manual.policies), ...compiled.policies];
  if (new Set(policies.map((p) => p.id)).size !== policies.length)
    throw new Error("duplicate-prepared-policy");
  const questions = new Map<string, QuestionDefinition>();
  for (const q of [...manual.questions, ...compiled.questions]) {
    const previous = questions.get(q.id);
    if (previous && hashJson(previous) !== hashJson(q))
      throw new Error("conflicting-prepared-question");
    if (!previous) questions.set(q.id, structuredClone(q));
  }
  const catalog = {
    version: `education-prepared-${hashJson({ manualVersion: manual.version, compiledVersion: compiled.version })}`,
    policies,
    questions: [...questions.values()],
  };
  validateCatalog(catalog);
  return catalog;
}

/** Offline assembly only. Current identity never rewrites or approves the two manual drafts. */
export function prepareEducationCatalog({
  sources = sourceBundle.items,
  inputs = recipeBundle.items,
}: {
  sources?: EducationPreparationSource[];
  inputs?: unknown[];
} = {}): EducationPreparation {
  const byId = new Map<string, EducationPreparationSource>();
  const bySample = new Map<string, EducationPreparationSource>();
  const expectedSamples = new Set(mappings.map((m) => m.sample_id));
  for (const row of sources) {
    if (
      !row ||
      !expectedSamples.has(row.sampleId) ||
      bySample.has(row.sampleId) ||
      !row.policy ||
      typeof row.policy.id !== "string" ||
      !uuid.test(row.policy.id) ||
      samplePolicyIds.get(row.sampleId) !== row.policy.id ||
      byId.has(row.policy.id) ||
      !row.source ||
      typeof row.source.snapshotId !== "string" ||
      !uuid.test(row.source.snapshotId) ||
      typeof row.source.normalizerVersion !== "string" ||
      !row.source.normalizerVersion.trim() ||
      typeof row.source.displayHash !== "string" ||
      !fingerprint.test(row.source.displayHash) ||
      typeof row.source.normalizedFingerprint !== "string" ||
      !fingerprint.test(row.source.normalizedFingerprint)
    )
      throw new Error("invalid-education-source-bundle");
    byId.set(row.policy.id, row);
    bySample.set(row.sampleId, row);
  }
  if (bySample.size !== expectedSamples.size)
    throw new Error("incomplete-education-source-bundle");
  for (const policy of educationDraftCatalog.policies)
    if (!byId.has(policy.id))
      throw new Error("missing-manual-education-source");

  const compilerSources: TemplateSource[] = sources.map(
    ({ policy, source }) => ({
      id: policy.id,
      title: policy.name,
      version: source.normalizedFingerprint,
      evidenceDocuments: supplementalEvidence.items.find(
        (item) => item.policyId === policy.id,
      )?.documents as TemplateSource["evidenceDocuments"],
      fields: Object.fromEntries(
        Object.entries(policy).filter(
          (entry): entry is [string, string | null] =>
            typeof entry[1] === "string" || entry[1] === null,
        ),
      ),
    }),
  );
  const compiled = compilePolicyTemplates(compilerSources, inputs);
  const catalog = mergeCatalogs(educationDraftCatalog, compiled.catalog);
  const sourceVersions = structuredClone(educationSourceVersions);
  for (const policy of compiled.catalog.policies) {
    const source = byId.get(policy.id)!.source;
    sourceVersions[policy.id] = {
      snapshotId: source.snapshotId,
      normalizerVersion: source.normalizerVersion,
      displayHash: source.displayHash,
      normalizedFingerprint: source.normalizedFingerprint,
    };
  }
  const compilerQueue = new Map<string, PreparationIssue[]>();
  for (const issue of compiled.queue) {
    const existing = compilerQueue.get(issue.policyId) ?? [];
    existing.push(issue);
    compilerQueue.set(issue.policyId, existing);
  }
  const queue: EducationPreparationIssue[] = [];
  for (const row of sources) {
    const mapping = mappings.find((m) => m.sample_id === row.sampleId)!;
    const shared = {
      policyId: row.policy.id,
      sampleId: row.sampleId,
      disposition: mapping.education_disposition,
      disposition_reason: mapping.disposition_reason,
      observedSourceVersion: row.source.normalizedFingerprint,
    };
    const manual = educationDraftCatalog.policies.find(
      (p) => p.id === row.policy.id,
    );
    if (manual) {
      const ruleFacts = new Set(
        manual.rules.map((rule) => hashJson(rule.fact)),
      );
      const sameSource =
        hashJson(educationSourceVersions[manual.id]) === hashJson(row.source);
      queue.push({
        ...shared,
        method: "MANUAL",
        status: "PREPARED_DRAFT",
        sourceVersion: manual.sourceVersion,
        codes: [
          "HUMAN_REVIEW_REQUIRED",
          "INCOMPLETE_PATHS",
          ...(sameSource ? [] : ["MANUAL_SOURCE_CHANGED_REVIEW_REQUIRED"]),
        ],
        details: [
          ...educationReviewGaps[manual.id],
          ...(sameSource
            ? []
            : [
                "현재 원본 식별자가 수동 초안의 기준과 다릅니다. 기존 규칙·원본 버전을 유지하며 자동으로 새 원본에 연결하지 않습니다.",
              ]),
        ],
        ruleCount: manual.rules.length,
        questionCount: educationDraftCatalog.questions.filter((q) =>
          ruleFacts.has(hashJson(q.fact)),
        ).length,
      });
      continue;
    }
    const issues = compilerQueue.get(row.policy.id);
    if (issues?.length) {
      // Duplicate/malformed recipes retain every compiler issue, never an apparent success.
      for (const issue of issues)
        queue.push({
          ...issue,
          ...shared,
          ...(issue.status === "PREPARED_DRAFT" &&
          mapping.education_disposition !== "CANDIDATE"
            ? {
                disposition: "CANDIDATE",
                archivedDisposition: mapping.education_disposition,
                disposition_reason:
                  "기존 보류 사유를 공식 보충 근거로 확인하여 조건 초안을 준비했습니다. 남은 예외와 공개 검수는 별도입니다.",
              }
            : {}),
          method: "TEMPLATE",
          sourceVersion: row.source.normalizedFingerprint,
        });
      continue;
    }
    const candidate = mapping.education_disposition === "CANDIDATE";
    const holdReason = candidate
      ? "NOT_IMPLEMENTED"
      : mapping.education_disposition === "HOLD"
        ? "INSUFFICIENT_EVIDENCE"
        : "SCOPE_REVIEW";
    queue.push({
      ...shared,
      method: "NOT_PREPARED",
      status: "HELD",
      holdReason,
      codes: [
        candidate
          ? "TEMPLATE_NOT_IMPLEMENTED"
          : holdReason === "INSUFFICIENT_EVIDENCE"
            ? "EVIDENCE_REVIEW_REQUIRED"
            : "EDUCATION_SCOPE_REVIEW_REQUIRED",
      ],
      details: [
        mapping.disposition_reason,
        ...mapping.service_paths.flatMap((path) => path.policy_gaps),
      ],
      ruleCount: 0,
      questionCount: 0,
    });
  }
  // A manual draft must not hide a rejected recipe that targets its identity.
  // Unknown input identities likewise remain explicit errors outside the 20 source rows.
  const manualIds = new Set(educationDraftCatalog.policies.map((p) => p.id));
  for (const issue of compiled.queue)
    if (!byId.has(issue.policyId) || manualIds.has(issue.policyId))
      queue.push({
        ...issue,
        status: "INVALID",
        method: "TEMPLATE",
        disposition: manualIds.has(issue.policyId) ? "CANDIDATE" : "UNKNOWN",
        disposition_reason: manualIds.has(issue.policyId)
          ? "수동 초안 정책에 대한 별도 템플릿 입력이 거절되었습니다. 원래 수동 초안은 유지합니다."
          : "20건 원본에 연결되지 않은 준비 입력입니다.",
      });
  const invalidCount = queue.filter((q) => q.status === "INVALID").length;
  return {
    catalog,
    sourceVersions,
    queue,
    summary: {
      status: invalidCount ? "PARTIAL_INVALID" : "PREPARED_DRAFT",
      sourceCount: sources.length,
      preparedDraftCount: queue.filter((q) => q.status === "PREPARED_DRAFT")
        .length,
      manualCount: queue.filter((q) => q.method === "MANUAL").length,
      templateCount: queue.filter(
        (q) => q.method === "TEMPLATE" && q.status === "PREPARED_DRAFT",
      ).length,
      heldCount: queue.filter((q) => q.status === "HELD").length,
      invalidCount,
      policyCount: catalog.policies.length,
      ruleCount: catalog.policies.reduce(
        (sum, policy) => sum + policy.rules.length,
        0,
      ),
      questionCount: catalog.questions.length,
      humanReleaseCount: catalog.policies.filter((p) => p.release === "HUMAN")
        .length,
      humanRuleCount: catalog.policies.reduce(
        (sum, p) =>
          sum + p.rules.filter((rule) => rule.review === "HUMAN").length,
        0,
      ),
      completePolicyCount: catalog.policies.filter((p) => p.completePaths)
        .length,
      completePathCount: catalog.policies.reduce(
        (sum, p) => sum + p.paths.filter((path) => path.complete).length,
        0,
      ),
    },
  };
}

const prepared = prepareEducationCatalog();
export const educationPreparedCatalog = prepared.catalog;
export const educationPreparedSourceVersions = prepared.sourceVersions;
export const educationPreparationQueue = prepared.queue;
