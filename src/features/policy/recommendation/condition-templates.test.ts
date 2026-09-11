import assert from "node:assert/strict";
import test from "node:test";
import {
  expandConditionTemplate,
  type ConditionTemplateExpansion,
  type TemplateCondition,
} from "./condition-templates.ts";
import { evaluateExpression, evaluatePredicate } from "./eligibility.ts";
import { bindFact, validateValue } from "./facts.ts";
import { projectBankFacts } from "./bank-facts.ts";
import type { Answer, Context, FactValue, Predicate } from "./types.ts";

const condition = (
  template: string,
  params: Record<string, unknown>,
  subject: TemplateCondition["subject"] = "BENEFICIARY",
): TemplateCondition => ({
  template,
  params,
  subject,
  evidence: [
    {
      field: "target_text",
      quote: "Synthetic explicit condition, not policy approval.",
    },
  ],
});
const context: Context = {
  answers: [],
  beneficiary: { kind: "CHILD", id: "child-1" },
  household: { kind: "HOUSEHOLD", id: "HOUSEHOLD" },
  sourceVersion: "test",
  mode: "FIXTURE",
};
function predicate(expanded: ConditionTemplateExpansion): Predicate {
  const common = {
    id: "test-rule",
    fact: expanded.fact,
    label: "test condition",
    evidenceRefs: ["fixture:explicit"],
    sourceVersion: "test",
    review: "FIXTURE" as const,
  };
  if (expanded.operator === "DATE_RANGE")
    return {
      ...common,
      operator: "DATE_RANGE",
      earliest: expanded.earliest,
      latest: expanded.latest,
    };
  return expanded.operator === "IN_SET"
    ? { ...common, operator: "IN_SET", expected: expanded.expected }
    : {
        ...common,
        operator: "NUMBER_RANGE",
        min: expanded.min,
        max: expanded.max,
        minInclusive: expanded.minInclusive,
        maxInclusive: expanded.maxInclusive,
        unit: expanded.unit,
      };
}
function answer(
  expanded: ConditionTemplateExpansion,
  value: FactValue,
): Answer {
  return {
    key: bindFact(expanded.fact, context),
    recordedAt: "2026-09-11T00:00:00Z",
    state: "PROVIDED",
    source: "USER_DECLARED",
    value,
  };
}
function valueResult(expanded: ConditionTemplateExpansion, value: FactValue) {
  return evaluatePredicate(predicate(expanded), {
    ...context,
    answers: [answer(expanded, value)],
  }).value;
}

test("birth-date limits compare actual bank birth-year intervals without inventing a birthday", () => {
  const expanded = expandConditionTemplate(
    condition("BIRTH_DATE_RANGE", {
      earliest: "2008-01-01",
      latest: "2019-12-31",
    }),
    "E06",
  );
  assert.equal(expanded.question, null);
  for (const [birthYear, expected] of [
    [2007, "FALSE"],
    [2008, "TRUE"],
    [2019, "TRUE"],
    [2020, "FALSE"],
  ] as const) {
    const projected = projectBankFacts(
      {
        category: "education",
        needs: [],
        childProfiles: [{ id: "child-1", sex: null, birthYear }],
      },
      [],
      "2026-09-11T00:00:00Z",
    );
    assert.equal(
      evaluatePredicate(predicate(expanded), {
        ...context,
        answers: projected.answers,
      }).value,
      expected,
    );
    if (birthYear === 2008) {
      const partialYear = expandConditionTemplate(
        condition("BIRTH_DATE_RANGE", {
          earliest: "2008-02-29",
          latest: "2019-12-31",
        }),
        "E06",
      );
      assert.equal(
        evaluatePredicate(predicate(partialYear), {
          ...context,
          answers: projected.answers,
        }).value,
        "UNKNOWN",
        "a year-only profile cannot decide a within-year boundary",
      );
    }
  }
});

test("birth-date templates reject nonexistent dates, reversed limits and household subjects", () => {
  for (const params of [
    { earliest: "2009-02-29", latest: "2019-12-31" },
    { earliest: "2008-01-01", latest: "2019-04-31" },
    { earliest: "2008-1-1", latest: "2019-12-31" },
    { earliest: "2020-01-01", latest: "2019-12-31" },
  ])
    assert.throws(
      () =>
        expandConditionTemplate(condition("BIRTH_DATE_RANGE", params), "E06"),
      /invalid-condition-template:date-range/,
    );
  assert.throws(
    () =>
      expandConditionTemplate(
        condition(
          "BIRTH_DATE_RANGE",
          {
            earliest: "2008-01-01",
            latest: "2019-12-31",
          },
          "HOUSEHOLD",
        ),
        "E06",
      ),
    /subject-mismatch/,
  );
});

