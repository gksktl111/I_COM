import assert from "node:assert/strict";
import test from "node:test";
import familyA from "../../../../docs/fixtures/policy-recommendation/family-fields-a-20260911.json" with { type: "json" };
import familyB from "../../../../docs/fixtures/policy-recommendation/family-fields-b-20260911.json" with { type: "json" };
import {
  prepareSixFieldCatalog,
  sixFieldPreparedCatalog,
  sixFieldPreparationStatus,
  sixFieldSources,
} from "./catalogs/six-field-prepared.ts";
import { RECOMMENDATION_FIELDS } from "../recommendation/intake.ts";
import { projectBankFacts } from "../recommendation/bank-facts.ts";
import { evaluateRecommendation } from "../recommendation/engine.ts";
import type {
  BankAnswer,
  BankContext,
} from "../recommendation/category-bank.ts";

const answer = (
  questionId: string,
  subjectId: string,
  value: string,
): BankAnswer => ({ questionId, subjectId, state: "PROVIDED", value });
test("all six required fields have real source-bound drafts, without treating sample coverage as publication", () => {
  assert.deepEqual(
    sixFieldPreparationStatus.map((f) => f.category),
    RECOMMENDATION_FIELDS.map((f) => f.id),
  );
  assert.equal(
    new Set(sixFieldSources.map((s) => s.policy.id)).size,
    sixFieldSources.length,
  );
  for (const f of sixFieldPreparationStatus) {
    assert.ok(f.draftCount >= 2, f.category);
    assert.equal(f.invalidCount, 0, f.category);
    assert.equal(f.publicCount, 0, f.category);
  }
  assert.ok(
    sixFieldPreparedCatalog.policies.every(
      (p) =>
        p.release === "HIDDEN" &&
        p.rules.every((r) => r.review === "UNREVIEWED"),
    ),
  );
});

test("actual bank profiles reach only their field and beneficiary in the six-field draft engine", () => {
  const catalog = structuredClone(sixFieldPreparedCatalog);
  catalog.policies.forEach((p) => {
    p.release = "FIXTURE";
    p.rules.forEach((r) => {
      r.review = "FIXTURE";
    });
  });
  for (const field of RECOMMENDATION_FIELDS) {
    const context: BankContext = {
      category: field.id,
      needs: [],
      childProfiles: [{ id: "child-1", birthYear: 2017, sex: null }],
    };
    const bank: BankAnswer[] =
      field.id === "pregnancy"
        ? [
            answer("P01", "HOUSEHOLD", "SELF"),
            answer("P02", "SELF", "PREGNANT"),
          ]
        : field.id === "health"
          ? [answer("H01", "HOUSEHOLD", "CHILD")]
          : [];
    const projected = projectBankFacts(context, bank, "2026-09-11T00:00:00Z");
    const request = {
      mode: "FIXTURE" as const,
      revision: 0,
      category: field.id,
      householdId: "HOUSEHOLD",
      selectedChildren: projected.selectedChildren,
      selectedSubjects: projected.selectedSubjects,
      subjectsComplete: true,
      needs: [],
      answers: projected.answers,
      phase: "RESULTS" as const,
      questionCount: 0,
      evaluatedAt: "2026-09-11T00:00:00Z",
      view: "CURRENT" as const,
    };
    const result = evaluateRecommendation(catalog, request);
    assert.ok(result.cards.length > 0, field.id);
    assert.ok(result.cards.length <= 20);
    for (const card of result.cards) {
      assert.equal(
        catalog.policies.find((p) => p.id === card.policyId)!.category,
        field.id,
      );
      for (const path of card.pathResults) {
        if (field.id === "housing")
          assert.deepEqual(path.subject, {
            kind: "HOUSEHOLD",
            id: "HOUSEHOLD",
          });
        else if (field.id === "pregnancy")
          assert.deepEqual(path.subject, { kind: "PERSON", id: "SELF" });
        else assert.deepEqual(path.subject, { kind: "CHILD", id: "child-1" });
      }
    }
    assert.deepEqual(
      evaluateRecommendation(sixFieldPreparedCatalog, {
        ...request,
        mode: "PUBLIC",
      }).cards,
      [],
    );
  }
});

test("source/category identity mismatch fails and a bad quote quarantines only its draft", () => {
  const entries = structuredClone([
    ...familyA.items,
    ...familyB.items,
  ]) as unknown as NonNullable<Parameters<typeof prepareSixFieldCatalog>[0]>;
  const wrong = structuredClone(entries);
  wrong[0].category = "housing";
  assert.throws(
    () => prepareSixFieldCatalog(wrong),
    /invalid-six-field-source-identity/,
  );
  entries[0].recipe.paths[0].conditions[0].evidence[0].quote =
    "NOT IN ACTUAL SOURCE";
  const result = prepareSixFieldCatalog(entries);
  assert.equal(
    result.catalog.policies.length,
    sixFieldPreparedCatalog.policies.length - 1,
  );
  assert.equal(result.queue.filter((q) => q.status === "INVALID").length, 1);
  assert.equal(
    result.catalog.policies.some((p) => p.id === entries[0].source.policy.id),
    false,
  );
});

test("official excerpts bind draft evidence hashes without changing source versions or completing paths", () => {
  const entries = structuredClone([
    ...familyA.items,
    ...familyB.items,
  ]) as unknown as NonNullable<Parameters<typeof prepareSixFieldCatalog>[0]>;
  const entry = entries.find((row) => row.sampleId === "B01")!;
  const original = prepareSixFieldCatalog(entries);
  const policy = original.catalog.policies.find((p) => p.id === entry.recipe.policyId)!;
  const locationRule = policy.rules.find((r) =>
    r.evidenceRefs.some((ref) => ref.includes("official.michuhol2026")),
  )!;
  assert.ok(locationRule.evidenceRefs[0].includes("#sha256="));
  assert.equal(locationRule.fact.subject, "BENEFICIARY");
  assert.ok(locationRule.fact.attribute.endsWith("attendedDaycareLocatedMichuhol"));
  assert.equal(locationRule.fact.reference, "POLICY_REFERENCE_UNCONFIRMED");
  assert.ok(policy.paths.every((path) => !path.complete));
  assert.ok(!original.catalog.questions.some((q) =>
    q.fact.attribute === locationRule.fact.attribute,
  ));
  for (const change of ["url", "text"] as const) {
    const changed = structuredClone(entries);
    const document = changed.find((row) => row.sampleId === "B01")!
      .evidenceDocuments!.michuhol2026;
    document[change] += change === "url" ? "#revised-evidence" : "\n";
    const result = prepareSixFieldCatalog(changed);
    assert.notEqual(result.catalog.version, original.catalog.version, change);
    assert.deepEqual(result.sourceVersions, original.sourceVersions);
    assert.equal(result.queue.filter((row) => row.status === "INVALID").length, 0);
  }
  entry.evidenceDocuments!.michuhol2026.text = "원문 인용이 없는 자료";
  const invalid = prepareSixFieldCatalog(entries);
  assert.ok(invalid.queue.some((row) =>
    row.policyId === entry.recipe.policyId &&
    row.codes.includes("EVIDENCE_NOT_IN_DOCUMENT"),
  ));
});
