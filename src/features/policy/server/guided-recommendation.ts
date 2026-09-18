import { createHash } from "node:crypto";
import { projectBankFacts } from "../recommendation/bank-facts.ts";
import { bindFact, factKey, replaceAnswer } from "../recommendation/facts.ts";
import { evaluateRecommendation } from "../recommendation/engine.ts";
import { RECOMMENDATION_FIELDS } from "../recommendation/intake.ts";
import type {
  Answer,
  FactValue,
  QuestionInstance,
  Subject,
} from "../recommendation/types.ts";
import {
  parseCategoryBankRequest,
  type CategoryBankRequest,
  type CategoryBankResponse,
} from "./category-recommendation.ts";
import {
  RecommendationContextChangedError,
  RecommendationRequestError,
} from "./recommendation-service.ts";
import type { RecommendationCatalog } from "./recommendation-release.ts";

/** Supplemental precision may narrow an intake range, never change its meaning. */
function refines(base: FactValue, next: FactValue): boolean {
  if (base.kind === "CODE" && next.kind === "CODE")
    return base.value === next.value;
  if (base.kind === "BOOLEAN" && next.kind === "BOOLEAN")
    return base.value === next.value;
  if (base.kind === "DATE_RANGE" && next.kind === "DATE_RANGE")
    return next.earliest >= base.earliest && next.latest <= base.latest;
  if (base.kind === "NUMBER_RANGE" && next.kind === "NUMBER_RANGE")
    return (
      base.unit === next.unit &&
      (base.min === null ||
        (next.min !== null &&
          (next.min > base.min ||
            (next.min === base.min &&
              (base.minInclusive || !next.minInclusive))))) &&
      (base.max === null ||
        (next.max !== null &&
          (next.max < base.max ||
            (next.max === base.max &&
              (base.maxInclusive || !next.maxInclusive)))))
    );
  return false;
}

export type RuleAnswer = {
  questionId: string;
  version: string;
  subject: Subject;
  state: "PROVIDED" | "DONT_KNOW" | "SKIPPED";
  value?: string;
};
export type GuidedQuestion = {
  key: string;
  id: string;
  version: string;
  subject: Subject;
  subjectLabel: string;
  prompt: string;
  whyAsked: string;
  options: { value: string; label: string }[];
};
export type GuidedRecommendationResponse = CategoryBankResponse & {
  method: "PROVISIONAL" | "VERIFIED" | "MIXED";
  catalogVersion: string;
  contextKey: string;
  nextQuestion: GuidedQuestion | null;
  stopReason:
    | "RESULTS_REQUESTED"
    | "QUESTION_LIMIT"
    | "NO_USEFUL_QUESTION"
    | null;
  top5: string[];
  withheldPolicyCount: number;
};
function markCheckRequired(
  item: CategoryBankResponse["policies"][number],
): CategoryBankResponse["policies"][number] {
  return {
    ...item,
    reviewStatus: "CHECK_REQUIRED",
    tags: [...new Set(["직접 확인 필요", ...item.tags])],
  };
}

