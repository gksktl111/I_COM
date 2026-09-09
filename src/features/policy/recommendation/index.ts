export {
  evaluateRecommendation,
  evaluateCards,
  validateCatalog,
  selectUsablePolicies,
} from "./engine.ts";
export {
  evaluatePredicate,
  evaluateExpression,
  evaluateEligibility,
} from "./eligibility.ts";
export {
  normalizeAnswers,
  replaceAnswer,
  activateAnswers,
  factKey,
} from "./facts.ts";
export {
  rankPolicies,
  calculatePolicyScore,
  calculateNeedScore,
  calculateLifeStageScore,
  calculateTimingScore,
  calculateDeliveryScore,
  calculateUrgencyScore,
} from "./ranking.ts";
export {
  buildQuestionCandidates,
  simulateQuestionImpact,
  selectNextQuestion,
} from "./questions.ts";
export type * from "./types.ts";