test("school status preserves ENTERING and school templates use the same bank facts and options", () => {
  for (const [template, questionId, code] of [
    ["SCHOOL_STATUS", "E01", "ENTERING"],
    ["SCHOOL_STAGE", "E02", "MIDDLE"],
    ["SCHOOL_GRADE", "E03", "G1"],
  ]) {
    const expanded = expandConditionTemplate(
      condition(template, { values: [code] }),
      "E03",
    );
    const bank = expandConditionTemplate(
      condition("BANK_CODE", { questionId, values: [code] }),
      "E04",
    );
    assert.deepEqual(
      { ...expanded, question: null },
      { ...bank, question: null },
    );
    assert.ok(expanded.question);
    if (questionId === "E01")
      assert.deepEqual(expanded.question, bank.question);
    else
      assert.equal(
        bank.question,
        null,
        "generic bank templates preserve conditional intake gating",
      );
    const projected = projectBankFacts(
      {
        category: "education",
        needs: [],
        childProfiles: [{ id: "child-1", sex: null, birthYear: null }],
      },
      [
        {
          questionId: "E01",
          subjectId: "child-1",
          state: "PROVIDED",
          value: "ENTERING",
        },
        {
          questionId: "E02",
          subjectId: "child-1",
          state: "PROVIDED",
          value: "MIDDLE",
        },
        {
          questionId: "E03",
          subjectId: "child-1",
          state: "PROVIDED",
          value: "G1",
        },
      ],
      "2026-09-11T00:00:00Z",
    );
    assert.equal(
      evaluatePredicate(predicate(expanded), {
        ...context,
        answers: projected.answers,
      }).value,
      "TRUE",
    );
    assert.ok(
      expanded.question?.options.some(
        (option) => option.value.kind === "CODE" && option.value.value === code,
      ),
    );
  }
  assert.throws(
    () =>
      expandConditionTemplate(
        condition("SCHOOL_STATUS", { values: ["ENTERED"] }),
        "E03",
      ),
    /unknown-code/,
  );
});

test("school region exclusion negates the exact school-region fact and never borrows household residence", () => {
  const expanded = expandConditionTemplate(
    condition("SCHOOL_REGION", { values: ["서울특별시"], exclude: true }),
    "E04",
  );
  assert.equal(expanded.negate, true);
  const rule = predicate(expanded);
  const projected = projectBankFacts(
    {
      category: "education",
      needs: [],
      childProfiles: [{ id: "child-1", sex: null, birthYear: null }],
      residence: {
        region: "서울특별시",
        district: "관악구",
        basis: "REGISTERED_RESIDENCE",
        reference: "CURRENT",
      },
    },
    [
      {
        questionId: "E01",
        subjectId: "child-1",
        state: "PROVIDED",
        value: "ENROLLED",
      },
      {
        questionId: "E04",
        subjectId: "child-1",
        state: "PROVIDED",
        value: "부산광역시|기장군",
      },
    ],
    "2026-09-11T00:00:00Z",
  );
  assert.equal(
    evaluateExpression(
      { kind: "NOT", child: { kind: "PREDICATE", ruleId: rule.id } },
      [rule],
      { ...context, answers: projected.answers },
    ).value,
    "TRUE",
  );
  assert.equal(
    evaluatePredicate(rule, {
      ...context,
      answers: projected.answers.filter(
        (a) => a.key.subject.kind === "HOUSEHOLD",
      ),
    }).value,
    "UNKNOWN",
  );
});

