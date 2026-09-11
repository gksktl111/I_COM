import "server-only";
import { createHash } from "node:crypto";
import { readPublicPolicies } from "../public-data.ts";
import type { PublicPolicy } from "../public/types.ts";
import { validateCatalog } from "../recommendation/engine.ts";
import type { Catalog } from "../recommendation/types.ts";

export type RecommendationCatalog = {
  catalog: Catalog;
  policies: PublicPolicy[];
  coverage: "READY" | "AWAITING_REVIEW";
  /** Categories already switched to rules, including temporarily stale releases. */
  reviewedCategories?: string[];
  withheldByCategory?: Record<string, number>;
};

/** Trusted server configuration, never populated from requests or AI labels.
 * Adding a release requires recorded HUMAN publication, rule and question review.
 * The fingerprint detects public display changes; it does not itself grant approval.
 */
export type ApprovedRecommendationRelease = {
  catalog: Catalog;
  displayFingerprints: Readonly<Record<string, string>>;
};

// No actual policy has a recorded recommendation release in this repository.
// Do not promote ACTIVE candidates or the synthetic education fixture here.
const approvedRelease: ApprovedRecommendationRelease = Object.freeze({
  catalog: Object.freeze({
    version: "awaiting-human-review-1",
    policies: Object.freeze([]) as unknown as Catalog["policies"],
    questions: Object.freeze([]) as unknown as Catalog["questions"],
  }),
  displayFingerprints: Object.freeze({}),
});

export function policyDisplayFingerprint(policy: PublicPolicy): string {
  // Fixed projection/order excludes operational updated_at and unknown properties.
  return createHash("sha256")
    .update(
      JSON.stringify([
        policy.id,
        policy.name,
        policy.summary,
        policy.provider_name,
        policy.purpose_text,
        policy.target_text,
        policy.criteria_text,
        policy.benefit_text,
        policy.application_method_text,
        policy.application_period_text,
        policy.required_documents_text,
        policy.reception_text,
        policy.contact_text,
        policy.source_url,
        policy.application_url,
      ]),
    )
    .digest("hex");
}

export function createRecommendationCatalogLoader(
  release: ApprovedRecommendationRelease = approvedRelease,
  read: typeof readPublicPolicies = readPublicPolicies,
): () => Promise<RecommendationCatalog> {
  // Freeze caller changes out of an already constructed release loader.
  const trusted = structuredClone(release);
  return async () => {
    const catalog = structuredClone(trusted.catalog);
    validateCatalog(catalog);
    if (!catalog.policies.length) {
      return {
        catalog: { ...catalog, questions: [] },
        policies: [],
        coverage: "AWAITING_REVIEW",
      };
    }
    if (
      catalog.policies.some(
        (policy) =>
          policy.release !== "HUMAN" ||
          !policy.sourceVersion ||
          policy.releaseSourceVersion !== policy.sourceVersion ||
          !/^[a-f0-9]{64}$/.test(
            trusted.displayFingerprints[policy.id] ?? "",
          ) ||
          policy.rules.some((rule) => rule.review === "FIXTURE"),
      )
    )
      throw new Error("invalid-approved-release");

    // Never use a partial page as the complete candidate set.
    const current = new Map<string, PublicPolicy>();
    let offset = 0;
    while (true) {
      const page = await read({ offset });
      for (const policy of page.items) {
        if (current.has(policy.id))
          throw new Error("inconsistent-policy-pages");
        current.set(policy.id, policy);
      }
      if (page.nextOffset === null) break;
      if (
        !Number.isSafeInteger(page.nextOffset) ||
        page.nextOffset <= offset ||
        page.nextOffset > 100000
      )
        throw new Error("incomplete-policy-pages");
      offset = page.nextOffset;
    }
    const policies = catalog.policies.flatMap((policy) => {
      const display = current.get(policy.id);
      return display &&
        policyDisplayFingerprint(display) ===
          trusted.displayFingerprints[policy.id]
        ? [display]
        : [];
    });
    const ids = new Set(policies.map((policy) => policy.id));
    catalog.policies = catalog.policies.filter((policy) => ids.has(policy.id));
    // Retain only questions backed by a current public rule, and prerequisites.
    const relevant = new Set(
      catalog.questions
        .filter((question) =>
          catalog.policies.some((policy) =>
            policy.rules.some(
              (rule) =>
                rule.review === "HUMAN" &&
                rule.sourceVersion === policy.sourceVersion &&
                rule.fact.attribute === question.fact.attribute &&
                rule.fact.subject === question.fact.subject &&
                rule.fact.basis === question.fact.basis &&
                rule.fact.reference === question.fact.reference,
            ),
          ),
        )
        .map((question) => question.id),
    );
    let changed = true;
    while (changed) {
      changed = false;
      for (const question of catalog.questions) {
        if (!relevant.has(question.id)) continue;
        for (const prerequisite of question.prerequisites) {
          if (!relevant.has(prerequisite.questionId)) {
            relevant.add(prerequisite.questionId);
            changed = true;
          }
        }
      }
    }
    catalog.questions = catalog.questions.filter((question) =>
      relevant.has(question.id),
    );
    return {
      catalog,
      policies,
      coverage: policies.length ? "READY" : "AWAITING_REVIEW",
    };
  };
}

export const readRecommendationCatalog = createRecommendationCatalogLoader();
