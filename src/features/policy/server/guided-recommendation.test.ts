import test from "node:test";
import assert from "node:assert/strict";
import { createGuidedRecommendationService } from "./guided-recommendation.ts";
import { createCategoryRecommendationService } from "./category-recommendation.ts";
import { educationFixture } from "../recommendation/education.fixture.ts";
import { BANK_FACT_MAPPINGS } from "../recommendation/bank-facts.ts";
import type {
  Catalog,
  Policy,
  QuestionDefinition,
} from "../recommendation/types.ts";
import type { PublicPolicy } from "../public/types.ts";
const now = () => new Date("2026-09-11T00:00:00Z");
const request = {
  flow: "CATEGORY_BANK_V1",
  category: "education",
  needs: ["uniform"],
  revision: 1,
  childProfiles: [{ id: "a", birthYear: 2014, sex: null }],
  bankAnswers: [],
  phase: "RESULTS",
};
function display(id: string): PublicPolicy {
  return {
    id,
    name: "학생 교복 지원",
    summary: null,
    provider_name: null,
    purpose_text: null,
    target_text: null,
    criteria_text: null,
    benefit_text: null,
    application_method_text: null,
    application_period_text: null,
    required_documents_text: null,
    reception_text: null,
    contact_text: null,
    source_url: null,
    application_url: null,
    updated_at: null,
  };
}
// Hypothetical reviewed catalog for transport tests, never a production publication.
function catalog(): Catalog {
  const mapping = BANK_FACT_MAPPINGS.find((m) => m.questionId === "E02")!;
  const school = {
    attribute: mapping.attribute,
    basis: mapping.basis,
    reference: mapping.reference,
    subject: "BENEFICIARY" as const,
  };
  const extra = {
    attribute: "test.confirm",
    basis: "TEST",
    reference: "TEST",
    subject: "BENEFICIARY" as const,
  };
  const policy: Policy = {
    id: "test-education",
    title: "[TEST] School condition",
    category: "education",
    sourceVersion: "test-1",
    releaseSourceVersion: "test-1",
    release: "HUMAN",
    completePaths: true,
    rules: [
      {
        id: "school",
        fact: school,
        label: "고등학교",
        sourceVersion: "test-1",
        review: "HUMAN",
        evidenceRefs: ["test:school"],
        operator: "EQ",
        expected: "HIGH",
      },
      {
        id: "confirm",
        fact: extra,
        label: "추가 조건",
        sourceVersion: "test-1",
        review: "HUMAN",
        evidenceRefs: ["test:confirm"],
        operator: "EQ",
        expected: true,
      },
    ],
    paths: [
      {
        id: "path",
        subject: "CHILD",
        complete: true,
        purposes: ["uniform"],
        purposeEvidence: ["test:purpose"],
        purposesComplete: true,
        availability: "UNKNOWN",
        availabilityEvidence: [],
        expression: {
          kind: "ALL",
          children: [
            { kind: "PREDICATE", ruleId: "school" },
            { kind: "PREDICATE", ruleId: "confirm" },
          ],
        },
      },
    ],
  };
  const q: QuestionDefinition = {
    id: "confirm",
    version: "test-1",
    fact: extra,
    prompt: "추가 조건이 맞나요?",
    whyAsked: "검수된 테스트 조건",
    burden: 1,
    prerequisites: [],
    options: [
      { label: "예", value: { kind: "BOOLEAN", value: true } },
      { label: "아니요", value: { kind: "BOOLEAN", value: false } },
    ],
  };
  return { version: "test-1", policies: [policy], questions: [q] };
}
const bankAnswers = [
  { questionId: "E01", subjectId: "a", state: "PROVIDED", value: "ENROLLED" },
  { questionId: "E02", subjectId: "a", state: "PROVIDED", value: "HIGH" },
];
function service(c = catalog()) {
  return createGuidedRecommendationService({
    now,
    loadCatalog: async () => ({
      catalog: c,
      policies: c.policies.map((p) => display(p.id)),
      coverage: "READY",
    }),
    recommendProvisional: async () => {
      return {
        flow: "CATEGORY_BANK_V1",
        revision: 1,
        policies: [],
        candidateCount: 0,
      };
    },
  });
}
test("existing school answer drives reviewed eligibility; follow-up answer finishes same flow", async () => {
  const run = service();
  const question = await run({ ...request, bankAnswers, phase: "QUESTIONING" });
  assert.equal(question.method, "VERIFIED");
  assert.deepEqual(question.policies, []);
  assert.equal(question.nextQuestion?.id, "confirm");
  const supplied = {
    questionId: "confirm",
    version: "test-1",
    subject: { kind: "CHILD", id: "a" },
    state: "PROVIDED",
    value: "0",
  };
  const results = await run({
    ...request,
    bankAnswers,
    ruleAnswers: [supplied],
    catalogVersion: question.catalogVersion,
    contextKey: question.contextKey,
  });
  assert.equal(results.policies.length, 1);
  assert.equal(results.top5[0], "test-education");
  assert(results.policies[0].tags.includes("자녀 1 · 입력 기준 조건 일치"));
  const denied = await run({
    ...request,
    bankAnswers,
    ruleAnswers: [{ ...supplied, value: "1" }],
    catalogVersion: question.catalogVersion,
    contextKey: question.contextKey,
  });
  assert.equal(denied.policies.length, 0);
});
test("missing and skipped conditions remain results; no repeated skipped question", async () => {
  const run = service();
  const first = await run({ ...request, bankAnswers, phase: "QUESTIONING" });
  const input = {
    ...request,
    bankAnswers,
    ruleAnswers: [
      {
        questionId: "confirm",
        version: "test-1",
        subject: { kind: "CHILD", id: "a" },
        state: "SKIPPED",
      },
    ],
    catalogVersion: first.catalogVersion,
    contextKey: first.contextKey,
  };
  const results = await run(input);
  assert.equal(results.policies.length, 1);
  assert(results.policies[0].tags.includes("자녀 1 · 추가 확인 필요"));
  assert.equal(
    (await run({ ...input, phase: "QUESTIONING" })).nextQuestion,
    null,
  );
});
test("changed base context, stale catalog and unsupported answer subjects cannot reuse rule answers", async () => {
  const run = service();
  const q = await run({ ...request, bankAnswers, phase: "QUESTIONING" });
  const input = {
    ...request,
    bankAnswers,
    ruleAnswers: [
      {
        questionId: "confirm",
        version: "test-1",
        subject: { kind: "CHILD", id: "a" },
        state: "PROVIDED",
        value: "0",
      },
    ],
    catalogVersion: q.catalogVersion,
    contextKey: q.contextKey,
  };
  for (const patch of [
    { needs: [] },
    { catalogVersion: "old" },
    { contextKey: "0".repeat(64) },
    {
      ruleAnswers: [
        { ...input.ruleAnswers[0], subject: { kind: "PERSON", id: "a" } },
      ],
    },
    { ruleAnswers: [{ ...input.ruleAnswers[0], value: "9" }] },
  ])
    await assert.rejects(
      run({ ...input, ...patch }),
      "ruleAnswers" in patch
        ? /invalid-recommendation-request/
        : /recommendation-context-changed/,
    );
});
test("no published field uses provisional service and no synthetic fixture is exposed", async () => {
  let calls = 0;
  const provisional = createCategoryRecommendationService({
    loadPolicies: async () => [display("real")],
  });
  const run = createGuidedRecommendationService({
    now,
    loadCatalog: async () => ({
      catalog: { version: "empty", policies: [], questions: [] },
      policies: [],
      coverage: "AWAITING_REVIEW",
    }),
    recommendProvisional: async (input) => {
      calls++;
      return provisional(input);
    },
  });
  const q = await run({ ...request, phase: "QUESTIONING" });
  assert.equal(calls, 0);
  assert.equal(q.nextQuestion, null);
  const results = await run(request);
  assert.equal(calls, 1);
  assert.equal(results.method, "PROVISIONAL");
  assert.equal(results.policies[0].policy.id, "real");
  const hidden = service(educationFixture);
  assert.equal((await hidden({ ...request, bankAnswers })).policies.length, 0);
});
test("five-question boundary emits no cards until results are requested", async () => {
  const q = await service()({
    ...request,
    bankAnswers,
    phase: "QUESTIONING",
    questionCount: 5,
  });
  assert.equal(q.stopReason, "QUESTION_LIMIT");
  assert.deepEqual(q.policies, []);
});
test("expired or changed reviewed policies are explicitly marked for direct checking", async () => {
  const run = createGuidedRecommendationService({
    now,
    loadCatalog: async () => ({
      catalog: { version: "stale", policies: [], questions: [] },
      policies: [],
      coverage: "AWAITING_REVIEW",
      reviewedCategories: ["education"],
      withheldByCategory: { education: 1 },
    }),
    recommendProvisional: createCategoryRecommendationService({
      loadPolicies: async () => [display("stale-policy")],
    }),
  });
  const result = await run(request);
  assert.equal(result.method, "MIXED");
  assert.equal(result.policies.length, 1);
  assert.equal(result.policies[0].reviewStatus, "CHECK_REQUIRED");
  assert(result.policies[0].tags.includes("직접 확인 필요"));
  assert.equal(result.withheldPolicyCount, 1);
});
test("a prerequisite-only question can be answered and unlock its policy question", async () => {
  const c = catalog();
  const gate: QuestionDefinition = {
    ...c.questions[0],
    id: "gate",
    fact: { ...c.questions[0].fact, attribute: "test.gate" },
    prerequisites: [],
  };
  c.questions[0].prerequisites = [
    { questionId: "gate", equals: { kind: "BOOLEAN", value: true } },
  ];
  c.questions.push(gate);
  const run = service(c);
  const first = await run({ ...request, bankAnswers, phase: "QUESTIONING" });
  assert.equal(first.nextQuestion?.id, "gate");
  const next = await run({
    ...request,
    bankAnswers,
    phase: "QUESTIONING",
    catalogVersion: first.catalogVersion,
    contextKey: first.contextKey,
    ruleAnswers: [
      {
        questionId: "gate",
        version: "test-1",
        subject: { kind: "CHILD", id: "a" },
        state: "PROVIDED",
        value: "0",
      },
    ],
  });
  assert.equal(next.nextQuestion?.id, "confirm");
});
test("supplemental school answers cannot change the school behind a retained grade", async () => {
  const c = catalog();
  c.questions.push({
    ...c.questions[0],
    id: "school",
    fact: c.policies[0].rules[0].fact,
    options: [{ label: "고등학교", value: { kind: "CODE", value: "HIGH" } }],
  });
  const run = service(c);
  const base = [
    bankAnswers[0],
    { ...bankAnswers[1], value: "ELEMENTARY" },
    { questionId: "E03", subjectId: "a", state: "PROVIDED", value: "G4" },
  ];
  const first = await run({ ...request, bankAnswers: base });
  await assert.rejects(
    run({
      ...request,
      bankAnswers: base,
      catalogVersion: first.catalogVersion,
      contextKey: first.contextKey,
      ruleAnswers: [
        {
          questionId: "school",
          version: "test-1",
          subject: { kind: "CHILD", id: "a" },
          state: "PROVIDED",
          value: "0",
        },
      ],
    }),
    /invalid-recommendation-request/,
  );
  for (const state of ["DONT_KNOW", "SKIPPED"]) {
    const uncertain = [
      bankAnswers[0],
      { questionId: "E02", subjectId: "a", state },
    ];
    const first = await run({ ...request, bankAnswers: uncertain });
    await assert.rejects(
      run({
        ...request,
        bankAnswers: uncertain,
        catalogVersion: first.catalogVersion,
        contextKey: first.contextKey,
        ruleAnswers: [
          {
            questionId: "school",
            version: "test-1",
            subject: { kind: "CHILD", id: "a" },
            state: "PROVIDED",
            value: "0",
          },
        ],
      }),
      /invalid-recommendation-request/,
    );
  }
});
test("birth precision can narrow a year but cannot move it outside the declared year", async () => {
  const c = catalog();
  const fact = {
    attribute: "person.birthDate",
    basis: "CALENDAR_DATE",
    reference: "BIRTH",
    subject: "BENEFICIARY" as const,
  };
  c.policies[0].rules.push({
    ...c.policies[0].rules[0],
    id: "birth",
    fact,
    operator: "EQ",
    expected: "2014-03-01",
  });
  c.questions.push({
    ...c.questions[0],
    id: "birth",
    fact,
    options: [
      {
        label: "정확한 생일",
        value: {
          kind: "DATE_RANGE",
          earliest: "2014-03-01",
          latest: "2014-03-01",
        },
      },
      {
        label: "다른 해",
        value: {
          kind: "DATE_RANGE",
          earliest: "2015-03-01",
          latest: "2015-03-01",
        },
      },
    ],
  });
  const run = service(c);
  const first = await run({ ...request, bankAnswers });
  const input = {
    ...request,
    bankAnswers,
    catalogVersion: first.catalogVersion,
    contextKey: first.contextKey,
  };
  const a = {
    questionId: "birth",
    version: "test-1",
    subject: { kind: "CHILD", id: "a" },
    state: "PROVIDED",
    value: "0",
  };
  await run({ ...input, ruleAnswers: [a] });
  await assert.rejects(
    run({ ...input, ruleAnswers: [{ ...a, value: "1" }] }),
    /invalid-recommendation-request/,
  );
});
test("gestational precision preserves the upper exclusive bound and measurement unit", async () => {
  const c = catalog();
  const mapping = BANK_FACT_MAPPINGS.find((m) => m.questionId === "P03")!;
  const fact = {
    attribute: mapping.attribute,
    basis: mapping.basis,
    reference: mapping.reference,
    subject: "BENEFICIARY" as const,
  };
  c.policies[0].category = "pregnancy";
  c.policies[0].paths[0].subject = "EVENT";
  c.policies[0].rules[0].fact = fact;
  const number = (
    min: number,
    max: number,
    maxInclusive: boolean,
    unit = "GESTATIONAL_WEEKS",
  ) => ({
    kind: "NUMBER_RANGE" as const,
    min,
    max,
    minInclusive: true,
    maxInclusive,
    unit,
  });
  c.questions.push({
    ...c.questions[0],
    id: "weeks",
    fact,
    options: [
      { label: "30주", value: number(30, 30, true) },
      { label: "37주까지 포함", value: number(30, 37, true) },
      { label: "다른 단위", value: number(30, 30, true, "DAYS") },
      { label: "기존 구간 밖", value: number(27, 30, true) },
    ],
  });
  const run = service(c);
  const base = {
    ...request,
    category: "pregnancy",
    needs: [],
    childProfiles: [],
    bankAnswers: [
      {
        questionId: "P01",
        subjectId: "HOUSEHOLD",
        state: "PROVIDED",
        value: "SELF",
      },
      {
        questionId: "P02",
        subjectId: "SELF",
        state: "PROVIDED",
        value: "PREGNANT",
      },
      {
        questionId: "P03",
        subjectId: "SELF",
        state: "PROVIDED",
        value: "W28_TO_36",
      },
    ],
  };
  const first = await run(base);
  const input = {
    ...base,
    catalogVersion: first.catalogVersion,
    contextKey: first.contextKey,
  };
  const a = {
    questionId: "weeks",
    version: "test-1",
    subject: { kind: "EVENT", id: "pregnancy:SELF" },
    state: "PROVIDED",
    value: "0",
  };
  await run({ ...input, ruleAnswers: [a] });
  for (const value of ["1", "2", "3"])
    await assert.rejects(
      run({ ...input, ruleAnswers: [{ ...a, value }] }),
      /invalid-recommendation-request/,
    );
});

