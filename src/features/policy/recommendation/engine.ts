import { activateAnswers, validateRequest, validateValue } from "./facts.ts";
import { evaluateEligibility } from "./eligibility.ts";
import {
  calculatePolicyScore,
  comparePaths,
  enabledFeatures,
  rankPolicies,
} from "./ranking.ts";
import { selectNextQuestion } from "./questions.ts";
import type {
  Card,
  Catalog,
  Context,
  PathResult,
  Policy,
  Request,
  Result,
  Subject,
} from "./types.ts";

export function validateCatalog(catalog: Catalog): void {
  if (
    !catalog.version ||
    !Array.isArray(catalog.policies) ||
    !Array.isArray(catalog.questions)
  )
    throw new Error("invalid-catalog");
  const unique = (ids: string[]) => {
    if (new Set(ids).size !== ids.length || ids.some((id) => !id))
      throw new Error("duplicate-catalog-id");
  };
  unique(catalog.policies.map((p) => p.id));
  unique(catalog.questions.map((q) => q.id));
  for (const policy of catalog.policies) {
    unique(policy.rules.map((r) => r.id));
    unique(policy.paths.map((p) => p.id));
  }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error("question-cycle");
    if (visited.has(id)) return;
    const q = catalog.questions.find((q) => q.id === id);
    if (!q) throw new Error("missing-prerequisite");
    if (
      !q.version ||
      !q.prompt ||
      !q.whyAsked ||
      ![1, 2, 3, 4].includes(q.burden) ||
      !q.options.length
    )
      throw new Error("invalid-question");
    q.options.forEach((o) => validateValue(o.value));
    visiting.add(id);
    q.prerequisites.forEach((p) => {
      validateValue(p.equals);
      visit(p.questionId);
    });
    visiting.delete(id);
    visited.add(id);
  }
  catalog.questions.forEach((q) => visit(q.id));
}
export function selectUsablePolicies(
  catalog: Catalog,
  request: Request,
): Policy[] {
  return catalog.policies.filter(
    (p) =>
      p.category === request.category &&
      p.release !== "HIDDEN" &&
      (request.mode === "FIXTURE" || p.release === "HUMAN") &&
      p.releaseSourceVersion === p.sourceVersion,
  );
}
export function evaluateCards(catalog: Catalog, request: Request): Card[] {
  const policies = selectUsablePolicies(catalog, request);
  const enabled = enabledFeatures(policies, request);
  const cards: Card[] = [];
  for (const policy of policies) {
    const pathResults: PathResult[] = [];
    for (const path of policy.paths) {
      // UNKNOWN availability remains in CURRENT, with no invented open claim.
      let availability = path.availabilityEvidence.length
        ? path.availability
        : ("UNKNOWN" as const);
      if (
        availability === "OPEN" &&
        path.deadline &&
        Number.isFinite(Date.parse(path.deadline)) &&
        Date.parse(path.deadline) <= Date.parse(request.evaluatedAt)
      )
        availability = "CLOSED";
      if (
        request.view === "CURRENT"
          ? availability === "UPCOMING" || availability === "CLOSED"
          : availability !== request.view
      )
        continue;
      const subjects: Subject[] =
        path.subject === "HOUSEHOLD"
          ? [{ kind: "HOUSEHOLD", id: request.householdId }]
          : request.selectedChildren.map((id) => ({ kind: "CHILD", id }));
      for (const subject of subjects) {
        const context: Context = {
          answers: request.answers,
          beneficiary: subject,
          household: { kind: "HOUSEHOLD", id: request.householdId },
          sourceVersion: policy.sourceVersion,
          mode: request.mode,
        };
        const eligibility = evaluateEligibility(policy, path, context);
        if (
          eligibility.value === "INELIGIBLE" &&
          (!policy.completePaths || !request.subjectsComplete)
        ) {
          eligibility.value = "UNKNOWN";
          eligibility.unknowns.push({
            kind: !policy.completePaths
              ? "INCOMPLETE_PATHS"
              : "INCOMPLETE_SUBJECTS",
            resolvableByQuestion: false,
          });
        }
        const score = calculatePolicyScore(
          policy,
          { ...path, availability },
          context,
          request,
          enabled,
        );
        pathResults.push({
          policyId: policy.id,
          pathId: path.id,
          subject,
          eligibility,
          ...score,
          purpose:
            [...path.purposes].sort().find((p) => request.needs.includes(p)) ??
            [...path.purposes].sort()[0] ??
            "",
          availability,
          reasons:
            score.features[0].value === "MATCH"
              ? ["선택한 지원 목적에 해당합니다."]
              : [],
        });
      }
    }
    const candidates = pathResults
      .filter((p) => p.eligibility.value !== "INELIGIBLE")
      .sort(comparePaths);
    if (!candidates.length) continue;
    const representative = candidates[0];
    const subjectKeys = [
      ...new Set(candidates.map((p) => JSON.stringify(p.subject))),
    ];
    const tags = subjectKeys.map((key) => {
      const paths = candidates.filter((p) => JSON.stringify(p.subject) === key);
      const eligibility = paths.some((p) => p.eligibility.value === "ELIGIBLE")
        ? ("ELIGIBLE" as const)
        : ("UNKNOWN" as const);
      return {
        subject: paths[0].subject,
        eligibility,
        label:
          eligibility === "ELIGIBLE" ? "입력 기준 조건 일치" : "추가 확인 필요",
      };
    });
    cards.push({
      policyId: policy.id,
      title: policy.title,
      eligibility: representative.eligibility.value,
      representative,
      pathResults,
      tags,
      checksNeeded: candidates.flatMap((p) => p.eligibility.unknowns),
    });
  }
  return rankPolicies(cards);
}
export function evaluateRecommendation(
  catalog: Catalog,
  input: Request,
): Result {
  validateCatalog(catalog);
  const request = validateRequest(input);
  request.answers = activateAnswers(request, catalog.questions);
  if (
    !request.selectedChildren.length &&
    selectUsablePolicies(catalog, request).some((p) =>
      p.paths.some((path) => path.subject === "CHILD"),
    )
  )
    throw new Error("select-at-least-one-child");
  const candidates = evaluateCards(catalog, request);
  const question =
    request.phase === "QUESTIONING" && request.questionCount < 5
      ? selectNextQuestion(catalog, request, candidates, evaluateCards)
      : null;
  const stopReason =
    request.phase === "RESULTS"
      ? "RESULTS_REQUESTED"
      : request.questionCount >= 5
        ? "QUESTION_LIMIT"
        : question
          ? null
          : "NO_USEFUL_QUESTION";
  const cards = request.phase === "RESULTS" ? candidates.slice(0, 20) : [];
  return {
    revision: request.revision,
    catalogVersion: catalog.version,
    evaluatedAt: request.evaluatedAt,
    mode: request.mode,
    cards,
    top5: cards.slice(0, 5).map((c) => c.policyId),
    candidateCount: candidates.length,
    nextQuestion: question,
    stopReason,
  };
}
