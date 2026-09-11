import familyA from "../../../../../docs/fixtures/policy-recommendation/family-fields-a-20260911.json" with { type: "json" };
import familyB from "../../../../../docs/fixtures/policy-recommendation/family-fields-b-20260911.json" with { type: "json" };
import educationSources from "../../../../../docs/fixtures/policy-recommendation/education-template-sources-20260911.json" with { type: "json" };
import {
  educationPreparedCatalog,
  educationPreparedSourceVersions,
  educationPreparationQueue,
} from "./education-prepared.ts";
import {
  compilePolicyTemplates,
  type TemplateRecipe,
  type TemplateSource,
} from "../../recommendation/template-compiler.ts";
import { RECOMMENDATION_FIELDS } from "../../recommendation/intake.ts";
import { validateCatalog } from "../../recommendation/engine.ts";
import type { Catalog } from "../../recommendation/types.ts";
import type { RecommendationSource } from "../recommendation-sources.ts";
import { hashJson } from "../normalize.ts";

type FieldEntry = {
  sampleId: string;
  category: string;
  source: RecommendationSource;
  evidenceDocuments?: TemplateSource["evidenceDocuments"];
  recipe: TemplateRecipe;
};
const fieldEntries = [
  ...familyA.items,
  ...familyB.items,
] as unknown as FieldEntry[];

/** Offline drafts across all six fields. Assembly never grants publication or rule approval. */
export function prepareSixFieldCatalog(entries: FieldEntry[] = fieldEntries) {
  const uuid =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const digest = /^[a-f0-9]{64}$/;
  const identities = new Set(
    educationSources.items.map((row) => row.policy.id),
  );
  for (const entry of entries) {
    if (
      !entry?.source?.source ||
      !entry.source.policy ||
      !entry.recipe ||
      !uuid.test(entry.source.policy.id) ||
      !uuid.test(entry.source.source.snapshotId) ||
      !digest.test(entry.source.source.displayHash) ||
      !digest.test(entry.source.source.normalizedFingerprint) ||
      typeof entry.source.source.normalizerVersion !== "string" ||
      !entry.source.source.normalizerVersion.trim() ||
      !RECOMMENDATION_FIELDS.some((field) => field.id === entry.category) ||
      entry.category === "education" ||
      entry.category !== entry.recipe.category ||
      entry.sampleId !== entry.recipe.sampleId ||
      entry.source.policy.id !== entry.recipe.policyId ||
      identities.has(entry.source.policy.id)
    )
      throw new Error("invalid-six-field-source-identity");
    identities.add(entry.source.policy.id);
  }
  const compiled = compilePolicyTemplates(
    entries.map(
      ({ source: { policy, source }, evidenceDocuments }): TemplateSource => ({
        id: policy.id,
        title: policy.name,
        version: source.normalizedFingerprint,
        evidenceDocuments,
        fields: Object.fromEntries(
          Object.entries(policy).filter(
            ([, value]) => typeof value === "string" || value === null,
          ),
        ),
      }),
    ),
    entries.map((entry) => entry.recipe),
  );
  const questions = new Map(
    educationPreparedCatalog.questions.map((q) => [q.id, q]),
  );
  for (const question of compiled.catalog.questions) {
    const previous = questions.get(question.id);
    if (previous && hashJson(previous) !== hashJson(question))
      throw new Error("conflicting-six-field-question");
    questions.set(question.id, question);
  }
  const catalog: Catalog = {
    version: hashJson({
      education: educationPreparedCatalog.version,
      family: compiled.catalog.version,
    }),
    policies: [
      ...structuredClone(educationPreparedCatalog.policies),
      ...compiled.catalog.policies,
    ],
    questions: structuredClone([...questions.values()]),
  };
  validateCatalog(catalog);
  const sourceVersions = structuredClone(educationPreparedSourceVersions);
  for (const policy of compiled.catalog.policies)
    sourceVersions[policy.id] = structuredClone(
      entries.find((e) => e.source.policy.id === policy.id)!.source.source,
    );
  const sources = [
    ...educationSources.items.map((row) => ({ ...row, category: "education" })),
    ...entries.map((entry) => ({
      sampleId: entry.sampleId,
      category: entry.category,
      ...entry.source,
    })),
  ];
  const queue = [
    ...educationPreparationQueue.map((row) => ({
      ...row,
      category: "education",
    })),
    ...compiled.queue.map((row) => ({
      ...row,
      category: entries.find((e) => e.source.policy.id === row.policyId)!
        .category,
      disposition: row.status === "PREPARED_DRAFT" ? "CANDIDATE" : "HOLD",
      disposition_reason:
        "수집 원문에서 작성한 분야별 조건 초안. 공식 현행 기준·예외 검수가 남아 있습니다.",
    })),
  ];
  const fields = RECOMMENDATION_FIELDS.map((field) => {
    const policies = catalog.policies.filter((p) => p.category === field.id);
    return {
      category: field.id,
      label: field.label,
      sourceCount: sources.filter((s) => s.category === field.id).length,
      draftCount: policies.length,
      ruleCount: policies.reduce((n, p) => n + p.rules.length, 0),
      completePathCount: policies.reduce(
        (n, p) => n + p.paths.filter((path) => path.complete).length,
        0,
      ),
      heldCount: queue.filter(
        (q) => q.category === field.id && q.status === "HELD",
      ).length,
      invalidCount: queue.filter(
        (q) => q.category === field.id && q.status === "INVALID",
      ).length,
      publicCount: policies.filter((p) => p.release === "HUMAN").length,
    };
  });
  return { catalog, sourceVersions, sources, queue, fields };
}
const prepared = prepareSixFieldCatalog();
export const sixFieldPreparedCatalog = prepared.catalog;
export const sixFieldSourceVersions = prepared.sourceVersions;
export const sixFieldSources = prepared.sources;
export const sixFieldPreparationQueue = prepared.queue;
export const sixFieldPreparationStatus = prepared.fields;
