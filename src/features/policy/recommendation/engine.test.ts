import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateRecommendation } from "./engine.ts";
import { bindFact, replaceAnswer } from "./facts.ts";
import { educationFixture, educationRequest } from "./education.fixture.ts";
import type { Answer, Request } from "./types.ts";
const copy = <T>(value: T): T => structuredClone(value);
const resultRequest = (): Request => ({
  ...copy(educationRequest),
  phase: "RESULTS",
});
function answer(
  questionId: string,
  childId: string,
  value: string | boolean,
): Answer {
  const q = educationFixture.questions.find((q) => q.id === questionId)!;
  return {
    key: bindFact(q.fact, {
      beneficiary: { kind: "CHILD", id: childId },
      household: { kind: "HOUSEHOLD", id: "household-1" },
    }),
    recordedAt: educationRequest.evaluatedAt,
    questionId: q.id,
    questionVersion: q.version,
    state: "PROVIDED",
    source: "USER_DECLARED",
    value:
      typeof value === "boolean"
        ? { kind: "BOOLEAN", value }
        : { kind: "CODE", value },
  };
}
const eligibleE03 = (child: string) => [
  answer("registered-region", child, "GIJANG"),
  answer("school-stage", child, "HIGH_SCHOOL"),
  answer("school-course", child, "REGULAR"),
  answer("school-uniform", child, true),
  answer("entry-year", child, "2026"),
  answer("entry-kind", child, "FIRST"),
];

