import test from "node:test";
import assert from "node:assert/strict";
import recipes from "../../../../docs/fixtures/policy-recommendation/education-template-inputs-20260911.json" with { type: "json" };
import sources from "../../../../docs/fixtures/policy-recommendation/education-template-sources-20260911.json" with { type: "json" };
import supplemental from "../../../../docs/fixtures/policy-recommendation/education-supplemental-evidence-20260911.json" with { type: "json" };
import {
  compilePolicyTemplates,
  type TemplateSource,
} from "../recommendation/template-compiler.ts";
import { evaluatePredicate } from "../recommendation/eligibility.ts";
import { evaluateRecommendation } from "../recommendation/engine.ts";
import { educationRequest } from "../recommendation/education.fixture.ts";
import { bindFact } from "../recommendation/facts.ts";
import type { Context, Predicate } from "../recommendation/types.ts";

const recipe = recipes.items.find((i) => i.sampleId === "E16")!;
const original = sources.items.find((i) => i.sampleId === "E16")!;
const source: TemplateSource = {
  id: original.policy.id,
  title: original.policy.name,
  version: original.source.normalizedFingerprint,
  fields: Object.fromEntries(
    Object.entries(original.policy).filter(
      ([, v]) => v === null || typeof v === "string",
    ),
  ),
  evidenceDocuments: supplemental.items.find(
    (i) => i.policyId === original.policy.id,
  )!.documents as unknown as TemplateSource["evidenceDocuments"],
};
function evaluateCode(rule: Predicate, value: string) {
  const context: Context = {
    mode: "FIXTURE",
    sourceVersion: rule.sourceVersion,
    beneficiary: { kind: "CHILD", id: "student" },
    household: { kind: "HOUSEHOLD", id: "household" },
    answers: [],
  };
  context.answers.push({
    key: bindFact(rule.fact, context),
    recordedAt: "2026-09-11T00:00:00Z",
    state: "PROVIDED",
    source: "USER_DECLARED",
    value: { kind: "CODE", value },
  });
  return evaluatePredicate({ ...rule, review: "FIXTURE" }, context).value;
}

test("Anyang general classes exclude subsidized 1:1 without requiring social consideration; school-outside students remain possible", () => {
  const { catalog, queue } = compilePolicyTemplates([source], [recipe]);
  assert.equal(queue[0].status, "PREPARED_DRAFT");
  const policy = catalog.policies[0];
  const general = policy.rules.filter((r) => r.id.startsWith("E16-general:"));
  const social = policy.rules.filter((r) =>
    r.id.startsWith("E16-social-consideration:"),
  );
  const classRule = (rules: Predicate[]) =>
    rules.find((r) => r.fact.attribute.endsWith("classFormat"))!;
  for (const value of ["ONE_TO_TWO", "ONE_TO_THREE"])
    assert.equal(evaluateCode(classRule(general), value), "TRUE");
  assert.equal(evaluateCode(classRule(general), "ONE_TO_ONE"), "FALSE");
  assert.equal(evaluateCode(classRule(social), "ONE_TO_ONE"), "TRUE");
  assert(
    !general.some((r) => r.fact.attribute.includes("recognizedConsideration")),
  );
  const recognition = social.find((r) =>
    r.fact.attribute.endsWith("recognizedConsideration"),
  )!;
  for (const value of [
    "BASIC_LIVELIHOOD",
    "NEAR_POVERTY_MEDICAL",
    "LEGAL_SINGLE_PARENT",
    "MULTICULTURAL",
  ])
    assert.equal(evaluateCode(recognition, value), "TRUE");
  assert.equal(evaluateCode(recognition, "NONE"), "FALSE");
  const learner = general.find((r) => r.fact.attribute.endsWith("learner"))!;
  assert.equal(evaluateCode(learner, "OUT_OF_SCHOOL"), "TRUE");
  assert.equal(evaluateCode(learner, "PRESCHOOL"), "FALSE");
  assert.equal(evaluateCode(learner, "ADULT"), "FALSE");
  assert(!general.some((r) => r.fact.attribute === "education.schoolStage"));
  const residence = general.find((r) =>
    r.fact.attribute.endsWith("registeredResidence"),
  )!;
  assert.equal(residence.fact.subject, "BENEFICIARY");
  assert.equal(evaluateCode(residence, "OTHER"), "FALSE");
});

test("Anyang official evidence binds the draft while unresolved age and recognition produce no questions or public approval", () => {
  const { catalog } = compilePolicyTemplates([source], [recipe]);
  const policy = catalog.policies[0];
  assert(
    policy.rules.every((r) =>
      r.evidenceRefs.every(
        (ref) =>
          ref.includes("official.anyang-2026-term-four") &&
          ref.includes("sha256="),
      ),
    ),
  );
  assert.equal(policy.sourceVersion, original.source.normalizedFingerprint);
  assert.equal(policy.release, "HIDDEN");
  assert(policy.rules.every((r) => r.review === "UNREVIEWED"));
  assert(
    policy.paths.every((p) => !p.complete && p.availability === "UNKNOWN"),
  );
  assert(
    !catalog.questions.some(
      (q) =>
        q.fact.attribute.endsWith("ageYears") ||
        q.fact.attribute.endsWith("recognizedConsideration"),
    ),
  );
  assert.deepEqual(
    evaluateRecommendation(catalog, {
      ...educationRequest,
      mode: "PUBLIC",
      phase: "RESULTS",
    }).cards,
    [],
  );
  const missing = { ...source, evidenceDocuments: undefined };
  assert.equal(
    compilePolicyTemplates([missing], [recipe]).queue[0].status,
    "INVALID",
  );
  const changed = structuredClone(source);
  changed.evidenceDocuments!["anyang-2026-term-four"].text += "\n검토용 변경";
  assert.notEqual(
    compilePolicyTemplates([changed], [recipe]).catalog.version,
    catalog.version,
  );
});
