import {
  sixFieldPreparedCatalog,
  sixFieldSourceVersions,
} from "./catalogs/six-field-prepared.ts";
import "server-only";
import { hashJson } from "./normalize.ts";
import { validateCatalog } from "../recommendation/engine.ts";
import type { Catalog } from "../recommendation/types.ts";
import type { RecommendationCatalog } from "./recommendation-release.ts";
import {
  readRecommendationSourcePage,
  type RecommendationSource,
} from "./recommendation-sources.ts";
import {
  educationPreparedCatalog as educationDraftCatalog,
  educationPreparedSourceVersions as educationSourceVersions,
} from "./catalogs/education-prepared.ts";

export type ReviewDecision = {
  policyId: string;
  draftDigest: string;
  reviewer: string;
  evidenceRef: string;
  reviewedAt: string;
  validUntil: string;
  publication: "APPROVED";
  rules: "APPROVED";
  questions: "APPROVED";
};
export type RecommendationDraft = {
  catalog: Catalog;
  sourceVersions: Record<string, RecommendationSource["source"]>;
  decisions: ReviewDecision[];
};
/** Only this policy's fact questions and their complete prerequisite closure are reviewed. */
export function recommendationDraftDigest(
  draft: RecommendationDraft,
  policyId: string,
): string {
  const policy = draft.catalog.policies.find((p) => p.id === policyId);
  if (!policy || !draft.sourceVersions[policyId])
    throw new Error("missing-review-draft");
  const byId = new Map(draft.catalog.questions.map((q) => [q.id, q]));
  if (byId.size !== draft.catalog.questions.length)
    throw new Error("invalid-review-questions");
  const selected = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error("invalid-review-question-cycle");
    if (selected.has(id)) return;
    const question = byId.get(id);
    if (!question) throw new Error("missing-review-prerequisite");
    visiting.add(id);
    for (const prerequisite of question.prerequisites)
      visit(prerequisite.questionId);
    visiting.delete(id);
    selected.add(id);
  };
  for (const q of draft.catalog.questions)
    if (
      policy.rules.some(
        (r) =>
          r.fact.attribute === q.fact.attribute &&
          r.fact.subject === q.fact.subject &&
          r.fact.basis === q.fact.basis &&
          r.fact.reference === q.fact.reference,
      )
    )
      visit(q.id);
  return hashJson({
    schema: "recommendation-review-digest-2",
    policy,
    questions: [...selected].sort().map((id) => byId.get(id)),
    source: draft.sourceVersions[policyId],
  });
}

// An implementation request is not evidence that the policy contents were reviewed.
// Record an actual reviewer and their publication/rule/question decision here.
export const educationReviewDecisions: ReviewDecision[] = [];
export const educationRecommendationDraft: RecommendationDraft = {
  catalog: educationDraftCatalog,
  sourceVersions: educationSourceVersions,
  decisions: educationReviewDecisions,
};

export const familyReviewDecisions: ReviewDecision[] = [];
export const allFieldsRecommendationDraft: RecommendationDraft = {
  catalog: sixFieldPreparedCatalog,
  sourceVersions: sixFieldSourceVersions,
  decisions: [...educationReviewDecisions, ...familyReviewDecisions],
};

export function createReviewedCatalogLoader(
  draft: RecommendationDraft = allFieldsRecommendationDraft,
  read: typeof readRecommendationSourcePage = readRecommendationSourcePage,
  now: () => Date = () => new Date(),
): () => Promise<RecommendationCatalog> {
  const trusted = structuredClone(draft);
  validateCatalog(trusted.catalog);
  const byId = new Map(trusted.catalog.policies.map((p) => [p.id, p]));
  const reviewedCategories = new Set<string>();
  const seen = new Set<string>();
  for (const d of trusted.decisions) {
    const p = byId.get(d.policyId);
    if (
      !p ||
      seen.has(d.policyId) ||
      d.draftDigest !== recommendationDraftDigest(trusted, d.policyId) ||
      !d.reviewer.trim() ||
      !d.evidenceRef.trim() ||
      d.publication !== "APPROVED" ||
      d.rules !== "APPROVED" ||
      d.questions !== "APPROVED" ||
      !Number.isFinite(Date.parse(d.reviewedAt)) ||
      !Number.isFinite(Date.parse(d.validUntil)) ||
      Date.parse(d.validUntil) <= Date.parse(d.reviewedAt) ||
      p.release === "FIXTURE" ||
      p.rules.some(
        (r) => r.review === "FIXTURE" || r.sourceVersion !== p.sourceVersion,
      ) ||
      p.sourceVersion !== trusted.sourceVersions[p.id]?.normalizedFingerprint
    )
      throw new Error("invalid-recommendation-review");
    seen.add(d.policyId);
    reviewedCategories.add(p.category);
  }
  return async () => {
    const policies: Catalog["policies"] = [];
    const displays: RecommendationSource["policy"][] = [];
    const time = now().getTime();
    if (!Number.isFinite(time)) throw new Error("invalid-review-time");
    const activeDecisions = trusted.decisions.filter(
      (d) =>
        time >= Date.parse(d.reviewedAt) && time < Date.parse(d.validUntil),
    );
    const currentSources = new Map<string, RecommendationSource>();
    if (activeDecisions.length) {
      let offset = 0;
      const seen = new Set<string>();
      while (true) {
        const page = await read({ offset });
        if (!Array.isArray(page.items) || page.items.length > 1000)
          throw new Error("inconsistent-reviewed-source");
        for (const current of page.items) {
          const id = current.policy.id.toLowerCase();
          if (seen.has(id)) throw new Error("duplicate-reviewed-source");
          seen.add(id);
          currentSources.set(current.policy.id, current);
        }
        if (page.nextOffset === null) break;
        if (
          !Number.isSafeInteger(page.nextOffset) ||
          !page.items.length ||
          page.nextOffset !== offset + page.items.length ||
          page.nextOffset > 100000
        )
          throw new Error("incomplete-reviewed-source-pages");
        offset = page.nextOffset;
      }
    }
    for (const d of activeDecisions) {
      // Expiry/source drift never retains reviewed status; guided results may show a separately marked provisional item.
      const current = currentSources.get(d.policyId);
      if (
        !current ||
        current.policy.id !== d.policyId ||
        hashJson(current.source) !==
          hashJson(trusted.sourceVersions[d.policyId])
      )
        continue;
      const p = structuredClone(byId.get(d.policyId)!);
      p.release = "HUMAN";
      p.releaseSourceVersion = p.sourceVersion;
      for (const rule of p.rules) rule.review = "HUMAN";
      // Review never invents missing paths, dates, or rules.
      policies.push(p);
      displays.push(current.policy);
    }
    const catalog = {
      version: hashJson({
        draft: trusted.catalog.version,
        decisions: trusted.decisions,
        active: policies.map((p) => p.id),
      }),
      policies,
      questions: policies.length
        ? structuredClone(trusted.catalog.questions)
        : [],
    };
    validateCatalog(catalog);
    const withheldByCategory: Record<string, number> = {};
    const activeIds = new Set(policies.map((p) => p.id));
    for (const decision of trusted.decisions) {
      if (activeIds.has(decision.policyId)) continue;
      const category = byId.get(decision.policyId)!.category;
      withheldByCategory[category] = (withheldByCategory[category] ?? 0) + 1;
    }
    return {
      catalog,
      policies: displays,
      reviewedCategories: [...reviewedCategories],
      withheldByCategory,
      coverage: policies.length ? "READY" : "AWAITING_REVIEW",
    };
  };
}
export const readReviewedRecommendationCatalog = createReviewedCatalogLoader();
