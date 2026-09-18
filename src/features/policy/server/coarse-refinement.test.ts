import assert from "node:assert/strict";
import test from "node:test";
import drafts from "../../../../docs/fixtures/policy-recommendation/coarse-refinement-20260911.json" with { type: "json" };
import familyDrafts from "../../../../docs/fixtures/policy-recommendation/coarse-refinement-family-20260911.json" with { type: "json" };
import healthHousingDrafts from "../../../../docs/fixtures/policy-recommendation/coarse-refinement-health-housing-20260911.json" with { type: "json" };
import { sixFieldPreparedCatalog, sixFieldPreparationQueue } from "./catalogs/six-field-prepared.ts";
import { evaluateExpression, evaluatePredicate } from "../recommendation/eligibility.ts";
import { bindFact, factKey } from "../recommendation/facts.ts";
import type { Answer, Context, FactValue } from "../recommendation/types.ts";

function fixture(sampleId: string, overrides: Record<string, FactValue> = {}) {
  const entry = [...drafts.items, ...familyDrafts.items, ...healthHousingDrafts.items].find((row) => row.sampleId === sampleId)!;
  const policy = structuredClone(sixFieldPreparedCatalog.policies.find((p) => p.id === entry.recipe.policyId)!);
  assert.ok(policy, sampleId);
  const context: Context = {
    beneficiary: { kind: policy.paths[0].subject, id: "beneficiary" },
    household: { kind: "HOUSEHOLD", id: "household" },
    answers: [], sourceVersion: policy.sourceVersion, mode: "FIXTURE",
  };
  const answers = new Map<string, Answer>();
  for (const rule of policy.rules) {
    rule.review = "FIXTURE";
    const attribute = rule.fact.attribute.split(".").at(-1)!;
    const key = bindFact(rule.fact, context);
    const value = overrides[attribute] ?? (rule.operator === "NUMBER_RANGE"
      ? { kind: "NUMBER_RANGE" as const, min: rule.min, max: rule.max, minInclusive: rule.minInclusive, maxInclusive: rule.maxInclusive, unit: rule.unit }
      : { kind: "CODE" as const, value: rule.operator === "IN_SET" ? rule.expected[0] : "YES" });
    answers.set(factKey(key), { key, value, state: "PROVIDED", source: "USER_DECLARED", recordedAt: "2026-09-11T14:00:00Z" });
  }
  context.answers = [...answers.values()];
  return { policy, context };
}
const no = { kind: "CODE", value: "NO" } as const;
const exactAge = (age: number): FactValue => ({ kind: "NUMBER_RANGE", min: age, max: age, minInclusive: true, maxInclusive: true, unit: "AGE_YEARS" });

test("non-disabled single-parent household retains its separate insurance support path", () => {
  for (const id of ["R07", "R08"]) {
    const { policy, context } = fixture(id, { elderlyHousehold: no, registeredDisabilityHousehold: no });
    assert.deepEqual(policy.paths.map((path) => evaluateExpression(path.expression, policy.rules, context).value), ["FALSE", "FALSE", "UNKNOWN"]);
  }
});

test("non-disabled household head does not invalidate the severely disabled child alternative", () => {
  const { policy, context } = fixture("R11", { severelyDisabledHead: no });
  assert.deepEqual(policy.paths.map((path) => evaluateExpression(path.expression, policy.rules, context).value), ["FALSE", "UNKNOWN"]);
  assert.ok(!policy.rules.some((rule) => rule.operator === "NUMBER_RANGE" && rule.unit === "AGE_YEARS"));
});

test("age over youth limit retains newlywed route and planned move is not replaced by current region", () => {
  const { policy, context } = fixture("R12", { youngApplicantAge: exactAge(40) });
  assert.deepEqual(policy.paths.map((path) => evaluateExpression(path.expression, policy.rules, context).value), ["FALSE", "UNKNOWN"]);
  assert.ok(policy.rules.some((rule) => rule.fact.basis === "RESIDENCE_OR_PLANNED_MOVE"));
});

test("family youngest-child age preserves inclusive and strict 18-year boundaries without using a selected child's age", () => {
  for (const [id, attribute, expected] of [["R03", "youngestChildAgeYears", "TRUE"], ["R06", "youngestChildAgeYears", "FALSE"]] as const) {
    const { policy, context } = fixture(id, { [attribute]: exactAge(18) });
    const rule = policy.rules.find((rule) => rule.fact.attribute.endsWith(`.${attribute}`))!;
    assert.equal(evaluatePredicate(rule, context).value, expected);
    const original = context.answers.find((answer) => answer.key.attribute === rule.fact.attribute)!;
    original.key.subject = { kind: "CHILD", id: "beneficiary" };
    assert.equal(evaluatePredicate(rule, context).value, "UNKNOWN");
  }
  const { policy, context } = fixture("R06", { youngestChildAgeYears: exactAge(10) });
  const rule = policy.rules[0];
  context.answers.push({
    ...context.answers[0],
    key: { ...context.answers[0].key, subject: { kind: "CHILD", id: "selected-adult-child" } },
    state: "PROVIDED", source: "USER_DECLARED", value: exactAge(18),
  });
  assert.equal(evaluatePredicate(rule, context).value, "TRUE");
});

