import bank from "../../../../docs/fixtures/policy-recommendation/category-question-bank-v1.json" with { type: "json" };
import { REGIONS } from "../public/types.ts";
import { validateValue } from "./facts.ts";
import type { FactRef, FactValue, QuestionDefinition } from "./types.ts";

export type TemplateCondition = {
  template: string;
  subject: "BENEFICIARY" | "HOUSEHOLD";
  params: Record<string, unknown>;
  evidence: { field: string; quote: string }[];
};
export type TemplateQuestion = Omit<
  QuestionDefinition,
  "id" | "version" | "fact" | "prerequisites"
>;
type NumberRange = Extract<FactValue, { kind: "NUMBER_RANGE" }>;
export type ConditionTemplateExpansion = {
  fact: FactRef;
  negate: boolean;
  /** The caller binds this question to exactly the returned fact. */
  question: TemplateQuestion | null;
} & (
  | { operator: "IN_SET"; expected: string[] }
  | { operator: "DATE_RANGE"; earliest: string; latest: string }
  | (Omit<NumberRange, "kind"> & { operator: "NUMBER_RANGE" })
);

function invalid(reason: string): never {
  throw new Error(`invalid-condition-template:${reason}`);
}
function object(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid("object");
  if (
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    invalid("object-prototype");
  if (
    Reflect.ownKeys(value).some(
      (key) => typeof key !== "string" || !allowed.includes(key),
    )
  )
    invalid("unexpected-parameter");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value !== value.trim())
    invalid("text");
  return value;
}
function segment(value: unknown): string {
  const s = text(value);
  if (
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(s) ||
    ["constructor", "prototype"].includes(s)
  )
    invalid("namespace-segment");
  return s;
}
function attributePath(value: unknown): string {
  return text(value).split(".").map(segment).join(".");
}
function values(input: unknown, allowed: string[]): string[] {
  if (!Array.isArray(input) || !input.length) invalid("empty-values");
  const codes = input.map(text);
  if (new Set(codes).size !== codes.length) invalid("duplicate-values");
  if (codes.some((code) => !allowed.includes(code))) invalid("unknown-code");
  return codes;
}
function requireSubject(
  actual: TemplateCondition["subject"],
  expected: TemplateCondition["subject"],
) {
  if (actual !== expected) invalid("subject-mismatch");
}
const optionsAsCodes = (options: { value: string; label: string }[]) =>
  options.map((option) => ({
    label: option.label,
    value: { kind: "CODE" as const, value: option.value },
  }));
const rangeBounds = (range: NumberRange): Omit<NumberRange, "kind"> => ({
  min: range.min,
  max: range.max,
  minInclusive: range.minInclusive,
  maxInclusive: range.maxInclusive,
  unit: range.unit,
});

function bankCode(
  id: string,
  expected: unknown,
  subject: TemplateCondition["subject"],
): ConditionTemplateExpansion {
  const q = bank.questions.find((q) => q.id === id);
  if (
    !q?.fact ||
    q.answerType !== "SINGLE_CHOICE" ||
    ["P03", "P04"].includes(id)
  )
    invalid("bank-question-not-code-fact");
  if (q.fact.subject === "HOUSEHOLD") requireSubject(subject, "HOUSEHOLD");
  else if (
    [
      "EACH_CHILD",
      "SELECTED_PERSON",
      "PREGNANCY_EVENT",
      "BIRTH_EVENT",
    ].includes(q.fact.subject)
  )
    requireSubject(subject, "BENEFICIARY");
  else if (q.fact.subject !== "SELECTED_SCOPE") invalid("bank-subject");
  return {
    fact: {
      attribute: q.fact.attribute,
      basis: q.fact.basis,
      reference: q.fact.reference,
      subject,
    },
    operator: "IN_SET",
    expected: values(
      expected,
      q.options.map((o) => o.value),
    ),
    negate: false,
    question: {
      prompt: q.prompt,
      whyAsked: q.notes || "정책의 해당 조건을 확인합니다.",
      burden: 1,
      options: optionsAsCodes(q.options),
    },
  };
}