test("recognized income keeps the explicit period, inclusive threshold and insufficient precision unknown", () => {
  const expanded = expandConditionTemplate(
    condition(
      "RECOGNIZED_INCOME_RATIO",
      { max: 50, reference: "2026_POLICY_HOUSEHOLD" },
      "HOUSEHOLD",
    ),
    "E01",
  );
  assert.equal(expanded.fact.reference, "2026_POLICY_HOUSEHOLD");
  assert.equal(expanded.fact.basis, "RECOGNIZED_INCOME_RATIO");
  assert.equal(expanded.fact.subject, "HOUSEHOLD");
  assert.equal(expanded.question?.options.length, 2);
  for (const option of expanded.question!.options) validateValue(option.value);
  assert.deepEqual(
    expanded.question!.options.map((option) =>
      valueResult(expanded, option.value),
    ),
    ["TRUE", "FALSE"],
  );
  const range = (min: number, max: number): FactValue => ({
    kind: "NUMBER_RANGE",
    min,
    max,
    minInclusive: true,
    maxInclusive: true,
    unit: "PERCENT_OF_MEDIAN_INCOME",
  });
  assert.equal(valueResult(expanded, range(50, 50)), "TRUE");
  assert.equal(valueResult(expanded, range(0, 80)), "UNKNOWN");
  const wrongPeriod = answer(expanded, range(0, 50));
  wrongPeriod.key.reference = "2025_POLICY_HOUSEHOLD";
  assert.equal(
    evaluatePredicate(predicate(expanded), {
      ...context,
      answers: [wrongPeriod],
    }).value,
    "UNKNOWN",
  );
  const unconfirmed = expandConditionTemplate(
    condition(
      "RECOGNIZED_INCOME_RATIO",
      { max: 50, reference: "UNCONFIRMED_INCOME_YEAR" },
      "HOUSEHOLD",
    ),
    "E01",
  );
  assert.equal(unconfirmed.question, null);
  assert.equal(unconfirmed.fact.reference, "UNCONFIRMED_INCOME_YEAR");
});

test("declared program facts remain isolated by policy namespace and subject", () => {
  const input = condition("DECLARED_PROGRAM_STATUS", {
    attribute: "recognizedStatus",
    values: ["YES"],
    basis: "EXPLICIT_PROGRAM_RECOGNITION",
    reference: "2026",
    prompt: "이 사업의 명시된 인정을 받았나요?",
    options: [
      { value: "YES", label: "예" },
      { value: "NO", label: "아니요" },
    ],
  });
  const a = expandConditionTemplate(input, "policy-a"),
    b = expandConditionTemplate(input, "policy-b");
  assert.equal(a.fact.attribute, "program.policy-a.recognizedStatus");
  const provided = answer(a, { kind: "CODE", value: "YES" });
  assert.equal(
    evaluatePredicate(predicate(a), { ...context, answers: [provided] }).value,
    "TRUE",
  );
  assert.equal(
    evaluatePredicate(predicate(b), { ...context, answers: [provided] }).value,
    "UNKNOWN",
  );
  assert.equal(
    evaluatePredicate(predicate(a), {
      ...context,
      beneficiary: { kind: "CHILD", id: "child-2" },
      answers: [provided],
    }).value,
    "UNKNOWN",
  );
  const household = expandConditionTemplate(
    { ...input, subject: "HOUSEHOLD" },
    "policy-a",
  );
  assert.equal(
    evaluatePredicate(predicate(household), { ...context, answers: [provided] })
      .value,
    "UNKNOWN",
  );
  assert.equal("review" in a, false);
  assert.equal("release" in a, false);
});

test("dotted declared attributes remain within a policy namespace and unconfirmed program periods suppress questions", () => {
  const input = condition("DECLARED_PROGRAM_STATUS", {
    attribute: "education.archived.e01.listedInstitution",
    values: ["YES"],
    basis: "DECLARED_PROGRAM_STATUS",
    reference: "POLICY_PERIOD_UNCONFIRMED",
    prompt: "원문에 명시된 기관인가요?",
    options: [
      { value: "YES", label: "예" },
      { value: "NO", label: "아니요" },
    ],
  });
  const expanded = expandConditionTemplate(input, "policy-a");
  assert.equal(
    expanded.fact.attribute,
    "program.policy-a.education.archived.e01.listedInstitution",
  );
  assert.equal(expanded.question, null);
  for (const attribute of [
    "education..status",
    ".status",
    "status.",
    "education.__proto__.status",
    "education.constructor.status",
  ])
    assert.throws(
      () =>
        expandConditionTemplate(
          { ...input, params: { ...input.params, attribute } },
          "policy-a",
        ),
      /invalid-condition-template/,
    );
  assert.throws(
    () =>
      expandConditionTemplate(
        { ...input, params: { ...input.params, prompt: "" } },
        "policy-a",
      ),
    /invalid-condition-template/,
  );
});