test("current residence cannot answer historical school-entry residence", () => {
  const { policy, context } = fixture("R09");
  const rule = policy.rules.find((rule) => rule.fact.attribute.endsWith("siheungResidenceAtEntry"))!;
  const answer = context.answers.find((answer) => answer.key.attribute === rule.fact.attribute)!;
  assert.equal(evaluatePredicate(rule, context).value, "TRUE");
  answer.key.basis = "CURRENT_RESIDENCE";
  assert.equal(evaluatePredicate(rule, context).value, "UNKNOWN");
});

test("all refined sources remain incomplete unreviewed drafts with no premature questions or public approval", () => {
  for (const entry of [...drafts.items, ...familyDrafts.items, ...healthHousingDrafts.items].filter((row) => row.recipe.disposition === "CANDIDATE")) {
    const policy = sixFieldPreparedCatalog.policies.find((p) => p.id === entry.recipe.policyId)!;
    assert.equal(policy.release, "HIDDEN");
    assert.ok(policy.paths.every((path) => !path.complete));
    assert.ok(policy.rules.every((rule) => rule.review === "UNREVIEWED" && rule.evidenceRefs.length > 0));
    assert.ok(!sixFieldPreparedCatalog.questions.some((question) => policy.rules.some((rule) => rule.fact.attribute === question.fact.attribute)));
  }
});

test("short pre-birth residence retains later qualification and early-birth exception paths", () => {
  const { policy, context } = fixture("RF01", { sixMonthsBeforeBirth: no });
  assert.deepEqual(policy.paths.map((path) => evaluateExpression(path.expression, policy.rules, context).value), ["FALSE", "UNKNOWN", "UNKNOWN"]);
});

test("post-application selection is not required before foster-support application", () => {
  const { policy, context } = fixture("RF05");
  assert.ok(!policy.rules.some((rule) => rule.fact.attribute.endsWith("committeeSelection")));
  assert.deepEqual(policy.paths.map((path) => evaluateExpression(path.expression, policy.rules, context).value), ["UNKNOWN", "UNKNOWN"]);
});

test("leave applicant must care for the under-18 child; another household member's facts do not substitute", () => {
  const { policy, context } = fixture("RF07");
  const rule = policy.rules.find((rule) => rule.fact.attribute.endsWith("workerCaringForUnder18ChildUsingUnpaidLeave"))!;
  assert.equal(evaluatePredicate(rule, context).value, "TRUE");
  const answer = context.answers.find((answer) => answer.key.attribute === rule.fact.attribute)!;
  answer.key.subject = context.household;
  assert.equal(evaluatePredicate(rule, context).value, "UNKNOWN");
});

test("transfer and out-of-school exceptions do not inherit unconfirmed first-entry residence dates", () => {
  const { policy, context } = fixture("RF10", { ansanResidenceFromEntryToApplication: no });
  assert.deepEqual(policy.paths.map((path) => evaluateExpression(path.expression, policy.rules, context).value), ["FALSE", "UNKNOWN", "UNKNOWN"]);
});

test("conflicting age-year source is held instead of compiled into a coarse age filter", () => {
  const entry = familyDrafts.items.find((row) => row.sampleId === "RF06")!;
  assert.ok(!sixFieldPreparedCatalog.policies.some((policy) => policy.id === entry.source.policy.id));
  assert.equal(sixFieldPreparationQueue.find((row) => row.policyId === entry.source.policy.id)?.status, "HELD");
});

test("home purchase and nonowner lease remain alternative loan-support routes", () => {
  const { policy, context } = fixture("RH07", { leaseAllMembersNonowners: no });
  assert.deepEqual(policy.paths.map((path) => evaluateExpression(path.expression, policy.rules, context).value), ["UNKNOWN", "FALSE"]);
});

test("child-household income exception survives the general lower income limit", () => {
  const { policy, context } = fixture("RH09", { assessedIncomeAtMost60: no });
  assert.deepEqual(policy.paths.map((path) => evaluateExpression(path.expression, policy.rules, context).value), ["FALSE", "UNKNOWN"]);
  const rule = policy.rules.find((rule) => rule.fact.attribute.endsWith("assessedIncomeAtMost80"))!;
  context.answers.find((answer) => answer.key.attribute === rule.fact.attribute)!.key.basis = "RECOGNIZED_INCOME_RATIO";
  assert.equal(evaluatePredicate(rule, context).value, "UNKNOWN");
});

test("housing-support exclusions reject the specified benefit while preserving scope of unrelated aid", () => {
  const { policy, context } = fixture("RH12");
  assert.equal(evaluateExpression(policy.paths[0].expression, policy.rules, context).value, "UNKNOWN");
  const rule = policy.rules.find((rule) => rule.fact.attribute.endsWith("publicRentalResident"))!;
  const answer = context.answers.find((answer) => answer.key.attribute === rule.fact.attribute)!;
  if (answer.state !== "PROVIDED") throw new Error("fixture-answer-missing");
  answer.value = { kind: "CODE", value: "YES" };
  assert.equal(evaluateExpression(policy.paths[0].expression, policy.rules, context).value, "FALSE");
});
