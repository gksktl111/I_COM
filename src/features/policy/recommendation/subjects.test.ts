import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateRecommendation } from "./engine.ts";
import { activateAnswers, bindFact, validateRequest } from "./facts.ts";
import { educationRequest } from "./education.fixture.ts";
import type { Answer, Catalog, Request, Subject } from "./types.ts";

function setup(): { catalog: Catalog; request: Request } {
  const fact = {
    attribute: "support.qualifies",
    subject: "BENEFICIARY" as const,
    basis: "DECLARED",
    reference: "CURRENT",
  };
  return {
    catalog: {
      version: "subjects-test-1",
      questions: [
        {
          id: "qualifies",
          version: "1",
          fact,
          prompt: "해당 조건에 해당하나요?",
          whyAsked: "synthetic subject isolation",
          burden: 1,
          options: [
            { label: "yes", value: { kind: "BOOLEAN", value: true } },
            { label: "no", value: { kind: "BOOLEAN", value: false } },
          ],
          prerequisites: [],
        },
      ],
      policies: (["PERSON", "EVENT"] as const).map((kind) => ({
        id: kind,
        title: kind,
        category: "test",
        sourceVersion: "1",
        release: "FIXTURE",
        releaseSourceVersion: "1",
        completePaths: true,
        rules: [
          {
            id: "qualifies",
            fact,
            label: "synthetic condition",
            evidenceRefs: ["fixture:condition"],
            review: "FIXTURE",
            sourceVersion: "1",
            operator: "EQ",
            expected: true,
          },
        ],
        paths: [
          {
            id: kind,
            subject: kind,
            complete: true,
            expression: { kind: "PREDICATE", ruleId: "qualifies" },
            purposes: ["care"],
            purposeEvidence: ["fixture:purpose"],
            availability: "UNKNOWN",
            availabilityEvidence: [],
          },
        ],
      })),
    },
    request: {
      ...structuredClone(educationRequest),
      category: "test",
      selectedChildren: [],
      selectedSubjects: [
        { kind: "PERSON", id: "same-id" },
        { kind: "EVENT", id: "same-id" },
      ],
      needs: ["care"],
      answers: [],
      phase: "RESULTS",
    },
  };
}
function answer(
  catalog: Catalog,
  request: Request,
  subject: Subject,
  value = true,
): Answer {
  const question = catalog.questions[0];
  return {
    key: bindFact(question.fact, {
      beneficiary: subject,
      household: { kind: "HOUSEHOLD", id: request.householdId },
    }),
    recordedAt: request.evaluatedAt,
    questionId: question.id,
    questionVersion: question.version,
    state: "PROVIDED",
    source: "USER_DECLARED",
    value: { kind: "BOOLEAN", value },
  };
}

test("person and event paths bind only their own kind, even with identical IDs", () => {
  const { catalog, request } = setup();
  request.answers = [
    answer(catalog, request, { kind: "PERSON", id: "same-id" }),
  ];
  const cards = evaluateRecommendation(catalog, request).cards;
  assert.equal(
    cards.find((card) => card.policyId === "PERSON")?.eligibility,
    "ELIGIBLE",
  );
  const event = cards.find((card) => card.policyId === "EVENT")!;
  assert.equal(event.eligibility, "UNKNOWN");
  assert.deepEqual(
    event.pathResults.map((path) => path.subject),
    [{ kind: "EVENT", id: "same-id" }],
  );
  const next = evaluateRecommendation(catalog, {
    ...request,
    phase: "QUESTIONING",
  }).nextQuestion;
  assert.deepEqual(next?.factKey.subject, { kind: "EVENT", id: "same-id" });
  assert.deepEqual(next?.affectedPolicyIds, ["EVENT"]);
});

test("deselected subjects are inactive and cannot activate ranking or affect remaining beneficiaries", () => {
  const { catalog, request } = setup();
  request.selectedSubjects = [{ kind: "EVENT", id: "same-id" }];
  request.answers = [
    answer(catalog, request, { kind: "PERSON", id: "same-id" }),
    answer(catalog, request, { kind: "EVENT", id: "other-event" }),
    {
      ...answer(catalog, request, { kind: "EVENT", id: "same-id" }),
      active: false,
    },
  ];
  catalog.policies[1].paths[0].features = {
    timing: {
      expression: { kind: "PREDICATE", ruleId: "qualifies" },
      evidenceRefs: ["fixture:timing"],
    },
  };
  assert.ok(
    activateAnswers(request, catalog.questions).every((item) => !item.active),
  );
  const result = evaluateRecommendation(catalog, request);
  assert.deepEqual(
    result.cards.map((card) => card.policyId),
    ["EVENT"],
  );
  assert.equal(result.cards[0].eligibility, "UNKNOWN");
  assert.equal(result.cards[0].representative.features[1].value, "NOT_USED");
});

