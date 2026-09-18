import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateEligibility,
  evaluateExpression,
  evaluatePredicate,
} from "./eligibility.ts";
import type {
  Answer,
  Context,
  FactValue,
  Policy,
  PolicyPath,
  Predicate,
} from "./types.ts";

const fact = {
  attribute: "residence",
  subject: "BENEFICIARY" as const,
  basis: "CURRENT",
  reference: "2026-09-09",
};
const base: Predicate = {
  id: "resident",
  label: "Resident",
  fact,
  operator: "EQ",
  expected: "SEOUL",
  sourceVersion: "v1",
  review: "HUMAN",
  evidenceRefs: ["source:1"],
};
const context: Context = {
  answers: [],
  beneficiary: { kind: "CHILD", id: "a" },
  household: { kind: "HOUSEHOLD", id: "h" },
  sourceVersion: "v1",
  mode: "PUBLIC",
};
function answer(value: FactValue = { kind: "CODE", value: "SEOUL" }): Answer {
  return {
    key: { ...fact, subject: context.beneficiary },
    state: "PROVIDED",
    value,
    source: "USER_DECLARED",
    recordedAt: "2026-09-09T00:00:00Z",
  };
}
const withAnswers = (...answers: Answer[]): Context => ({
  ...context,
  answers,
});
const ref = (ruleId = base.id) => ({ kind: "PREDICATE" as const, ruleId });
const path: PolicyPath = {
  id: "p",
  subject: "CHILD",
  complete: true,
  expression: ref(),
  purposes: [],
  purposeEvidence: [],
  availability: "OPEN",
  availabilityEvidence: [],
};
const policy: Policy = {
  id: "policy",
  title: "Policy",
  category: "care",
  sourceVersion: "v1",
  releaseSourceVersion: "v1",
  release: "HUMAN",
  completePaths: true,
  rules: [base],
  paths: [path],
};

test("facts never cross children, household bindings, basis, or reference date", () => {
  const original = answer();
  for (const key of [
    { ...original.key, subject: { kind: "CHILD" as const, id: "b" } },
    { ...original.key, subject: context.household },
    { ...original.key, basis: "BIRTH" },
    { ...original.key, reference: "2025-09-09" },
  ])
    assert.equal(
      evaluatePredicate(base, withAnswers({ ...original, key })).value,
      "UNKNOWN",
    );
  const householdRule = {
    ...base,
    fact: { ...fact, subject: "HOUSEHOLD" as const },
  };
  assert.equal(
    evaluatePredicate(
      householdRule,
      withAnswers({
        ...original,
        key: { ...original.key, subject: context.household },
      }),
    ).value,
    "TRUE",
  );
  assert.equal(evaluatePredicate(base, withAnswers(original)).value, "TRUE");
});

test("missing and inactive answers are askable; explicit uncertainty is not", () => {
  assert.equal(
    evaluatePredicate(base, context).unknowns[0].resolvableByQuestion,
    true,
  );
  assert.equal(
    evaluatePredicate(base, withAnswers({ ...answer(), active: false })).value,
    "UNKNOWN",
  );
  for (const state of [
    "SKIPPED",
    "DONT_KNOW",
    "EXPLICIT_NOT_APPLICABLE",
  ] as const) {
    const evaluated = evaluatePredicate(
      base,
      withAnswers({
        key: answer().key,
        recordedAt: answer().recordedAt,
        state,
      }),
    );
    assert.equal(evaluated.value, "UNKNOWN");
    assert.equal(evaluated.unknowns[0].resolvableByQuestion, false);
  }
});

test("conflicting active duplicates remain unknown; inactive history and identical duplicates do not conflict", () => {
  const no = answer({ kind: "CODE", value: "BUSAN" });
  assert.equal(
    evaluatePredicate(base, withAnswers(answer(), no)).unknowns[0].kind,
    "USER_CONFLICT",
  );
  assert.equal(
    evaluatePredicate(base, withAnswers(answer(), { ...no, active: false }))
      .value,
    "TRUE",
  );
  assert.equal(
    evaluatePredicate(base, withAnswers(answer(), answer())).value,
    "TRUE",
  );
});

test("ANY supports exception branches, ALL and NOT follow three-valued logic", () => {
  const exception: Predicate = {
    ...base,
    id: "exception",
    fact: { ...fact, attribute: "exception" },
    operator: "EQ",
    expected: true,
  };
  const exceptionAnswer = {
    ...answer({ kind: "BOOLEAN", value: true }),
    key: { ...answer().key, attribute: "exception" },
  };
  const ctx = withAnswers(exceptionAnswer);
  const rules = [base, exception];
  const children = [ref(), ref("exception")];
  assert.equal(
    evaluateExpression({ kind: "ANY", children }, rules, ctx).value,
    "TRUE",
  );
  assert.equal(
    evaluateExpression({ kind: "ALL", children }, rules, ctx).value,
    "UNKNOWN",
  );
  assert.equal(
    evaluateExpression({ kind: "NOT", child: ref() }, rules, ctx).value,
    "UNKNOWN",
  );
  assert.equal(
    evaluateExpression({ kind: "NOT", child: ref("exception") }, rules, ctx)
      .value,
    "FALSE",
  );
  const negative = withAnswers(answer({ kind: "CODE", value: "BUSAN" }));
  assert.equal(
    evaluateExpression({ kind: "ALL", children }, rules, negative).value,
    "FALSE",
  );
});

