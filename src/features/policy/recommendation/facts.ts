import type {
  Answer,
  Context,
  FactKey,
  FactRef,
  FactValue,
  QuestionDefinition,
  Request,
} from "./types.ts";

export const factKey = (key: FactKey): string =>
  JSON.stringify([
    key.attribute,
    key.subject.kind,
    key.subject.id,
    key.basis,
    key.reference,
  ]);
export const bindFact = (
  ref: FactRef,
  context: Pick<Context, "beneficiary" | "household">,
): FactKey => ({
  ...ref,
  subject:
    ref.subject === "HOUSEHOLD" ? context.household : context.beneficiary,
});
export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function validateValue(value: FactValue): void {
  if (!value || typeof value !== "object")
    throw new Error("invalid-fact-value");
  switch (value.kind) {
    case "CODE":
      if (typeof value.value !== "string" || !value.value)
        throw new Error("invalid-code");
      break;
    case "BOOLEAN":
      if (typeof value.value !== "boolean") throw new Error("invalid-boolean");
      break;
    case "NUMBER_RANGE": {
      if (
        !value.unit ||
        typeof value.minInclusive !== "boolean" ||
        typeof value.maxInclusive !== "boolean" ||
        [value.min, value.max].some((x) => x !== null && !Number.isFinite(x))
      )
        throw new Error("invalid-number-range");
      if (
        value.min !== null &&
        value.max !== null &&
        (value.min > value.max ||
          (value.min === value.max &&
            (!value.minInclusive || !value.maxInclusive)))
      )
        throw new Error("empty-number-range");
      break;
    }
    case "DATE_RANGE":
      if (
        !validDate(value.earliest) ||
        !validDate(value.latest) ||
        value.earliest > value.latest
      )
        throw new Error("invalid-date-range");
      break;
    default:
      throw new Error("invalid-fact-kind");
  }
}
export function normalizeAnswers(answers: Answer[]): Answer[] {
  if (!Array.isArray(answers) || answers.length > 300)
    throw new Error("invalid-answers");
  return answers.map((answer) => {
    const key = answer?.key;
    if (
      !key ||
      !["CHILD", "HOUSEHOLD", "PERSON", "EVENT"].includes(key.subject?.kind) ||
      ![key.attribute, key.subject.id, key.basis, key.reference].every(
        (x) => typeof x === "string" && x.length > 0,
      ) ||
      !Number.isFinite(Date.parse(answer.recordedAt))
    )
      throw new Error("invalid-answer");
    if (
      ![
        "PROVIDED",
        "UNASKED",
        "DONT_KNOW",
        "SKIPPED",
        "EXPLICIT_NOT_APPLICABLE",
      ].includes(answer.state)
    )
      throw new Error("invalid-answer-state");
    if (answer.state === "PROVIDED") {
      if (answer.source !== "USER_DECLARED")
        throw new Error("invalid-answer-source");
      validateValue(answer.value);
    }
    return structuredClone(answer);
  });
}
export function validateRequest(request: Request): Request {
  if (
    !Number.isInteger(request.revision) ||
    request.revision < 0 ||
    !request.category ||
    !request.householdId ||
    !Number.isFinite(Date.parse(request.evaluatedAt)) ||
    !["FIXTURE", "PUBLIC"].includes(request.mode) ||
    !["CURRENT", "UPCOMING", "CLOSED"].includes(request.view) ||
    !["QUESTIONING", "RESULTS"].includes(request.phase) ||
    !Number.isInteger(request.questionCount) ||
    request.questionCount < 0 ||
    typeof request.subjectsComplete !== "boolean"
  )
    throw new Error("invalid-request");
  if (
    !Array.isArray(request.selectedChildren) ||
    request.selectedChildren.length > 30 ||
    request.selectedChildren.some((x) => typeof x !== "string" || !x) ||
    new Set(request.selectedChildren).size !==
      request.selectedChildren.length ||
    !Array.isArray(request.needs) ||
    request.needs.some((x) => typeof x !== "string" || !x)
  )
    throw new Error("invalid-scope");
  if (
    request.selectedSubjects !== undefined &&
    (!Array.isArray(request.selectedSubjects) ||
      request.selectedChildren.length + request.selectedSubjects.length > 60 ||
      request.selectedSubjects.some(
        (subject) =>
          !subject ||
          !["PERSON", "EVENT"].includes(subject.kind) ||
          typeof subject.id !== "string" ||
          !subject.id.trim() ||
          Object.keys(subject).some((key) => key !== "kind" && key !== "id"),
      ) ||
      new Set(
        request.selectedSubjects.map((subject) =>
          JSON.stringify([subject.kind, subject.id]),
        ),
      ).size !== request.selectedSubjects.length)
  )
    throw new Error("invalid-scope");
  return {
    ...request,
    selectedChildren: [...request.selectedChildren],
    ...(request.selectedSubjects !== undefined
      ? {
          selectedSubjects: request.selectedSubjects.map((subject) => ({
            ...subject,
          })),
        }
      : {}),
    needs: [...new Set(request.needs)].sort(),
    answers: normalizeAnswers(request.answers),
  };
}
/** Keep history in the caller; the returned projection alone is used for evaluation. */
export function activateAnswers(
  request: Request,
  questions: QuestionDefinition[],
): Answer[] {
  let answers = request.answers.map((a) => ({
    ...a,
    active:
      a.active !== false &&
      (a.key.subject.kind === "HOUSEHOLD"
        ? a.key.subject.id === request.householdId
        : a.key.subject.kind === "CHILD"
          ? request.selectedChildren.includes(a.key.subject.id)
          : (request.selectedSubjects ?? []).some(
              (subject) =>
                subject.kind === a.key.subject.kind &&
                subject.id === a.key.subject.id,
            )),
  }));
  // Fixed point handles transitive dependencies; catalog validation forbids cycles.
  for (let pass = 0; pass <= questions.length; pass++) {
    let changed = false;
    answers = answers.map((answer) => {
      if (!answer.active || !answer.questionId) return answer;
      const definition = questions.find((q) => q.id === answer.questionId);
      const context = {
        beneficiary: answer.key.subject,
        household: { kind: "HOUSEHOLD" as const, id: request.householdId },
      };
      if (
        !definition ||
        definition.version !== answer.questionVersion ||
        factKey(bindFact(definition.fact, context)) !== factKey(answer.key) ||
        !definition.prerequisites.every((prerequisite) => {
          const parent = questions.find(
            (q) => q.id === prerequisite.questionId,
          );
          if (!parent) return false;
          const found = answers.filter(
            (a) =>
              a.active &&
              factKey(a.key) === factKey(bindFact(parent.fact, context)),
          );
          return (
            found.length === 1 &&
            found[0].state === "PROVIDED" &&
            JSON.stringify(found[0].value) ===
              JSON.stringify(prerequisite.equals)
          );
        })
      ) {
        changed = true;
        return { ...answer, active: false };
      }
      return answer;
    });
    if (!changed) break;
  }
  return answers;
}
/** Replacing an answer never merges facts belonging to different children or dates. */
export function replaceAnswer(answers: Answer[], next: Answer): Answer[] {
  const validated = normalizeAnswers([next])[0];
  return [
    ...answers.filter((a) => factKey(a.key) !== factKey(next.key)),
    validated,
  ];
}