test("fixture catalog is never exposed through PUBLIC mode and stale releases are withheld", () => {
  assert.equal(
    evaluateRecommendation(educationFixture, {
      ...resultRequest(),
      mode: "PUBLIC",
    }).cards.length,
    0,
  );
  const catalog = copy(educationFixture);
  catalog.policies[0].releaseSourceVersion = "old";
  assert.deepEqual(
    evaluateRecommendation(catalog, resultRequest()).cards.map(
      (c) => c.policyId,
    ),
    ["E04"],
  );
});
test("questions stay private until results, useful questions stop at five, skipped facts are not re-asked", () => {
  const request = copy(educationRequest);
  const first = evaluateRecommendation(educationFixture, request);
  assert.equal(first.cards.length, 0);
  assert.deepEqual(first.top5, []);
  assert.ok(first.nextQuestion);
  const q = first.nextQuestion;
  request.answers.push({
    key: q.factKey,
    recordedAt: request.evaluatedAt,
    state: "SKIPPED",
  });
  assert.notEqual(
    evaluateRecommendation(educationFixture, request).nextQuestion?.key,
    q.key,
  );
  const stopped = evaluateRecommendation(educationFixture, {
    ...request,
    questionCount: 5,
  });
  assert.equal(stopped.stopReason, "QUESTION_LIMIT");
  assert.equal(stopped.cards.length, 0);
  const results = evaluateRecommendation(educationFixture, {
    ...request,
    phase: "RESULTS",
  });
  assert.equal(results.cards.length, 2);
  assert.equal(results.nextQuestion, null);
});
test("same policy is one card with independent child states; facts cannot cross children", () => {
  const request = resultRequest();
  request.answers = eligibleE03("child-1");
  const card = evaluateRecommendation(educationFixture, request).cards.find(
    (c) => c.policyId === "E03",
  )!;
  assert.equal(
    card.tags.find((t) => t.subject.id === "child-1")?.eligibility,
    "ELIGIBLE",
  );
  assert.equal(
    card.tags.find((t) => t.subject.id === "child-2")?.eligibility,
    "UNKNOWN",
  );
  assert.equal(
    card.tags.find((t) => t.subject.id === "child-2")?.label,
    "추가 확인 필요",
  );
  request.answers = [
    answer("registered-region", "child-1", "GIJANG"),
    ...eligibleE03("child-2").filter(
      (a) => a.questionId !== "registered-region",
    ),
  ];
  assert.ok(
    evaluateRecommendation(educationFixture, request)
      .cards.find((c) => c.policyId === "E03")!
      .pathResults.every((p) => p.eligibility.value === "UNKNOWN"),
  );
});
test("editing an excluding fact restores the policy from the full catalog and deselection removes child tags", () => {
  const request = resultRequest();
  request.selectedChildren = ["child-1"];
  request.answers = [answer("registered-region", "child-1", "OTHER")];
  assert.equal(
    evaluateRecommendation(educationFixture, request).cards.some(
      (c) => c.policyId === "E03",
    ),
    false,
  );
  request.answers = replaceAnswer(
    request.answers,
    answer("registered-region", "child-1", "GIJANG"),
  );
  assert.ok(
    evaluateRecommendation(educationFixture, request).cards.some(
      (c) => c.policyId === "E03",
    ),
  );
  assert.ok(
    evaluateRecommendation(educationFixture, request).cards.every((c) =>
      c.tags.every((t) => t.subject.id === "child-1"),
    ),
  );
});
test("incomplete subject or alternative coverage never permits a whole-policy exclusion", () => {
  const request = resultRequest();
  request.answers = [
    answer("entry-year", "child-1", "OTHER"),
    answer("entry-year", "child-2", "OTHER"),
  ];
  assert.equal(
    evaluateRecommendation(educationFixture, request).cards.length,
    0,
  );
  assert.equal(
    evaluateRecommendation(educationFixture, {
      ...request,
      subjectsComplete: false,
    }).cards.length,
    2,
  );
  const catalog = copy(educationFixture);
  catalog.policies.forEach((p) => (p.completePaths = false));
  assert.equal(evaluateRecommendation(catalog, request).cards.length, 2);
});
test("twenty policy cap and global top five are stable and do not fill missing candidates", () => {
  const catalog = copy(educationFixture);
  catalog.policies = Array.from({ length: 27 }, (_, i) => ({
    ...copy(catalog.policies[0]),
    id: `policy-${String(i).padStart(2, "0")}`,
  }));
  const request = resultRequest();
  const result = evaluateRecommendation(catalog, request);
  assert.equal(result.candidateCount, 27);
  assert.equal(result.cards.length, 20);
  assert.equal(result.top5.length, 5);
  assert.equal(new Set(result.cards.map((c) => c.policyId)).size, 20);
  catalog.policies.reverse();
  assert.deepEqual(evaluateRecommendation(catalog, request), result);
  assert.equal(
    evaluateRecommendation(educationFixture, request).top5.length,
    2,
  );
});
test("selected child count is never inferred as a household count", () => {
  const catalog = copy(educationFixture);
  const policy = catalog.policies[0];
  policy.rules = [
    {
      id: "count",
      fact: {
        attribute: "household.eligibleChildren",
        subject: "HOUSEHOLD",
        basis: "POLICY_COUNT",
        reference: "2026",
      },
      label: "synthetic count",
      evidenceRefs: ["fixture:count"],
      review: "FIXTURE",
      sourceVersion: policy.sourceVersion,
      operator: "NUMBER_RANGE",
      min: 2,
      max: null,
      minInclusive: true,
      maxInclusive: false,
      unit: "children",
    },
  ];
  policy.paths[0].subject = "HOUSEHOLD";
  policy.paths[0].expression = { kind: "PREDICATE", ruleId: "count" };
  catalog.policies = [policy];
  const card = evaluateRecommendation(catalog, resultRequest()).cards[0];
  assert.equal(card.eligibility, "UNKNOWN");
  assert.equal(card.tags[0].subject.kind, "HOUSEHOLD");
});
test("answers irrelevant to unresolved policy evidence do not produce endless questions", () => {
  const catalog = copy(educationFixture);
  catalog.policies.forEach((p) =>
    p.paths.forEach((path) => (path.expression = { kind: "UNRESOLVED" })),
  );
  const result = evaluateRecommendation(catalog, educationRequest);
  assert.equal(result.nextQuestion, null);
  assert.equal(result.stopReason, "NO_USEFUL_QUESTION");
});
test("a changed prerequisite deactivates dependent child facts and a dependency cycle is rejected", () => {
  const catalog = copy(educationFixture);
  catalog.questions.find((q) => q.id === "school-uniform")!.prerequisites = [
    {
      questionId: "school-stage",
      equals: { kind: "CODE", value: "HIGH_SCHOOL" },
    },
  ];
  const request = resultRequest();
  request.answers = eligibleE03("child-1");
  request.answers = replaceAnswer(
    request.answers,
    answer("school-stage", "child-1", "OTHER"),
  );
  // Remove the stage condition so that only dependent uniform validity can decide.
  const policy = catalog.policies[0];
  policy.paths[0].expression = { kind: "PREDICATE", ruleId: "E03.uniform" };
  assert.equal(
    evaluateRecommendation(catalog, request).cards.find(
      (c) => c.policyId === "E03",
    )?.eligibility,
    "UNKNOWN",
  );
  catalog.questions.find((q) => q.id === "school-stage")!.prerequisites = [
    { questionId: "school-uniform", equals: { kind: "BOOLEAN", value: true } },
  ];
  assert.throws(
    () => evaluateRecommendation(catalog, request),
    /question-cycle/,
  );
});
test("timing boundaries close a passed deadline and cannot produce an OPEN urgency claim", () => {
  const catalog = copy(educationFixture);
  catalog.policies[0].paths[0].deadline = "2026-09-08T00:00:00Z";
  assert.equal(
    evaluateRecommendation(catalog, resultRequest()).cards.some(
      (c) => c.policyId === "E03",
    ),
    false,
  );
  assert.equal(
    evaluateRecommendation(catalog, { ...resultRequest(), view: "CLOSED" })
      .cards[0].representative.availability,
    "CLOSED",
  );
});