test("a person's prerequisite answer cannot unlock an event question for the same ID", () => {
  const { catalog, request } = setup();
  const dependent = catalog.questions[0];
  catalog.questions.push({
    ...structuredClone(dependent),
    id: "prerequisite",
    fact: { ...dependent.fact, attribute: "support.prerequisite" },
  });
  dependent.prerequisites = [
    { questionId: "prerequisite", equals: { kind: "BOOLEAN", value: true } },
  ];
  request.answers = [
    answer(catalog, request, { kind: "EVENT", id: "same-id" }),
  ];
  const parent = answer(catalog, request, { kind: "PERSON", id: "same-id" });
  parent.questionId = "prerequisite";
  parent.key.attribute = "support.prerequisite";
  request.answers.push(parent);
  assert.equal(activateAnswers(request, catalog.questions)[0].active, false);
  assert.equal(
    evaluateRecommendation(catalog, request).cards.find(
      (card) => card.policyId === "EVENT",
    )?.eligibility,
    "UNKNOWN",
  );
});

test("an active person fact cannot activate an event-only ranking feature", () => {
  const { catalog, request } = setup();
  request.answers = [
    answer(catalog, request, { kind: "PERSON", id: "same-id" }),
  ];
  catalog.policies = [catalog.policies[1]];
  catalog.policies[0].paths[0].features = {
    timing: {
      expression: { kind: "PREDICATE", ruleId: "qualifies" },
      evidenceRefs: ["fixture:timing"],
    },
  };
  assert.equal(
    evaluateRecommendation(catalog, request).cards[0].representative.features[1]
      .value,
    "NOT_USED",
  );
});

test("generic subject scope rejects invalid kinds, duplicate pairs and oversized combined scopes", () => {
  const { request } = setup();
  assert.doesNotThrow(() => validateRequest(request));
  for (const selectedSubjects of [
    null,
    [{ kind: "CHILD", id: "child" }],
    [{ kind: "HOUSEHOLD", id: "home" }],
    [{ kind: "PERSON", id: " " }],
    [{ kind: "EVENT" }],
    [{ kind: "PERSON", id: "x", extra: true }],
    [
      { kind: "PERSON", id: "x" },
      { kind: "PERSON", id: "x" },
    ],
  ]) {
    assert.throws(
      () => validateRequest({ ...request, selectedSubjects } as Request),
      /invalid-scope/,
    );
  }
  request.selectedChildren = Array.from({ length: 30 }, (_, i) => `child-${i}`);
  request.selectedSubjects = Array.from({ length: 30 }, (_, i) => ({
    kind: "EVENT",
    id: `event-${i}`,
  }));
  assert.doesNotThrow(() => validateRequest(request));
  request.selectedSubjects.push({ kind: "PERSON", id: "one-too-many" });
  assert.throws(() => validateRequest(request), /invalid-scope/);
});

test("incomplete purpose mapping retains unknown relevance unless an evidenced purpose matches", () => {
  const { catalog, request } = setup();
  const path = catalog.policies[0].paths[0];
  const feature = () =>
    evaluateRecommendation(catalog, request).cards.find(
      (card) => card.policyId === "PERSON",
    )!.representative.features[0].value;
  path.purposes = ["different"];
  assert.equal(
    feature(),
    "OTHER",
    "legacy absent completeness remains compatible",
  );
  path.purposesComplete = false;
  assert.equal(feature(), "UNKNOWN");
  path.purposes.push("care");
  assert.equal(feature(), "MATCH");
  path.purposeEvidence = [];
  assert.equal(feature(), "UNKNOWN");
});

test("person and event cards do not consume child diversity coverage", () => {
  const { catalog, request } = setup();
  request.selectedChildren = ["same-id"];
  const child = structuredClone(catalog.policies[0]);
  child.id = "z-child";
  child.paths[0].subject = "CHILD";
  catalog.policies.push(child);
  assert.equal(
    evaluateRecommendation(catalog, request).cards[0].policyId,
    "z-child",
  );
});
test("mixed health catalog does not require a child when the selected beneficiary is self", () => {
  const { catalog, request } = setup();
  const child = structuredClone(catalog.policies[0]);
  child.id = "CHILD";
  child.paths[0].subject = "CHILD";
  catalog.policies.push(child);
  catalog.policies.forEach((p) => {
    p.category = "health";
  });
  request.category = "health";
  request.selectedChildren = [];
  request.selectedSubjects = [{ kind: "PERSON", id: "SELF" }];
  request.answers = [];
  const result = evaluateRecommendation(catalog, request);
  assert(
    result.cards.every((c) =>
      c.pathResults.every((p) => p.subject.kind === "PERSON"),
    ),
  );
  assert(result.cards.some((c) => c.policyId === "PERSON"));
});