test("declared numeric ranges generate disjoint exhaustive intervals without assuming a zero lower bound", () => {
  for (const [min, max, minInclusive, maxInclusive] of [
    [-5, 10, false, true],
    [null, 10, false, false],
    [5, null, true, false],
    [3, 3, true, true],
  ] as const) {
    const expanded = expandConditionTemplate(
      condition("DECLARED_NUMBER_RANGE", {
        attribute: "declaredValue",
        min,
        max,
        minInclusive,
        maxInclusive,
        unit: "KRW",
        basis: "EXPLICIT_TEST_BASIS",
        reference: "2026",
        prompt: "명시한 구간에 해당하나요?",
      }),
      "range-policy",
    );
    const options = expanded.question!.options;
    for (const option of options) validateValue(option.value);
    assert.equal(valueResult(expanded, options[0].value), "TRUE");
    assert.ok(
      options
        .slice(1)
        .every((option) => valueResult(expanded, option.value) === "FALSE"),
    );
    for (const x of [-100, -5, 0, 3, 5, 10, 100]) {
      const contained = options.filter((option) => {
        const r = option.value;
        return (
          r.kind === "NUMBER_RANGE" &&
          (r.min === null || x > r.min || (x === r.min && r.minInclusive)) &&
          (r.max === null || x < r.max || (x === r.max && r.maxInclusive))
        );
      });
      assert.equal(contained.length, 1, `exactly one answer region for ${x}`);
    }
  }
  const unconfirmed = expandConditionTemplate(
    condition("DECLARED_NUMBER_RANGE", {
      attribute: "age",
      min: 3,
      max: 8,
      minInclusive: true,
      maxInclusive: true,
      unit: "AGE_YEARS",
      basis: "DECLARED_REFERENCE",
      reference: "UNCONFIRMED",
      prompt: "해당 기준일 연령인가요?",
    }),
    "range-policy",
  );
  assert.equal(unconfirmed.question, null);
});

test("bank templates reject scope selectors and non-code projections and enforce subject meaning", () => {
  for (const questionId of ["P01", "H01", "P03", "P04", "E04", "UNKNOWN"])
    assert.throws(
      () =>
        expandConditionTemplate(
          condition("BANK_CODE", { questionId, values: ["OTHER"] }),
          "policy",
        ),
      /bank-question-not-code-fact/,
    );
  assert.throws(
    () =>
      expandConditionTemplate(
        condition("BANK_CODE", { questionId: "L01", values: ["MONTHLY_RENT"] }),
        "policy",
      ),
    /subject-mismatch/,
  );
  assert.throws(
    () =>
      expandConditionTemplate(
        condition("SCHOOL_STAGE", { values: ["HIGH"] }, "HOUSEHOLD"),
        "policy",
      ),
    /subject-mismatch/,
  );
  const housing = expandConditionTemplate(
    condition(
      "BANK_CODE",
      { questionId: "L01", values: ["MONTHLY_RENT"] },
      "HOUSEHOLD",
    ),
    "policy",
  );
  const projected = projectBankFacts(
    { category: "housing", needs: ["housing-costs"], childProfiles: [] },
    [
      {
        questionId: "L01",
        subjectId: "HOUSEHOLD",
        state: "PROVIDED",
        value: "MONTHLY_RENT",
      },
    ],
    "2026-09-11T00:00:00Z",
  );
  assert.equal(
    evaluatePredicate(predicate(housing), {
      ...context,
      answers: projected.answers,
    }).value,
    "TRUE",
  );
});

test("malformed parameters, unsupported codes and unsafe ranges fail before expansion", () => {
  const bad: TemplateCondition[] = [
    condition("UNKNOWN", {}),
    condition("SCHOOL_STAGE", { values: [] }),
    condition("SCHOOL_STAGE", { values: ["HIGH", "HIGH"] }),
    condition("SCHOOL_STAGE", { values: ["HIGH"], extra: true }),
    condition("SCHOOL_STAGE", { values: [" HIGH"] }),
    condition("SCHOOL_REGION", { values: ["SEOUL"] }),
    condition("SCHOOL_REGION", { values: ["서울특별시"], exclude: "true" }),
    ...[NaN, Infinity, -1, "50"].map((max) =>
      condition(
        "RECOGNIZED_INCOME_RATIO",
        { max, reference: "2026" },
        "HOUSEHOLD",
      ),
    ),
    ...[
      { min: null, max: null },
      { min: 10, max: 5 },
      { min: NaN, max: 5 },
      { min: 5, max: 5, minInclusive: false },
      { unit: "ARBITRARY" },
    ].map((overrides) =>
      condition("DECLARED_NUMBER_RANGE", {
        attribute: "value",
        min: 0,
        max: 5,
        minInclusive: true,
        maxInclusive: true,
        unit: "KRW",
        basis: "DECLARED",
        reference: "2026",
        prompt: "범위인가요?",
        ...overrides,
      }),
    ),
  ];
  for (const input of bad)
    assert.throws(
      () => expandConditionTemplate(input, "policy"),
      /invalid-condition-template/,
    );
  const valid = condition("SCHOOL_STAGE", { values: ["HIGH"] });
  for (const namespace of ["", "policy.other", "../policy", " policy"])
    assert.throws(
      () => expandConditionTemplate(valid, namespace),
      /invalid-condition-template/,
    );
  assert.throws(
    () =>
      expandConditionTemplate(
        { ...valid, params: Object.create({ values: ["HIGH"] }) },
        "policy",
      ),
    /object-prototype/,
  );
  const program = {
    attribute: "status",
    values: ["YES"],
    basis: "TEST",
    reference: "2026",
    prompt: "상태인가요?",
    options: [{ value: "NO", label: "아니요" }],
  };
  assert.throws(
    () =>
      expandConditionTemplate(
        condition("DECLARED_PROGRAM_STATUS", program),
        "policy",
      ),
    /unknown-code/,
  );
  assert.throws(
    () =>
      expandConditionTemplate(
        condition("DECLARED_PROGRAM_STATUS", {
          ...program,
          options: [
            { value: "YES", label: "예" },
            { value: "YES", label: "다른 표현" },
          ],
        }),
        "policy",
      ),
    /duplicate-options/,
  );
});