function contextKey(request: CategoryBankRequest): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        request.category,
        request.needs,
        request.childProfiles,
        request.residence ?? null,
        [...request.bankAnswers].sort((a, b) =>
          `${a.questionId}:${a.subjectId}`.localeCompare(
            `${b.questionId}:${b.subjectId}`,
          ),
        ),
      ]),
    )
    .digest("hex");
}
function subjectLabel(subject: Subject, request: CategoryBankRequest) {
  if (subject.kind === "CHILD")
    return `자녀 ${request.childProfiles.findIndex((p) => p.id === subject.id) + 1}`;
  if (subject.kind === "HOUSEHOLD") return "가구";
  const id =
    subject.kind === "EVENT" ? subject.id.split(":").at(-1)! : subject.id;
  return (
    ({ SELF: "본인", PARTNER: "배우자", OTHER_FAMILY: "다른 가족" }[id] ??
      "선택한 대상") + (subject.kind === "EVENT" ? "의 해당 사건" : "")
  );
}
function wireQuestion(
  q: QuestionInstance,
  request: CategoryBankRequest,
): GuidedQuestion {
  return {
    key: q.key,
    id: q.definitionId,
    version: q.version,
    subject: q.factKey.subject,
    subjectLabel: subjectLabel(q.factKey.subject, request),
    prompt: q.prompt,
    whyAsked: q.whyAsked,
    options: q.options.map((o, index) => ({
      value: String(index),
      label: o.label,
    })),
  };
}
export function createGuidedRecommendationService({
  loadCatalog,
  recommendProvisional,
  now = () => new Date(),
}: {
  loadCatalog: () => Promise<RecommendationCatalog>;
  recommendProvisional: (
    input: unknown,
    options?: { excludePolicyIds?: ReadonlySet<string> },
  ) => Promise<CategoryBankResponse>;
  now?: () => Date;
}) {
  return async (input: unknown): Promise<GuidedRecommendationResponse> => {
    const date = now();
    const request = parseCategoryBankRequest(input, date.getUTCFullYear());
    const key = contextKey(request);
    const loaded = await loadCatalog();
    const hasCategory =
      loaded.reviewedCategories?.includes(request.category) ||
      loaded.catalog.policies.some((p) => p.category === request.category);
    const ruleAnswers = request.ruleAnswers ?? [];
    if (
      ruleAnswers.length &&
      (request.catalogVersion !== loaded.catalog.version ||
        request.contextKey !== key)
    )
      throw new RecommendationContextChangedError();
    if (!hasCategory) {
      if (ruleAnswers.length) throw new RecommendationRequestError();
      const result =
        request.phase === "RESULTS"
          ? await recommendProvisional({
              ...request,
              ruleAnswers: [],
              phase: "RESULTS",
            })
          : {
              flow: "CATEGORY_BANK_V1" as const,
              revision: request.revision,
              policies: [],
              candidateCount: 0,
            };
      return {
        ...result,
        policies: result.policies.map(markCheckRequired),
        method: "PROVISIONAL",
        catalogVersion: loaded.catalog.version,
        contextKey: key,
        nextQuestion: null,
        stopReason:
          request.phase === "RESULTS"
            ? "RESULTS_REQUESTED"
            : "NO_USEFUL_QUESTION",
        top5: result.policies.slice(0, 5).map((p) => p.policy.id),
        withheldPolicyCount: 0,
      };
    }
    const projection = projectBankFacts(
      request,
      request.bankAnswers,
      date.toISOString(),
    );
    let answers = projection.answers;
    const relevant = loaded.catalog.policies.filter(
      (p) => p.category === request.category,
    );
    for (const a of ruleAnswers) {
      const q = loaded.catalog.questions.find(
        (q) => q.id === a.questionId && q.version === a.version,
      );
      const allowedSubject =
        a.subject.kind === "HOUSEHOLD"
          ? a.subject.id === "HOUSEHOLD"
          : a.subject.kind === "CHILD"
            ? projection.selectedChildren.includes(a.subject.id)
            : projection.selectedSubjects.some(
                (s) => s.kind === a.subject.kind && s.id === a.subject.id,
              );
      if (
        !q ||
        !allowedSubject ||
        (q.fact.subject === "HOUSEHOLD") !== (a.subject.kind === "HOUSEHOLD")
      )
        throw new RecommendationRequestError();
      const fact = bindFact(q.fact, {
        beneficiary: a.subject,
        household: { kind: "HOUSEHOLD", id: "HOUSEHOLD" },
      });
      // Question registration is necessary, but it must also serve this field and subject kind.
      const relevantQuestions = new Set(
        loaded.catalog.questions
          .filter((registered) =>
            relevant.some(
              (p) =>
                p.paths.some(
                  (path) =>
                    path.subject === a.subject.kind ||
                    a.subject.kind === "HOUSEHOLD",
                ) &&
                p.rules.some(
                  (r) =>
                    r.fact.attribute === registered.fact.attribute &&
                    r.fact.basis === registered.fact.basis &&
                    r.fact.reference === registered.fact.reference &&
                    r.fact.subject === registered.fact.subject,
                ),
            ),
          )
          .map((q) => q.id),
      );
      const queue = [...relevantQuestions];
      for (let i = 0; i < queue.length; i++) {
        const registered = loaded.catalog.questions.find(
          (q) => q.id === queue[i],
        );
        for (const prerequisite of registered?.prerequisites ?? []) {
          if (!relevantQuestions.has(prerequisite.questionId)) {
            relevantQuestions.add(prerequisite.questionId);
            queue.push(prerequisite.questionId);
          }
        }
      }
      if (!relevantQuestions.has(q.id)) throw new RecommendationRequestError();
      const option =
        a.state === "PROVIDED" && /^\d+$/.test(a.value ?? "")
          ? q.options[Number(a.value)]
          : undefined;
      if (a.state === "PROVIDED" && !option)
        throw new RecommendationRequestError();
      const common = {
        key: fact,
        recordedAt: date.toISOString(),
        questionId: q.id,
        questionVersion: q.version,
      };
      const next: Answer =
        a.state === "PROVIDED"
          ? {
              ...common,
              state: "PROVIDED",
              source: "USER_DECLARED",
              value: option!.value,
            }
          : { ...common, state: a.state };
      const base = projection.answers.find(
        (answer) => factKey(answer.key) === factKey(fact),
      );
      if (
        base &&
        next.state === "PROVIDED" &&
        (base.state === "PROVIDED"
          ? !refines(base.value, next.value)
          : base.state !== "UNASKED")
      )
        throw new RecommendationRequestError();
      answers = replaceAnswer(answers, next);
    }
    if (answers.length > 300) throw new RecommendationRequestError();
    const result = evaluateRecommendation(loaded.catalog, {
      ...projection,
      answers,
      revision: request.revision,
      category: request.category,
      householdId: "HOUSEHOLD",
      subjectsComplete: true,
      needs: request.needs,
      phase: request.phase,
      questionCount: request.questionCount ?? 0,
      evaluatedAt: date.toISOString(),
      view: "CURRENT",
      mode: "PUBLIC",
    });
    const display = new Map(loaded.policies.map((p) => [p.id, p]));
    const field = RECOMMENDATION_FIELDS.find((f) => f.id === request.category)!;
    const verified: GuidedRecommendationResponse = {
      flow: "CATEGORY_BANK_V1",
      revision: request.revision,
      method: "VERIFIED",
      catalogVersion: loaded.catalog.version,
      contextKey: key,
      nextQuestion: result.nextQuestion
        ? wireQuestion(result.nextQuestion, request)
        : null,
      stopReason: result.stopReason,
      top5: result.top5,
      candidateCount: result.candidateCount,
      withheldPolicyCount: loaded.withheldByCategory?.[request.category] ?? 0,
      policies: result.cards.map((card) => {
        const policy = display.get(card.policyId);
        if (!policy) throw new Error("missing-recommendation-display");
        const registered = relevant.find((p) => p.id === card.policyId)!;
        const need = field.needs.find(
          (n) => n.id === card.representative.purpose,
        );
        const checks = card.checksNeeded
          .map(
            (unknown) =>
              registered.rules.find((r) => r.id === unknown.ruleId)?.label,
          )
          .filter((v): v is string => !!v);
        const matched = card.representative.eligibility.usedAnswerKeys
          .map(
            (key) =>
              registered.rules.find(
                (r) =>
                  factKey(
                    bindFact(r.fact, {
                      beneficiary: card.representative.subject,
                      household: { kind: "HOUSEHOLD", id: "HOUSEHOLD" },
                    }),
                  ) === factKey(key),
              )?.label,
          )
          .filter((v): v is string => !!v);
        return {
          policy,
          score: 0,
          reviewStatus: "REVIEWED",
          reasons: [
            ...new Set([
              need && request.needs.includes(need.id)
                ? `${need.label} 목적과 관련된 지원`
                : `${field.label} 분야의 검수된 지원 경로`,
              ...matched.map(
                (label) =>
                  `${subjectLabel(card.representative.subject, request)}: ${label} 비교`,
              ),
              ...checks.map((label) => `${label} 확인 필요`),
            ]),
          ],
          tags: [
            ...card.tags.map(
              (tag) =>
                `${subjectLabel(tag.subject, request)} · ${tag.eligibility === "ELIGIBLE" ? "입력 기준 조건 일치" : tag.eligibility === "INELIGIBLE" ? "입력 조건 불일치" : "추가 확인 필요"}`,
            ),
            ...(card.representative.availability === "UNKNOWN"
              ? ["신청기간 확인 필요"]
              : []),
            ...(card.checksNeeded.some((u) => !u.resolvableByQuestion)
              ? ["정책 기준 확인 필요"]
              : []),
          ],
        };
      }),
    };
    if (request.phase !== "RESULTS") return verified;
    // Exclude every current rule-backed policy before the provisional service truncates.
    // A known failed condition must never reappear as an unreviewed alternative.
    const reviewedIds = new Set(relevant.map((p) => p.id));
    const pending = await recommendProvisional(
      { ...request, ruleAnswers: [] },
      { excludePolicyIds: reviewedIds },
    );
    const extra = pending.policies
      .filter((item) => !reviewedIds.has(item.policy.id))
      .map(markCheckRequired);
    const policies = [...verified.policies, ...extra].slice(0, 20);
    return {
      ...verified,
      method: policies.some((item) => item.reviewStatus === "CHECK_REQUIRED")
        ? "MIXED"
        : "VERIFIED",
      policies,
      candidateCount: verified.candidateCount + pending.candidateCount,
      top5: policies.slice(0, 5).map((item) => item.policy.id),
    };
  };
}
