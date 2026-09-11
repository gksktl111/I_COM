import { hashJson } from "./normalize.ts";
import { POLICY_RELEVANCE_CATEGORIES } from "./relevance.ts";

export const REVIEW_RELEVANCE_VERSION = "policy-relevance-review-1";
export const REVIEW_DISPOSITION_VERSION = "policy-relevance-review-2";
export const REVIEW_CORRECTION_VERSION = "policy-relevance-review-3";
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
};
export type ReviewDecisions = {
  kind: "CATALOG_REVIEW_DECISIONS";
  inputQueriedAt: string;
  items: ScopeReviewDecision[];
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
function fail(reason: string): never { throw new Error(`invalid-review-plan:${reason}`); }

/** Offline plan only. Exact source evidence is necessary, but semantic review remains a separate task. */
export function prepareReviewActivation(
  inventory: { queriedAt: string; rows: ReviewSourceRow[] },
  decisions: ReviewDecisions,
  version: typeof REVIEW_RELEVANCE_VERSION | typeof REVIEW_DISPOSITION_VERSION | typeof REVIEW_CORRECTION_VERSION = REVIEW_RELEVANCE_VERSION,
  recordKept = false,
) {
  if (![REVIEW_RELEVANCE_VERSION, REVIEW_DISPOSITION_VERSION, REVIEW_CORRECTION_VERSION].includes(version)) fail("version");
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
    const keeping = decision.decision === "KEEP_REVIEW";
    if (version === REVIEW_CORRECTION_VERSION && !keeping) fail("correction-must-remain-pending");
    if (keeping) {
      if (decision.categories.length || decision.evidence.length) fail("keep-review-payload");
      kept.push({ sourceId: row.source_id, name: decision.name, reason: decision.reason });
      if (!recordKept) return [];
    }
    const excluding = decision.decision === "EXCLUDE";
    if (!keeping && ((decision.decision !== "ACTIVATE" && !excluding) ||
        (excluding && (version !== REVIEW_DISPOSITION_VERSION || decision.categories.length !== 0)) ||
        (!excluding && !decision.categories.length) ||
        new Set(decision.categories).size !== decision.categories.length ||
        decision.categories.some((category) => !Object.values(POLICY_RELEVANCE_CATEGORIES).some((label) => label === category)) ||
        !decision.evidence.length)) fail("activation-decision");
    for (const evidence of decision.evidence) {
      const original = row.normalized.display[evidence.field];
      const fields = version === REVIEW_DISPOSITION_VERSION
        ? ["name", "target_text", "benefit_text", "criteria_text", "summary", "purpose_text"]
        : ["name", "target_text", "benefit_text"];
      if (!fields.includes(evidence.field) ||
          !text(evidence.excerpt) || !text(evidence.rule) || typeof original !== "string" ||
          !original.includes(evidence.excerpt)) fail("evidence");
    }
    if (!keeping && version === REVIEW_DISPOSITION_VERSION && !decision.evidence.some((e) =>
      ["target_text", "benefit_text", "criteria_text"].includes(e.field))) fail("direct-evidence-required");
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
        ...(version === REVIEW_CORRECTION_VERSION ? { correction: true } : {}),
        expectedNormalized: structuredClone(row.normalized),
        previousRelevance: structuredClone(row.relevance),
        relevance: {
          version,
          status: keeping ? "REVIEW" : excluding ? "UNRELATED" : "RELATED",
          categories: [...decision.categories],
          evidence: structuredClone(decision.evidence),
          reason: `${decision.reason} 저장 원문 기반 서비스 관련성 재검토이며 신청 자격·조건 추천 공개 승인은 아닙니다.`,
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