function rangeQuestion(
  prompt: string,
  reference: string,
  range: NumberRange,
): TemplateQuestion | null {
  if (/UNCONFIRMED/i.test(reference)) return null;
  const unitLabel = (
    {
      AGE_YEARS: "세",
      DISTANCE_KM: "km",
      RESIDENCE_MONTHS: "개월",
      BIRTH_ORDER: "번째",
      PERSONS: "명",
      KRW: "원",
    } as Record<string, string>
  )[range.unit];
  const insideLabel = [
    range.min !== null
      ? `${range.min}${unitLabel} ${range.minInclusive ? "이상" : "초과"}`
      : "",
    range.max !== null
      ? `${range.max}${unitLabel} ${range.maxInclusive ? "이하" : "미만"}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const options: TemplateQuestion["options"] = [
    { label: insideLabel, value: structuredClone(range) },
  ];
  if (range.min !== null)
    options.push({
      label: range.minInclusive
        ? `${range.min}${unitLabel} 미만`
        : `${range.min}${unitLabel} 이하`,
      value: {
        kind: "NUMBER_RANGE",
        min: null,
        max: range.min,
        minInclusive: false,
        maxInclusive: !range.minInclusive,
        unit: range.unit,
      },
    });
  if (range.max !== null)
    options.push({
      label: range.maxInclusive
        ? `${range.max}${unitLabel} 초과`
        : `${range.max}${unitLabel} 이상`,
      value: {
        kind: "NUMBER_RANGE",
        min: range.max,
        max: null,
        minInclusive: !range.maxInclusive,
        maxInclusive: false,
        unit: range.unit,
      },
    });
  return {
    prompt,
    whyAsked: `${reference} 기준의 명시된 범위를 비교합니다. 다른 기준 시점의 값으로 대신하지 않습니다.`,
    burden: 2,
    options,
  };
}
function numberRange(params: Record<string, unknown>): NumberRange {
  if (
    (params.min !== null &&
      (typeof params.min !== "number" || !Number.isFinite(params.min))) ||
    (params.max !== null &&
      (typeof params.max !== "number" || !Number.isFinite(params.max))) ||
    (params.min === null && params.max === null) ||
    typeof params.minInclusive !== "boolean" ||
    typeof params.maxInclusive !== "boolean"
  )
    invalid("number-range");
  const range: NumberRange = {
    kind: "NUMBER_RANGE",
    min: params.min as number | null,
    max: params.max as number | null,
    minInclusive: params.minInclusive as boolean,
    maxInclusive: params.maxInclusive as boolean,
    unit: text(params.unit),
  };
  try {
    validateValue(range);
  } catch {
    invalid("empty-or-reversed-range");
  }
  return range;
}

/** Expands explicit parameters only; source quote validation and rule review belong to the compiler. */
export function expandConditionTemplate(
  input: TemplateCondition,
  namespace: string,
): ConditionTemplateExpansion {
  const condition = object(input, [
    "template",
    "subject",
    "params",
    "evidence",
  ]);
  const template = text(condition.template);
  if (condition.subject !== "BENEFICIARY" && condition.subject !== "HOUSEHOLD")
    invalid("subject");
  const subject = condition.subject;
  const scope = segment(namespace);
  if (!Array.isArray(condition.evidence)) invalid("evidence");
  // Shape only: an empty list is not interpreted as permission to use an unsupported rule.
  for (const item of condition.evidence) {
    const evidence = object(item, ["field", "quote"]);
    text(evidence.field);
    if (typeof evidence.quote !== "string" || !evidence.quote.trim())
      invalid("evidence-quote");
  }
  switch (template) {
    case "BIRTH_DATE_RANGE": {
      const params = object(condition.params, ["earliest", "latest"]);
      requireSubject(subject, "BENEFICIARY");
      const earliest = text(params.earliest);
      const latest = text(params.latest);
      try {
        validateValue({ kind: "DATE_RANGE", earliest, latest });
      } catch {
        invalid("date-range");
      }
      return {
        fact: {
          attribute: "person.birthDate",
          basis: "CALENDAR_DATE",
          reference: "BIRTH",
          subject,
        },
        operator: "DATE_RANGE",
        earliest,
        latest,
        negate: false,
        question: null,
      };
    }
    case "SCHOOL_STAGE":
    case "SCHOOL_STATUS":
    case "SCHOOL_GRADE": {
      const params = object(condition.params, ["values"]);
      requireSubject(subject, "BENEFICIARY");
      const id = {
        SCHOOL_STAGE: "E02",
        SCHOOL_STATUS: "E01",
        SCHOOL_GRADE: "E03",
      }[template];
      return bankCode(id, params.values, subject);
    }
    case "SCHOOL_REGION": {
      const params = object(condition.params, ["values", "exclude"]);
      requireSubject(subject, "BENEFICIARY");
      if (params.exclude !== undefined && typeof params.exclude !== "boolean")
        invalid("exclude");
      const q = bank.questions.find((q) => q.id === "E04")!;
      if (!q.fact) invalid("bank-question-fact");
      return {
        fact: {
          attribute: `${q.fact.attribute}.region`,
          basis: q.fact.basis,
          reference: q.fact.reference,
          subject,
        },
        operator: "IN_SET",
        expected: values(params.values, REGIONS),
        negate: params.exclude === true,
        question: {
          prompt: "앞서 답한 학교·교육기관은 어느 시·도에 있나요?",
          whyAsked: q.notes,
          burden: 1,
          options: optionsAsCodes(
            REGIONS.map((region) => ({ value: region, label: region })),
          ),
        },
      };
    }
    case "BANK_CODE": {
      const params = object(condition.params, ["questionId", "values"]);
      const id = text(params.questionId);
      const expanded = bankCode(id, params.values, subject);
      const q = bank.questions.find((q) => q.id === id)!;
      if (q.when.length || ("optionConditions" in q && q.optionConditions))
        expanded.question = null;
      return expanded;
    }
    case "BANK_NUMBER_RANGE": {
      const params = object(condition.params, [
        "questionId",
        "min",
        "max",
        "minInclusive",
        "maxInclusive",
      ]);
      const id = text(params.questionId);
      if (id !== "P03" && id !== "P04")
        invalid("bank-question-not-number-fact");
      requireSubject(subject, "BENEFICIARY");
      const q = bank.questions.find((q) => q.id === id)!;
      if (!q.fact) invalid("bank-question-fact");
      const range = numberRange({
        ...params,
        unit:
          id === "P03" ? "GESTATIONAL_WEEKS" : "CALENDAR_MONTHS_SINCE_BIRTH",
      });
      if (
        (range.min !== null && range.min < 0) ||
        (range.max !== null && range.max < 0)
      )
        invalid("negative-event-duration");
      return {
        fact: {
          attribute: q.fact.attribute,
          basis: q.fact.basis,
          reference: q.fact.reference,
          subject,
        },
        operator: "NUMBER_RANGE",
        ...rangeBounds(range),
        negate: false,
        question: null,
      };
    }
    case "RECOGNIZED_INCOME_RATIO": {
      const params = object(condition.params, ["max", "reference"]);
      requireSubject(subject, "HOUSEHOLD");
      if (
        typeof params.max !== "number" ||
        !Number.isFinite(params.max) ||
        params.max < 0
      )
        invalid("income-max");
      const reference = text(params.reference);
      const range: NumberRange = {
        kind: "NUMBER_RANGE",
        min: 0,
        max: params.max,
        minInclusive: true,
        maxInclusive: true,
        unit: "PERCENT_OF_MEDIAN_INCOME",
      };
      const question: TemplateQuestion | null = /UNCONFIRMED/i.test(reference)
        ? null
        : {
            prompt: `${reference} 기준 가구 소득인정액이 기준 중위소득의 ${params.max}% 이하인가요?`,
            whyAsked:
              "같은 산정 기준과 시점의 소득인정액 비율을 비교합니다. 월급이나 다른 연도의 값으로 대신하지 않습니다.",
            burden: 4,
            options: [
              { label: `${params.max}% 이하`, value: structuredClone(range) },
              {
                label: `${params.max}% 초과`,
                value: {
                  kind: "NUMBER_RANGE",
                  min: params.max,
                  max: null,
                  minInclusive: false,
                  maxInclusive: false,
                  unit: range.unit,
                },
              },
            ],
          };
      return {
        fact: {
          attribute: "household.incomeRecognizedMedianPercent",
          basis: "RECOGNIZED_INCOME_RATIO",
          reference,
          subject,
        },
        operator: "NUMBER_RANGE",
        ...rangeBounds(range),
        negate: false,
        question,
      };
    }
    case "DECLARED_PROGRAM_STATUS": {
      const params = object(condition.params, [
        "attribute",
        "values",
        "basis",
        "reference",
        "prompt",
        "options",
      ]);
      if (!Array.isArray(params.options) || !params.options.length)
        invalid("options");
      const options = params.options.map((input) => {
        const option = object(input, ["value", "label"]);
        return { value: text(option.value), label: text(option.label) };
      });
      const allowed = options.map((option) => option.value);
      if (new Set(allowed).size !== allowed.length)
        invalid("duplicate-options");
      const reference = text(params.reference);
      const prompt = text(params.prompt);
      return {
        fact: {
          attribute: `program.${scope}.${attributePath(params.attribute)}`,
          basis: text(params.basis),
          reference,
          subject,
        },
        operator: "IN_SET",
        expected: values(params.values, allowed),
        negate: false,
        question: /UNCONFIRMED/i.test(reference)
          ? null
          : {
              prompt,
              whyAsked: "이 정책에 명시된 프로그램 상태를 확인합니다.",
              burden: 1,
              options: optionsAsCodes(options),
            },
      };
    }
    case "DECLARED_NUMBER_RANGE": {
      const params = object(condition.params, [
        "attribute",
        "min",
        "max",
        "minInclusive",
        "maxInclusive",
        "unit",
        "basis",
        "reference",
        "prompt",
      ]);
      const range = numberRange(params);
      if (
        ![
          "AGE_YEARS",
          "DISTANCE_KM",
          "RESIDENCE_MONTHS",
          "BIRTH_ORDER",
          "PERSONS",
          "KRW",
        ].includes(range.unit)
      )
        invalid("unit");
      const reference = text(params.reference);
      const prompt = text(params.prompt);
      return {
        fact: {
          attribute: `program.${scope}.${attributePath(params.attribute)}`,
          basis: text(params.basis),
          reference,
          subject,
        },
        operator: "NUMBER_RANGE",
        ...rangeBounds(range),
        negate: false,
        question: rangeQuestion(prompt, reference, range),
      };
    }
    default:
      return invalid("unknown-template");
  }
}