test("bank event ranges reuse active event facts and preserve uncertainty and person isolation", () => {
  const params = {
    questionId: "P03",
    min: 12,
    max: 20,
    minInclusive: true,
    maxInclusive: true,
  };
  const expanded = expandConditionTemplate(
    condition("BANK_NUMBER_RANGE", params),
    "pregnancy-rule",
  );
  assert.equal(expanded.question, null);
  const projected = projectBankFacts(
    { category: "pregnancy", needs: [], childProfiles: [] },
    [
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
        value: "W12_TO_27",
      },
      {
        questionId: "P04",
        subjectId: "SELF",
        state: "PROVIDED",
        value: "UNDER_1_MONTH",
      },
    ],
    "2026-09-11T00:00:00Z",
  );
  const eventContext: Context = {
    ...context,
    answers: projected.answers,
    beneficiary: { kind: "EVENT", id: "pregnancy:SELF" },
  };
  assert.equal(
    evaluatePredicate(predicate(expanded), eventContext).value,
    "UNKNOWN",
  );
  const full = expandConditionTemplate(
    condition("BANK_NUMBER_RANGE", { ...params, max: 28, maxInclusive: false }),
    "pregnancy-rule",
  );
  assert.equal(evaluatePredicate(predicate(full), eventContext).value, "TRUE");
  assert.equal(
    evaluatePredicate(predicate(full), {
      ...eventContext,
      beneficiary: { kind: "PERSON", id: "SELF" },
    }).value,
    "UNKNOWN",
  );
  assert.equal(
    evaluatePredicate(predicate(full), {
      ...eventContext,
      beneficiary: { kind: "EVENT", id: "pregnancy:PARTNER" },
    }).value,
    "UNKNOWN",
  );
  const birth = expandConditionTemplate(
    condition("BANK_NUMBER_RANGE", {
      ...params,
      questionId: "P04",
      min: 0,
      max: 1,
      maxInclusive: false,
    }),
    "birth-rule",
  );
  assert.equal(
    evaluatePredicate(predicate(birth), {
      ...eventContext,
      beneficiary: { kind: "EVENT", id: "birth:SELF" },
    }).value,
    "UNKNOWN",
  );
  assert(
    !projected.answers.some((a) => a.key.attribute === "birth.elapsedWindow"),
  );
  for (const patch of [
    { questionId: "P02" },
    { min: NaN },
    { max: Infinity },
    { min: 21 },
    { min: -1 },
    { min: null, max: null },
    { min: 12, max: 12, minInclusive: false },
    { unit: "AGE_YEARS" },
  ])
    assert.throws(() =>
      expandConditionTemplate(
        condition("BANK_NUMBER_RANGE", { ...params, ...patch }),
        "pregnancy-rule",
      ),
    );
});

test("conditional BANK_CODE questions cannot bypass intake prerequisites while school aliases keep their existing questions", () => {
  for (const [questionId, values, subject] of [
    ["B03", ["HOME"], "BENEFICIARY"],
    ["H03", ["HEALTH_INSURANCE"], "BENEFICIARY"],
    ["L02", ["SELF"], "HOUSEHOLD"],
  ] as const)
    assert.equal(
      expandConditionTemplate(
        condition("BANK_CODE", { questionId, values: [...values] }, subject),
        "rule",
      ).question,
      null,
    );
  assert.ok(
    expandConditionTemplate(
      condition("SCHOOL_STAGE", { values: ["HIGH"] }),
      "rule",
    ).question,
  );
});