test("unreviewed, stale and evidence-free predicates cannot decide eligibility", () => {
  for (const rule of [
    { ...base, review: "UNREVIEWED" as const },
    { ...base, review: "FIXTURE" as const },
    { ...base, sourceVersion: "old" },
    { ...base, evidenceRefs: [] },
  ]) {
    const evaluated = evaluatePredicate(rule, withAnswers(answer()));
    assert.equal(evaluated.value, "UNKNOWN");
    assert.equal(evaluated.unknowns[0].resolvableByQuestion, false);
  }
  assert.equal(
    evaluatePredicate(
      { ...base, review: "FIXTURE" },
      { ...withAnswers(answer()), mode: "FIXTURE" },
    ).value,
    "TRUE",
  );
});

test("incomplete paths never conclude even from a true or false expression", () => {
  for (const value of ["SEOUL", "BUSAN"])
    assert.equal(
      evaluateEligibility(
        policy,
        { ...path, complete: false },
        withAnswers(answer({ kind: "CODE", value })),
      ).value,
      "UNKNOWN",
    );
  assert.equal(
    evaluateEligibility(policy, path, withAnswers(answer())).value,
    "ELIGIBLE",
  );
  assert.equal(
    evaluateEligibility(
      { ...policy, releaseSourceVersion: "old" },
      path,
      withAnswers(answer()),
    ).value,
    "UNKNOWN",
  );
  for (const expression of [
    { kind: "UNRESOLVED" as const },
    { kind: "ALL" as const, children: [] },
    { kind: "ANY" as const, children: [] },
    ref("absent"),
  ])
    assert.equal(
      evaluateExpression(expression, [base], context).value,
      "UNKNOWN",
    );
});

test("number intervals distinguish inclusion, disjointness, overlap and units", () => {
  const range = {
    kind: "NUMBER_RANGE" as const,
    min: 0,
    max: 10,
    minInclusive: true,
    maxInclusive: false,
    unit: "YEARS",
  };
  const rule: Predicate = { ...base, ...range, operator: "NUMBER_RANGE" };
  const cases: [Partial<typeof range>, string][] = [
    [{}, "TRUE"],
    [{ min: 2, max: 9 }, "TRUE"],
    [{ min: 10, max: 12 }, "FALSE"],
    [{ min: 9, max: 12 }, "UNKNOWN"],
    [{ min: 10, max: 10, maxInclusive: true }, "FALSE"],
    [{ min: -2, max: 0, maxInclusive: false }, "FALSE"],
    [{ min: -2, max: 0, maxInclusive: true }, "UNKNOWN"],
    [{ unit: "MONTHS" }, "UNKNOWN"],
  ];
  for (const [change, expected] of cases)
    assert.equal(
      evaluatePredicate(rule, withAnswers(answer({ ...range, ...change })))
        .value,
      expected,
      JSON.stringify(change),
    );
  const unbounded: Predicate = { ...rule, min: null, max: null };
  assert.equal(
    evaluatePredicate(unbounded, withAnswers(answer(range))).value,
    "TRUE",
  );
});

test("date ranges are inclusive and overlapping dates require precision", () => {
  const rule: Predicate = {
    ...base,
    operator: "DATE_RANGE",
    earliest: "2026-01-01",
    latest: "2026-12-31",
  };
  for (const [earliest, latest, expected] of [
    ["2026-01-01", "2026-12-31", "TRUE"],
    ["2027-01-01", "2027-01-02", "FALSE"],
    ["2025-12-31", "2026-01-01", "UNKNOWN"],
  ]) {
    assert.equal(
      evaluatePredicate(
        rule,
        withAnswers(answer({ kind: "DATE_RANGE", earliest, latest })),
      ).value,
      expected,
    );
  }
});

test("IN_SET compares codes and audit metadata identifies exact evidence and fact", () => {
  const evaluated = evaluatePredicate(
    { ...base, operator: "IN_SET", expected: ["SEOUL", "BUSAN"] },
    withAnswers(answer()),
  );
  assert.equal(evaluated.value, "TRUE");
  assert.deepEqual(evaluated.evidenceRefs, ["source:1"]);
  assert.deepEqual(evaluated.usedAnswerKeys, [answer().key]);
  assert.deepEqual(evaluated.unknowns, []);
});
