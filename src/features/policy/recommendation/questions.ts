import { evaluatePredicate } from "./eligibility.ts";
import { activateAnswers, bindFact, factKey, replaceAnswer } from "./facts.ts";
import type {
  Answer,
  Card,
  Catalog,
  FactKey,
  QuestionDefinition,
  QuestionInstance,
  Request,
  Subject,
} from "./types.ts";
type Evaluator = (catalog: Catalog, request: Request) => Card[];
const valuesEqual = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
function contexts(request: Request) {
  const household: Subject = { kind: "HOUSEHOLD", id: request.householdId };
  const beneficiaries: Subject[] = [
    ...request.selectedChildren.map((id) => ({ kind: "CHILD" as const, id })),
    ...(request.selectedSubjects ?? []),
    household,
  ];
  return beneficiaries.map((beneficiary) => ({ beneficiary, household }));
}
function answerAt(request: Request, key: FactKey): Answer[] {
  return request.answers.filter(
    (a) => a.active !== false && factKey(a.key) === factKey(key),
  );
}
function prerequisitesMet(
  q: QuestionDefinition,
  key: FactKey,
  catalog: Catalog,
  request: Request,
): boolean {
  const context = {
    beneficiary: key.subject,
    household: { kind: "HOUSEHOLD" as const, id: request.householdId },
  };
  return q.prerequisites.every((p) => {
    const parent = catalog.questions.find((q) => q.id === p.questionId);
    if (!parent) return false;
    const answers = answerAt(request, bindFact(parent.fact, context));
    return (
      answers.length === 1 &&
      answers[0].state === "PROVIDED" &&
      valuesEqual(answers[0].value, p.equals)
    );
  });
}
export function buildQuestionCandidates(
  catalog: Catalog,
  request: Request,
): { definition: QuestionDefinition; key: FactKey }[] {
  const found = new Map<
    string,
    { definition: QuestionDefinition; key: FactKey }
  >();
  for (const q of [...catalog.questions].sort((a, b) => (a.id < b.id ? -1 : 1)))
    for (const context of contexts(request)) {
      const key = bindFact(q.fact, context);
      const answers = answerAt(request, key);
      // No automatic re-asking of uncertainty/skip; users can explicitly edit instead.
      if (
        answers.some(
          (a) =>
            a.state === "DONT_KNOW" ||
            a.state === "SKIPPED" ||
            a.state === "EXPLICIT_NOT_APPLICABLE",
        )
      )
        continue;
      if (answers.length === 1 && answers[0].state === "PROVIDED") {
        const needsPrecision = catalog.policies.some((policy) =>
          policy.rules.some(
            (rule) =>
              factKey(bindFact(rule.fact, context)) === factKey(key) &&
              evaluatePredicate(rule, {
                ...context,
                answers: request.answers,
                sourceVersion: policy.sourceVersion,
                mode: request.mode,
              }).unknowns.some((u) => u.kind === "USER_PRECISION"),
          ),
        );
        if (!needsPrecision) continue;
      }
      if (!prerequisitesMet(q, key, catalog, request)) continue;
      const identity = factKey(key);
      if (!found.has(identity)) found.set(identity, { definition: q, key });
    }
  return [...found.values()];
}
function signatures(cards: Card[]): Map<string, string> {
  return new Map(
    cards.map((card) => [
      card.policyId,
      JSON.stringify(
        card.pathResults
          .map((path) => ({
            path: path.pathId,
            subject: path.subject,
            eligibility: path.eligibility.value,
            unknowns: path.eligibility.unknowns
              .filter(
                (u) =>
                  !path.eligibility.unknowns.some(
                    (cause) => cause.kind === "INCOMPLETE_PATHS",
                  ) || !u.kind.startsWith("USER_"),
              )
              .map((u) => [u.kind, u.factKey ? factKey(u.factKey) : null])
              .sort(),
            features: path.features.map((f) => f.value),
          }))
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      ),
    ]),
  );
}
function simulate(
  catalog: Catalog,
  request: Request,
  q: QuestionDefinition,
  key: FactKey,
  value: QuestionDefinition["options"][number]["value"],
): Request {
  const next = {
    ...request,
    answers: replaceAnswer(request.answers, {
      key,
      recordedAt: request.evaluatedAt,
      questionId: q.id,
      questionVersion: q.version,
      state: "PROVIDED",
      source: "USER_DECLARED",
      value,
    }),
  };
  next.answers = activateAnswers(next, catalog.questions);
  return next;
}
export function simulateQuestionImpact(
  catalog: Catalog,
  request: Request,
  candidate: { definition: QuestionDefinition; key: FactKey },
  baseline: Card[],
  evaluate: Evaluator,
): { affected: string[]; burden: number; resolved: number } {
  const base = signatures(baseline);
  const affected = new Set<string>();
  const resolved = new Set<string>();
  let minimumDownstream = Infinity;
  let evaluations = 0;
  const record = (state: Request) => {
    if (++evaluations > 4096) throw new Error("question-simulation-limit");
    const cards = evaluate(catalog, state);
    const after = signatures(cards);
    const changed = [...new Set([...base.keys(), ...after.keys()])].filter(
      (id) => base.get(id) !== after.get(id),
    );
    changed.forEach((id) => affected.add(id));
    for (const card of baseline)
      if (
        card.eligibility === "UNKNOWN" &&
        (!after.has(card.policyId) ||
          cards.find((c) => c.policyId === card.policyId)?.eligibility ===
            "ELIGIBLE")
      )
        resolved.add(card.policyId);
    return changed.length > 0;
  };
  const candidateIdentity = factKey(candidate.key);
  for (const option of candidate.definition.options) {
    const next = simulate(
      catalog,
      request,
      candidate.definition,
      candidate.key,
      option.value,
    );
    const directImpact = record(next);
    if (directImpact) minimumDownstream = 0;
    // Complete each descendant's prerequisite DAG, including independent parents.
    // All references are bound to the target child, so sibling answers cannot help.
    for (const context of contexts(request))
      for (const target of catalog.questions) {
        const targetKey = bindFact(target.fact, context);
        const dependsOnCandidate = (q: QuestionDefinition): boolean =>
          q.prerequisites.some((p) => {
            const parent = catalog.questions.find(
              (q) => q.id === p.questionId,
            )!;
            return (
              factKey(bindFact(parent.fact, context)) === candidateIdentity ||
              dependsOnCandidate(parent)
            );
          });
        if (!dependsOnCandidate(target)) continue;
        let state = next;
        const added = new Map<string, number>();
        const planned = new Map<string, unknown>();
        const satisfy = (q: QuestionDefinition): boolean =>
          q.prerequisites.every((p) => {
            const parent = catalog.questions.find(
              (q) => q.id === p.questionId,
            )!;
            const key = bindFact(parent.fact, context),
              identity = factKey(key);
            if (planned.has(identity))
              return valuesEqual(planned.get(identity), p.equals);
            const known = answerAt(state, key);
            if (known.length) {
              if (
                known.length !== 1 ||
                known[0].state !== "PROVIDED" ||
                !valuesEqual(known[0].value, p.equals)
              )
                return false;
              return true;
            }
            if (
              identity === candidateIdentity ||
              !parent.options.some((o) => valuesEqual(o.value, p.equals)) ||
              !satisfy(parent)
            )
              return false;
            planned.set(identity, p.equals);
            state = simulate(catalog, state, parent, key, p.equals);
            added.set(identity, parent.burden);
            return true;
          });
        if (
          !satisfy(target) ||
          answerAt(state, targetKey).some((a) => a.state !== "UNASKED")
        )
          continue;
        for (const answer of target.options) {
          const downstream = simulate(
            catalog,
            state,
            target,
            targetKey,
            answer.value,
          );
          if (record(downstream))
            minimumDownstream = Math.min(
              minimumDownstream,
              [...added.values()].reduce((a, b) => a + b, 0) + target.burden,
            );
        }
      }
  }
  return {
    affected: [...affected].sort(),
    burden:
      candidate.definition.burden +
      (Number.isFinite(minimumDownstream) ? minimumDownstream : 0),
    resolved: resolved.size,
  };
}
export function selectNextQuestion(
  catalog: Catalog,
  request: Request,
  cards: Card[],
  evaluate: Evaluator,
): QuestionInstance | null {
  const scored = buildQuestionCandidates(catalog, request).map((candidate) => ({
    candidate,
    impact: simulateQuestionImpact(
      catalog,
      request,
      candidate,
      cards,
      evaluate,
    ),
  }));
  const direct = cards.filter(
    (c) => c.representative.features[0].value === "MATCH",
  );
  const unknown = cards.filter(
    (c) => c.representative.features[0].value === "UNKNOWN",
  );
  const focus = new Set(
    (direct.length ? direct : unknown.length ? unknown : cards).map(
      (c) => c.policyId,
    ),
  );
  const select = (ids: Set<string>) =>
    scored
      .map((s) => ({
        ...s,
        affected: s.impact.affected.filter((id) => ids.has(id)),
      }))
      .filter((s) => s.affected.length)
      .sort(
        (a, b) =>
          b.affected.length / b.impact.burden -
            a.affected.length / a.impact.burden ||
          b.impact.resolved - a.impact.resolved ||
          a.impact.burden - b.impact.burden ||
          factKey(a.candidate.key).localeCompare(factKey(b.candidate.key)),
      );
  const chosen =
    select(focus)[0] ?? select(new Set(cards.map((c) => c.policyId)))[0];
  if (!chosen) return null;
  const { definition, key } = chosen.candidate;
  return {
    key: factKey(key),
    definitionId: definition.id,
    version: definition.version,
    factKey: key,
    prompt: definition.prompt,
    whyAsked: definition.whyAsked,
    options: definition.options,
    affectedPolicyIds: chosen.affected,
    burden: chosen.impact.burden,
    utility: chosen.affected.length / chosen.impact.burden,
  };
}