test("top-five diversity balances children only within equal relevance", () => {
  const request = resultRequest();
  request.answers = eligibleE03("child-1");
  request.answers.push(answer("school-stage", "child-2", "MIDDLE_SCHOOL"));
  const catalog = structuredClone(educationFixture);
  const source = catalog.policies[0];
  catalog.policies = Array.from({ length: 6 }, (_, i) => {
    const policy = structuredClone(source);
    policy.id = `a-${i}`;
    policy.paths[0].expression = { kind: "PREDICATE", ruleId: "E03.stage" };
    return policy;
  });
  const other = structuredClone(catalog.policies[0]);
  other.id = "z-other-child";
  const stage = other.rules.find((r) => r.id === "E03.stage")!;
  if (stage.operator === "EQ") stage.expected = "MIDDLE_SCHOOL";
  catalog.policies.push(other);
  const result = evaluateRecommendation(catalog, request);
  assert.deepEqual(result.top5.slice(0, 2), ["a-0", "z-other-child"]);
  other.paths[0].purposes = ["other-purpose"];
  assert.equal(
    evaluateRecommendation(catalog, request).top5.includes("z-other-child"),
    false,
  );
});

test("the representative never combines a different child's eligibility with its score", () => {
  const request = resultRequest();
  request.answers = eligibleE03("child-2");
  const card = evaluateRecommendation(educationFixture, request).cards.find(
    (c) => c.policyId === "E03",
  )!;
  assert.equal(card.representative.subject.id, "child-1");
  assert.equal(card.eligibility, "UNKNOWN");
  assert.equal(
    card.tags.find((t) => t.subject.id === "child-2")?.eligibility,
    "ELIGIBLE",
  );
});

test("incomplete policy paths do not shift evidence repair into user questioning", () => {
  const catalog = copy(educationFixture);
  catalog.policies.forEach((p) =>
    p.paths.forEach((path) => (path.complete = false)),
  );
  assert.equal(
    evaluateRecommendation(catalog, educationRequest).nextQuestion,
    null,
  );
});
