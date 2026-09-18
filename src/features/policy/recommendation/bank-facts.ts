import bank from "../../../../docs/fixtures/policy-recommendation/category-question-bank-v1.json" with { type: "json" };
import {
  activeBankAnswers,
  type BankAnswer,
  type BankContext,
} from "./category-bank.ts";
import type { Answer, FactKey, FactValue, Subject } from "./types.ts";

export type BankFactMapping = {
  questionId: string;
  attribute: string;
  basis: string;
  reference: string;
  subject: string;
  uses: string[];
};
/** Shared semantic registry: raw UI codes are never silently renamed to a policy rule. */
export const BANK_FACT_MAPPINGS: BankFactMapping[] = bank.questions.flatMap(
  (q) => (q.fact ? [{ questionId: q.id, ...q.fact, uses: q.uses }] : []),
);
const range = (min: number, max: number | null, unit: string): FactValue => ({
  kind: "NUMBER_RANGE",
  min,
  max,
  minInclusive: true,
  maxInclusive: false,
  unit,
});
function valueFor(id: string, value: string): FactValue {
  if (id === "P03") {
    const bounds: Record<string, [number, number | null]> = {
      BEFORE_12: [0, 12],
      W12_TO_27: [12, 28],
      W28_TO_36: [28, 37],
      W37_PLUS: [37, null],
    };
    return range(...bounds[value], "GESTATIONAL_WEEKS");
  }
  if (id === "P04") {
    const bounds: Record<string, [number, number | null]> = {
      UNDER_1_MONTH: [0, 1],
      M1_TO_2: [1, 3],
      M3_TO_5: [3, 6],
      M6_TO_11: [6, 12],
      M12_PLUS: [12, null],
    };
    return range(...bounds[value], "CALENDAR_MONTHS_SINCE_BIRTH");
  }
  return { kind: "CODE", value };
}
export type BankFactProjection = {
  answers: Answer[];
  selectedChildren: string[];
  selectedSubjects: Subject[];
  /** Valid intake values with no comparable policy rule remain explicit in coverage. */
  mappedQuestionIds: string[];
};
export function projectBankFacts(
  context: BankContext,
  input: BankAnswer[],
  recordedAt: string,
): BankFactProjection {
  const active = activeBankAnswers(context, input);
  const answers: Answer[] = [];
  const subjects = new Map<string, Subject>();

  const mappedQuestionIds = new Set<string>();
  const scope = (id: string) =>
    active.find(
      (a) =>
        a.questionId === id &&
        a.subjectId === "HOUSEHOLD" &&
        a.state === "PROVIDED",
    )?.value;
  const selectedPerson = scope(
    context.category === "pregnancy" ? "P01" : "H01",
  );
  const childIds =
    context.category === "pregnancy" ||
    (context.category === "health" && selectedPerson !== "CHILD")
      ? []
      : context.childProfiles.map((p) => p.id);
  if (
    ["pregnancy", "health"].includes(context.category) &&
    selectedPerson &&
    selectedPerson !== "CHILD"
  )
    subjects.set(`PERSON:${selectedPerson}`, {
      kind: "PERSON",
      id: selectedPerson,
    });
  function bind(mapping: BankFactMapping, id: string): Subject | null {
    if (
      mapping.subject === "PREGNANCY_EVENT" ||
      mapping.subject === "BIRTH_EVENT"
    )
      return {
        kind: "EVENT",
        id: `${mapping.subject === "PREGNANCY_EVENT" ? "pregnancy" : "birth"}:${id}`,
      };
    if (childIds.includes(id)) return { kind: "CHILD", id };
    if (id !== "HOUSEHOLD") return { kind: "PERSON", id };
    if (
      mapping.subject === "SELECTED_SCOPE" &&
      context.category === "pregnancy"
    ) {
      const person = scope("P01");
      return person ? { kind: "PERSON", id: person } : null;
    }
    if (mapping.subject === "SELECTED_SCOPE" && context.category === "health") {
      const person = scope("H01");
      return person && person !== "CHILD"
        ? { kind: "PERSON", id: person }
        : null;
    }
    return { kind: "HOUSEHOLD", id: "HOUSEHOLD" };
  }
  function add(key: FactKey, state: Answer["state"], value?: FactValue) {
    if (key.subject.kind === "PERSON" || key.subject.kind === "EVENT")
      subjects.set(`${key.subject.kind}:${key.subject.id}`, key.subject);
    answers.push(
      state === "PROVIDED" && value
        ? { key, recordedAt, state, value, source: "USER_DECLARED" }
        : { key, recordedAt, state: state === "PROVIDED" ? "UNASKED" : state },
    );
  }
  for (const a of active) {
    const mapping = BANK_FACT_MAPPINGS.find(
      (m) => m.questionId === a.questionId,
    );
    if (!mapping) continue; // Scope selections are not eligibility facts.
    const subject = bind(mapping, a.subjectId);
    if (!subject) continue;
    const key: FactKey = {
      attribute: mapping.attribute,
      basis: mapping.basis,
      reference: mapping.reference,
      subject,
    };
    const notApplicable =
      a.state === "PROVIDED" && a.value === "NOT_APPLICABLE";
    add(
      key,
      notApplicable ? "EXPLICIT_NOT_APPLICABLE" : a.state,
      a.state === "PROVIDED" && !notApplicable
        ? valueFor(a.questionId, a.value!)
        : undefined,
    );
    if (a.questionId === "E04") {
      const [region, district] = a.value?.split("|") ?? [];
      for (const [suffix, value] of [
        ["region", region],
        ["district", district],
      ])
        add(
          { ...key, attribute: `education.schoolRegion.${suffix}` },
          a.state,
          value ? { kind: "CODE", value } : undefined,
        );
    }
    mappedQuestionIds.add(a.questionId);
  }
  for (const p of context.childProfiles.filter((p) =>
    childIds.includes(p.id),
  )) {
    const subject: Subject = { kind: "CHILD", id: p.id };
    if (p.sex)
      add(
        {
          attribute: "person.sex",
          basis: "USER_DECLARED_SEX",
          reference: "AT_ANSWER_TIME",
          subject,
        },
        "PROVIDED",
        { kind: "CODE", value: p.sex },
      );
    if (p.birthYear !== null)
      add(
        {
          attribute: "person.birthDate",
          basis: "CALENDAR_DATE",
          reference: "BIRTH",
          subject,
        },
        "PROVIDED",
        {
          kind: "DATE_RANGE",
          earliest: `${p.birthYear}-01-01`,
          latest: `${p.birthYear}-12-31`,
        },
      );
  }
  // This residence describes the intake household now, never a child's historical residence.
  for (const [suffix, value] of [
    ["region", context.residence?.region],
    ["district", context.residence?.district],
  ])
    if (value)
      add(
        {
          attribute: `residence.${suffix}`,
          basis: "REGISTERED_RESIDENCE",
          reference: "CURRENT",
          subject: { kind: "HOUSEHOLD", id: "HOUSEHOLD" },
        },
        "PROVIDED",
        { kind: "CODE", value },
      );
  return {
    answers,
    selectedChildren: childIds,
    selectedSubjects: [...subjects.values()],
    mappedQuestionIds: [...mappedQuestionIds],
  };
}