test("pending policies fill remaining slots without reviving rejected reviewed policies; promotion removes the pending tag", async () => {
  let c = catalog();
  const all = [
    display("test-education"),
    ...Array.from({ length: 25 }, (_, i) => display(`pending-${i}`)),
    { ...display("busan"), provider_name: "부산광역시 기장군" },
  ];
  const run = createGuidedRecommendationService({
    now,
    loadCatalog: async () => ({
      catalog: c,
      policies: c.policies.map((p) => display(p.id)),
      coverage: "READY",
    }),
    recommendProvisional: createCategoryRecommendationService({
      loadPolicies: async () => all,
    }),
  });
  const input = {
    ...request,
    bankAnswers,
    residence: {
      region: "서울특별시",
      district: "",
      basis: "REGISTERED_RESIDENCE",
      reference: "CURRENT",
    },
  };
  const q = await run({ ...input, phase: "QUESTIONING" });
  assert.deepEqual(q.policies, []);
  const result = await run(input);
  assert.equal(result.method, "MIXED");
  assert.equal(result.policies.length, 20);
  assert.equal(result.candidateCount, 26);
  assert.equal(result.policies[0].reviewStatus, "REVIEWED");
  assert.equal(
    result.policies.filter((p) => p.reviewStatus === "CHECK_REQUIRED").length,
    19,
  );
  assert.equal(new Set(result.policies.map((p) => p.policy.id)).size, 20);
  assert(!result.policies.some((p) => p.policy.id === "busan"));
  assert.deepEqual(
    result.top5,
    result.policies.slice(0, 5).map((p) => p.policy.id),
  );
  const denied = await run({
    ...input,
    catalogVersion: q.catalogVersion,
    contextKey: q.contextKey,
    ruleAnswers: [
      {
        questionId: "confirm",
        version: "test-1",
        subject: { kind: "CHILD", id: "a" },
        state: "PROVIDED",
        value: "1",
      },
    ],
  });
  assert(!denied.policies.some((p) => p.policy.id === "test-education"));
  assert.equal(denied.policies.length, 20);
  const promoted = structuredClone(c.policies[0]);
  promoted.id = "pending-0";
  c = { ...c, version: "promoted-test", policies: [...c.policies, promoted] };
  const after = await run(input);
  assert.equal(
    after.policies.filter((p) => p.policy.id === "pending-0").length,
    1,
  );
  assert.equal(
    after.policies.find((p) => p.policy.id === "pending-0")!.reviewStatus,
    "REVIEWED",
  );
  assert(
    !after.policies
      .find((p) => p.policy.id === "pending-0")!
      .tags.includes("직접 확인 필요"),
  );
});
