import bank from "../../../../docs/fixtures/policy-recommendation/category-question-bank-v1.json" with { type: "json" };
import { DISTRICTS_BY_REGION } from "../public/districts.ts";
import type { ChildProfile, ResidenceScope } from "./intake.ts";
export type BankAnswer = {
  questionId: string;
  subjectId: string;
  state: "PROVIDED" | "DONT_KNOW" | "SKIPPED";
  value?: string;
};
export type BankContext = {
  category: string;
  needs: string[];
  childProfiles: ChildProfile[];
  residence?: ResidenceScope;
};
export type BankQuestion = {
  key: string;
  id: string;
  prompt: string;
  notes: string;
  subjectId: string;
  subjectLabel: string;
  answerType: "SINGLE_CHOICE" | "REGION";
  options: { value: string; label: string }[];
};
type Condition = {
  questionId?: string;
  values?: string[];
  needsAny?: string[];
};
type Definition = {
  id: string;
  categories: string[];
  prompt: string;
  notes: string;
  answerType: string;
  fact?: { subject: string };
  when: Condition[];
  options: { value: string; label: string }[];
  optionConditions?: Record<string, Condition[]>;
};
export function validBankRegion(value: string): boolean {
  const parts = value.split("|");
  return (
    parts.length === 2 &&
    Object.hasOwn(DISTRICTS_BY_REGION, parts[0]) &&
    (parts[1] === "" || DISTRICTS_BY_REGION[parts[0]].includes(parts[1]))
  );
}
function resolve(context: BankContext, answers: BankAnswer[]) {
  const active: BankAnswer[] = [];
  const questions: BankQuestion[] = [];
  const value = (id: string, subjectId: string) =>
    active.find(
      (a) =>
        a.questionId === id &&
        a.subjectId === subjectId &&
        a.state === "PROVIDED",
    )?.value;
  const matches = (conditions: Condition[], subject: string) =>
    conditions.every((c) =>
      c.needsAny
        ? c.needsAny.some((n) => context.needs.includes(n))
        : !!c.questionId &&
          !!c.values?.includes(value(c.questionId, subject) ?? ""),
    );
  const definitions = [...(bank.questions as Definition[])].sort(
    (a, b) =>
      Number(["P01", "H01"].includes(b.id)) -
      Number(["P01", "H01"].includes(a.id)),
  );
  for (const q of definitions) {
    if (!q.categories.includes(context.category)) continue;
    let subjects = ["HOUSEHOLD"];
    if (
      q.id === "C-TIMING" &&
      (["childcare", "care", "education"].includes(context.category) ||
        (context.category === "health" &&
          value("H01", "HOUSEHOLD") === "CHILD"))
    )
      subjects = context.childProfiles.map((c) => c.id);
    else if (q.fact?.subject === "EACH_CHILD")
      subjects = context.childProfiles.map((c) => c.id);
    else if (
      ["SELECTED_PERSON", "PREGNANCY_EVENT", "BIRTH_EVENT"].includes(
        q.fact?.subject ?? "",
      )
    ) {
      const scope = value(
        context.category === "pregnancy" ? "P01" : "H01",
        "HOUSEHOLD",
      );
      subjects =
        scope === "CHILD"
          ? context.childProfiles.map((c) => c.id)
          : scope
            ? [scope]
            : [];
    }
    for (const subjectId of subjects) {
      if (!matches(q.when, subjectId)) continue;
      const options = q.options.filter(
        (o) =>
          !(
            q.id === "H01" &&
            o.value === "CHILD" &&
            context.childProfiles.length === 0
          ) && matches(q.optionConditions?.[o.value] ?? [], subjectId),
      );
      const childIndex = context.childProfiles.findIndex(
        (c) => c.id === subjectId,
      );
      const question: BankQuestion = {
        key: `${q.id}:${subjectId}`,
        id: q.id,
        prompt: q.prompt,
        notes: q.notes,
        subjectId,
        subjectLabel:
          childIndex >= 0
            ? `자녀 ${childIndex + 1}`
            : ({
                SELF: "본인",
                PARTNER: "배우자",
                OTHER_FAMILY: "다른 가족",
                HOUSEHOLD: "공통",
              }[subjectId] ?? subjectId),
        answerType: q.answerType as BankQuestion["answerType"],
        options,
      };
      questions.push(question);
      const answer = answers.find(
        (a) => a.questionId === q.id && a.subjectId === subjectId,
      );
      if (
        answer &&
        (answer.state === "DONT_KNOW" ||
          answer.state === "SKIPPED" ||
          (answer.state === "PROVIDED" &&
            typeof answer.value === "string" &&
            (q.answerType === "REGION"
              ? validBankRegion(answer.value)
              : options.some((o) => o.value === answer.value))))
      )
        active.push(answer);
    }
  }
  return { questions, active };
}
export function getBankQuestions(
  context: BankContext,
  answers: BankAnswer[],
): BankQuestion[] {
  return resolve(context, answers).questions;
}
export function activeBankAnswers(
  context: BankContext,
  answers: BankAnswer[],
): BankAnswer[] {
  return resolve(context, answers).active;
}
