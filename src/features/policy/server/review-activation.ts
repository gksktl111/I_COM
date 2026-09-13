import { createHash } from "node:crypto";
import { hashJson } from "./normalize.ts";
import { RECOMMENDATION_FIELDS } from "../recommendation/intake.ts";
import { POLICY_RELEVANCE_CATEGORIES } from "./relevance.ts";

export const REVIEW_RELEVANCE_VERSION = "policy-relevance-review-1";
export const REVIEW_DISPOSITION_VERSION = "policy-relevance-review-2";
export const REVIEW_CORRECTION_VERSION = "policy-relevance-review-3";
export const REVIEW_REASSESSMENT_VERSION = "policy-relevance-review-4";
export const REVIEW_TAG_VERSION = "policy-relevance-review-5";
export type OfficialReviewEvidence = {
  originalUrl: string;
  finalUrl: string;
  publisher: string;
  retrievedAt: string;
  // 원본 HTML 바이트가 아닌 검토 당시 캡처한 문맥 포함 평문과 그 UTF-8 SHA256이다.
  content: string;
  contentHash: string;
  excerpt: string;
  rule: string;
  policyIdentity: string;
  field: "target_text" | "benefit_text" | "criteria_text";
};
export type ReviewSourceRow = {
  source_id: string;
  applied_snapshot_id: string;
  normalized: Record<string, unknown> & {
    display: Record<string, unknown>;
    displayHash: string;
    normalizerVersion: string;
  };
  relevance: unknown;
  catalog_status: string;
};
export type ScopeReviewDecision = {
  sourceId: string;
  name: string;
  decision: "ACTIVATE" | "EXCLUDE" | "KEEP_REVIEW";
  categories: string[];
  evidence: { field: string; excerpt: string; rule: string }[];
  reason: string;
  conditionChecks?: string[];
  officialEvidence?: OfficialReviewEvidence[];
  sourceConsistency?: "CONFIRMED" | "CONFLICT" | "UNRESOLVED";
};
export type ReviewDecisions = {
  kind: "CATALOG_REVIEW_DECISIONS";
  inputQueriedAt: string;
  items: ScopeReviewDecision[];
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
function fail(reason: string): never { throw new Error(`invalid-review-plan:${reason}`); }

function validEvidenceUrl(value: unknown): boolean {
  if (!text(value) || !/^https?:\/\/[^\s/?#@]+(?:[/?#][^\s]*)?$/.test(value)) return false;
  try {
    const url = new URL(value);
    return Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

/** 오프라인 계획만 작성한다. 근거의 의미와 공식 기관·정책 일치 여부는 별도로 검토해야 한다. */
export function prepareReviewActivation(
  inventory: { queriedAt: string; rows: ReviewSourceRow[] },
  decisions: ReviewDecisions,
  version: typeof REVIEW_RELEVANCE_VERSION | typeof REVIEW_DISPOSITION_VERSION | typeof REVIEW_CORRECTION_VERSION | typeof REVIEW_REASSESSMENT_VERSION | typeof REVIEW_TAG_VERSION = REVIEW_RELEVANCE_VERSION,
  recordKept = false,
) {
  const tagging = version === REVIEW_TAG_VERSION;
  const reassessing = version === REVIEW_REASSESSMENT_VERSION;
  if (![REVIEW_RELEVANCE_VERSION, REVIEW_DISPOSITION_VERSION, REVIEW_CORRECTION_VERSION, REVIEW_REASSESSMENT_VERSION, REVIEW_TAG_VERSION].includes(version)) fail("version");
  if ((recordKept && version === REVIEW_RELEVANCE_VERSION) || (version === REVIEW_CORRECTION_VERSION && !recordKept)) fail("version");
  if (!Number.isFinite(Date.parse(inventory.queriedAt)) ||
      decisions.kind !== "CATALOG_REVIEW_DECISIONS" ||
      decisions.inputQueriedAt !== inventory.queriedAt ||
      !Array.isArray(inventory.rows) || !Array.isArray(decisions.items)) fail("inventory");
  const sources = new Map<string, ReviewSourceRow>();
  for (const row of inventory.rows) {
    if (!uuid.test(row.source_id) || !uuid.test(row.applied_snapshot_id) ||
        sources.has(row.source_id) || row.catalog_status !== (version === REVIEW_CORRECTION_VERSION ? "EXCLUDED" : "REVIEW") ||
        !row.normalized?.display || typeof row.normalized.display !== "object" ||
        !/^[a-f0-9]{64}$/.test(row.normalized.displayHash) ||
        !text(row.normalized.normalizerVersion)) fail("source");
    sources.set(row.source_id, row);
    if (reassessing && (!row.relevance || typeof row.relevance !== "object" ||
        ![REVIEW_DISPOSITION_VERSION, REVIEW_CORRECTION_VERSION].includes((row.relevance as Record<string, unknown>).version as string) ||
        (row.relevance as Record<string, unknown>).status !== "REVIEW")) fail("reassessment-source");
    if (tagging && (!row.relevance || typeof row.relevance !== "object" || Array.isArray(row.relevance) ||
        !["policy-relevance-1", "policy-relevance-2", "policy-relevance-3", REVIEW_RELEVANCE_VERSION, REVIEW_DISPOSITION_VERSION, REVIEW_CORRECTION_VERSION, REVIEW_REASSESSMENT_VERSION].includes((row.relevance as Record<string, unknown>).version as string) ||
        (row.relevance as Record<string, unknown>).status !== "REVIEW")) fail("tag-source");
    if (version === REVIEW_CORRECTION_VERSION &&
        (!row.relevance || typeof row.relevance !== "object" ||
          (row.relevance as Record<string, unknown>).version !== REVIEW_DISPOSITION_VERSION)) fail("correction-source");
  }
  const seen = new Set<string>();
  const kept: { sourceId: string; name: string; reason: string }[] = [];
  const items = decisions.items.flatMap((decision) => {
    const row = sources.get(decision.sourceId);
    if (!row || seen.has(decision.sourceId)) fail("decision-identity");
    seen.add(decision.sourceId);
    if (decision.name !== row.normalized.display.name || !text(decision.reason) || /^UNREAD\b/i.test(decision.reason) ||
        !Array.isArray(decision.categories) || !Array.isArray(decision.evidence)) fail("decision-shape");
    if (tagging && (!Array.isArray(decision.conditionChecks) ||
        decision.conditionChecks.some((check) => !text(check)))) fail("condition-checks");
    if (reassessing) {
      if (!["CONFIRMED", "CONFLICT", "UNRESOLVED"].includes(decision.sourceConsistency ?? "") ||
          (decision.decision === "ACTIVATE" && decision.sourceConsistency !== "CONFIRMED")) fail("source-consistency");
      if (!Array.isArray(decision.officialEvidence) || !decision.officialEvidence.length) fail("official-evidence-required");
      for (const evidence of decision.officialEvidence) {
        if (!evidence || typeof evidence !== "object" ||
            !validEvidenceUrl(evidence.originalUrl) || !validEvidenceUrl(evidence.finalUrl) ||
            !text(evidence.publisher) || !text(evidence.policyIdentity) || !text(evidence.rule) ||
            !text(evidence.retrievedAt) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(evidence.retrievedAt) ||
            !Number.isFinite(Date.parse(evidence.retrievedAt)) ||
            !["target_text", "benefit_text", "criteria_text"].includes(evidence.field) ||
            !text(evidence.content) || !text(evidence.excerpt) || !evidence.content.includes(evidence.excerpt) ||
            evidence.contentHash !== createHash("sha256").update(evidence.content, "utf8").digest("hex")) fail("official-evidence");
      }
    }
    const keeping = decision.decision === "KEEP_REVIEW";
    if (version === REVIEW_CORRECTION_VERSION && !keeping) fail("correction-must-remain-pending");
    if (keeping) {
      if (decision.categories.length || (!reassessing && !tagging && decision.evidence.length)) fail("keep-review-payload");
      kept.push({ sourceId: row.source_id, name: decision.name, reason: decision.reason });
      if (!recordKept && !reassessing && !tagging) return [];
    }
    const excluding = decision.decision === "EXCLUDE";
    if (!keeping && ((decision.decision !== "ACTIVATE" && !excluding) ||
        (excluding && ((version !== REVIEW_DISPOSITION_VERSION && !reassessing) || decision.categories.length !== 0)) ||
        (!excluding && !decision.categories.length) ||
        new Set(decision.categories).size !== decision.categories.length ||
        decision.categories.some((category) => !(tagging ? RECOMMENDATION_FIELDS.map((field) => field.label) : Object.values(POLICY_RELEVANCE_CATEGORIES)).some((label) => label === category)) ||
        (!reassessing && !decision.evidence.length))) fail("activation-decision");
    for (const evidence of decision.evidence) {
      if (!evidence || typeof evidence !== "object") fail("evidence");
      const original = row.normalized.display[evidence.field];
      const fields = version === REVIEW_DISPOSITION_VERSION || reassessing || tagging
        ? ["name", "target_text", "benefit_text", "criteria_text", "summary", "purpose_text"]
        : ["name", "target_text", "benefit_text"];
      if (!fields.includes(evidence.field) ||
          !text(evidence.excerpt) || !text(evidence.rule) || typeof original !== "string" ||
          !original.includes(evidence.excerpt)) fail("evidence");
    }
    if (!keeping && version === REVIEW_DISPOSITION_VERSION && !decision.evidence.some((e) =>
      ["target_text", "benefit_text", "criteria_text"].includes(e.field))) fail("direct-evidence-required");
    if (tagging && !keeping && !["target_text", "benefit_text"].every((field) =>
      decision.evidence.some((e) => e.field === field))) fail("tag-direct-evidence-required");
    return [{
      name: decision.name,
      sourceDigest: hashJson(row.normalized),
      previousRelevanceDigest: hashJson(row.relevance),
      payload: {
        sourceId: row.source_id,
        snapshotId: row.applied_snapshot_id,
        displayHash: row.normalized.displayHash,
        normalizerVersion: row.normalized.normalizerVersion,
        reviewOnly: true,
        ...(reassessing ? { reassessment: true } : {}),
        ...(version === REVIEW_CORRECTION_VERSION ? { correction: true } : {}),
        expectedNormalized: structuredClone(row.normalized),
        previousRelevance: structuredClone(row.relevance),
        relevance: {
          version,
          ...(tagging ? {
            previousRelevance: structuredClone(row.relevance),
            conditionChecks: [...decision.conditionChecks!],
          } : {}),
          ...(reassessing ? {
            previousRelevance: structuredClone(row.relevance),
            officialEvidence: structuredClone(decision.officialEvidence!),
            sourceConsistency: decision.sourceConsistency!,
          } : {}),
          status: keeping ? "REVIEW" : excluding ? "UNRELATED" : "RELATED",
          categories: [...decision.categories],
          evidence: structuredClone(decision.evidence),
          reason: `${decision.reason} ${reassessing ? "저장 원문 및 공식 자료" : "저장 원문"} 기반 서비스 관련성 재검토이며 신청 자격·조건 추천 공개 승인은 아닙니다.`,
        },
      },
    }];
  }).sort((a, b) => a.payload.sourceId.localeCompare(b.payload.sourceId));
  kept.sort((a, b) => a.sourceId.localeCompare(b.sourceId));
  const body = {
    schemaVersion: "catalog-review-activation-plan-1",
    inputQueriedAt: inventory.queriedAt,
    reviewedCount: seen.size,
    activateCount: items.filter((item) => item.payload.relevance.status === "RELATED").length,
    ...(version !== REVIEW_RELEVANCE_VERSION ? {
      excludeCount: items.filter((item) => item.payload.relevance.status === "UNRELATED").length,
      recordedReviewCount: items.filter((item) => item.payload.relevance.status === "REVIEW").length,
    } : {}),
    keepReviewCount: kept.length,
    notReviewedCount: inventory.rows.length - seen.size,
    items,
    kept,
  };
  return { ...body, digest: hashJson(body) };
}
