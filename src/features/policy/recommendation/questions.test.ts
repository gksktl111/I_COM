import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateRecommendation, evaluateCards } from "./engine.ts";
import { bindFact } from "./facts.ts";
import { simulateQuestionImpact } from "./questions.ts";
import { educationFixture, educationRequest } from "./education.fixture.ts";
import type {
  Catalog,
  FactRef,
  FactValue,
  QuestionDefinition,
  Request,
} from "./types.ts";
const ref = (attribute: string): FactRef => ({
  attribute,
  subject: "BENEFICIARY",
  basis: "TEST",
  reference: "2026",
});
const yes: FactValue = { kind: "BOOLEAN", value: true },
  no: FactValue = { kind: "BOOLEAN", value: false };
const question = (
  id: string,
  prerequisites: QuestionDefinition["prerequisites"] = [],
  burden: 1 | 2 | 3 | 4 = 1,
): QuestionDefinition => ({
  id,
  version: "1",
  fact: ref(id),
  prompt: id,
  whyAsked: "synthetic test",
  burden,
  options: [
    { label: "yes", value: yes },
    { label: "no", value: no },
  ],
  prerequisites,
});
function setup(): { catalog: Catalog; request: Request } {
  const catalog = structuredClone(educationFixture),
    request = structuredClone(educationRequest);
  catalog.policies = [catalog.policies[0]];
  request.selectedChildren = ["child-1"];
  catalog.questions = [
    question("a"),
    question("b"),
    question("c", [
      { questionId: "a", equals: yes },
      { questionId: "b", equals: yes },
    ]),
  ];
  catalog.policies[0].rules = [
    {
      id: "c",
      fact: ref("c"),
      label: "test",
      sourceVersion: catalog.policies[0].sourceVersion,
      review: "FIXTURE",
      evidenceRefs: ["fixture:c"],
      operator: "EQ",
      expected: true,
    },
  ];
  catalog.policies[0].paths[0].expression = { kind: "PREDICATE", ruleId: "c" };
  return { catalog, request };
}
const keyFor = (q: QuestionDefinition, child = "child-1") =>
  bindFact(q.fact, {
    beneficiary: { kind: "CHILD", id: child },
    household: { kind: "HOUSEHOLD", id: "household-1" },
  });
test("independent prerequisite questions receive utility from the jointly unlocked question", () => {
  const { catalog, request } = setup();
  const result = evaluateRecommendation(catalog, request);
  assert.ok(result.nextQuestion);
  assert.ok(["a", "b"].includes(result.nextQuestion.definitionId));
  assert.equal(result.nextQuestion.burden, 3);
  assert.equal(result.nextQuestion.utility, 1 / 3);
});
test("prerequisite simulation never borrows another child's unlocked question", () => {
  const { catalog, request } = setup();
  request.selectedChildren.push("child-2");
  request.answers = ["a", "b"].map((id) => ({
    key: keyFor(catalog.questions.find((q) => q.id === id)!, "child-2"),
    recordedAt: request.evaluatedAt,
    state: "PROVIDED" as const,
    value: yes,
    source: "USER_DECLARED" as const,
  }));
  const q = catalog.questions[0];
  const impact = simulateQuestionImpact(
    catalog,
    request,
    { definition: q, key: keyFor(q) },
    evaluateCards(catalog, request),
    evaluateCards,
  );
  assert.equal(
    impact.burden,
    3,
    "child-2's already-known parents cannot lower child-1 cost",
  );
});
test("cheapest prerequisite path cost is independent of question registry order", () => {
  const { catalog, request } = setup();
  catalog.questions = [
    question("a"),
    question("expensive", [{ questionId: "a", equals: yes }], 4),
    question("cheap", [{ questionId: "a", equals: yes }]),
  ];
  const p = catalog.policies[0];
  p.rules = ["expensive", "cheap"].map((id) => ({
    id,
    fact: ref(id),
    label: id,
    sourceVersion: p.sourceVersion,
    review: "FIXTURE",
    evidenceRefs: ["fixture:" + id],
    operator: "EQ",
    expected: true,
  }));
  p.paths[0].expression = {
    kind: "ANY",
    children: p.rules.map((r) => ({ kind: "PREDICATE", ruleId: r.id })),
  };
  const get = () =>
    simulateQuestionImpact(
      catalog,
      request,
      {
        definition: catalog.questions.find((q) => q.id === "a")!,
        key: keyFor(question("a")),
      },
      evaluateCards(catalog, request),
      evaluateCards,
    );
  assert.equal(get().burden, 2);
  catalog.questions.reverse();
  assert.equal(get().burden, 2);
});
test("a supplied coarse range can trigger a finer question while skipped ranges cannot", () => {
  const { catalog, request } = setup();
  const p = catalog.policies[0];
  const range = (min: number, max: number): FactValue => ({
    kind: "NUMBER_RANGE",
    min,
    max,
    minInclusive: true,
    maxInclusive: true,
    unit: "percent",
  });
  catalog.questions = [
    {
      ...question("income"),
      options: [
        { label: "low", value: range(0, 50) },
        { label: "high", value: range(51, 80) },
      ],
    },
  ];
  p.rules = [
    {
      id: "income",
      fact: ref("income"),
      label: "income",
      sourceVersion: p.sourceVersion,
      review: "FIXTURE",
      evidenceRefs: ["fixture:income"],
      operator: "NUMBER_RANGE",
      min: 0,
      max: 50,
      minInclusive: true,
      maxInclusive: true,
      unit: "percent",
    },
  ];
  p.paths[0].expression = { kind: "PREDICATE", ruleId: "income" };
  const key = keyFor(catalog.questions[0]);
  request.answers = [
    {
      key,
      recordedAt: request.evaluatedAt,
      state: "PROVIDED",
      source: "USER_DECLARED",
      value: range(0, 80),
    },
  ];
  assert.equal(
    evaluateRecommendation(catalog, request).nextQuestion?.definitionId,
    "income",
  );
  request.answers = [
    { key, recordedAt: request.evaluatedAt, state: "SKIPPED" },
  ];
  assert.equal(evaluateRecommendation(catalog, request).nextQuestion, null);
});
