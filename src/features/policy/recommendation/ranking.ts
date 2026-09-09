import { evaluateExpression } from "./eligibility.ts";
import { bindFact, factKey } from "./facts.ts";
import type {
  Card,
  Context,
  Expression,
  FeatureEvaluation,
  PathResult,
  Policy,
  PolicyPath,
  Request,
} from "./types.ts";
const emptyFeature = (
  value: FeatureEvaluation["value"],
): FeatureEvaluation => ({
  value,
  reasonCodes: [],
  evidenceRefs: [],
  usedAnswerKeys: [],
  unknowns: [],
});
export function calculateNeedScore(
  path: PolicyPath,
  needs: string[],
): FeatureEvaluation {
  if (!needs.length) return emptyFeature("NOT_USED");
  if (!path.purposeEvidence.length || !path.purposes.length)
    return emptyFeature("UNKNOWN");
  return {
    ...emptyFeature(
      path.purposes.some((p) => needs.includes(p)) ? "MATCH" : "OTHER",
    ),
    evidenceRefs: path.purposeEvidence,
    reasonCodes: ["POLICY_PURPOSE"],
  };
}
function refs(expression: Expression): string[] {
  return expression.kind === "PREDICATE"
    ? [expression.ruleId]
    : expression.kind === "NOT"
      ? refs(expression.child)
      : expression.kind === "ALL" || expression.kind === "ANY"
        ? expression.children.flatMap(refs)
        : [];
}
export function enabledFeatures(
  policies: Policy[],
  request: Request,
): Set<string> {
  const active = request.answers.filter(
    (a) => a.active !== false && a.state === "PROVIDED",
  );
  const enabled = new Set<string>();
  for (const policy of policies)
    for (const path of policy.paths)
      for (const [name, feature] of Object.entries(path.features ?? {})) {
        const rules = policy.rules.filter((r) =>
          refs(feature.expression).includes(r.id),
        );
        if (
          rules.some((r) =>
            active.some(
              (a) =>
                a.key.attribute === r.fact.attribute &&
                a.key.basis === r.fact.basis &&
                a.key.reference === r.fact.reference,
            ),
          )
        )
          enabled.add(name);
      }
  return enabled;
}
export function calculateFeature(
  policy: Policy,
  path: PolicyPath,
  name: "timing" | "lifeStage" | "delivery",
  context: Context,
  enabled: Set<string>,
): FeatureEvaluation {
  if (!enabled.has(name)) return emptyFeature("NOT_USED");
  const feature = path.features?.[name];
  if (!feature?.evidenceRefs.length) return emptyFeature("UNKNOWN");
  const result = evaluateExpression(feature.expression, policy.rules, context);
  return {
    ...result,
    value:
      result.value === "TRUE"
        ? "MATCH"
        : result.value === "FALSE"
          ? "OTHER"
          : "UNKNOWN",
    evidenceRefs: [
      ...new Set([...result.evidenceRefs, ...feature.evidenceRefs]),
    ],
  };
}
export const calculateTimingScore = (
  p: Policy,
  path: PolicyPath,
  c: Context,
  enabled: Set<string>,
) => calculateFeature(p, path, "timing", c, enabled);
export const calculateLifeStageScore = (
  p: Policy,
  path: PolicyPath,
  c: Context,
  enabled: Set<string>,
) => calculateFeature(p, path, "lifeStage", c, enabled);
export const calculateDeliveryScore = (
  p: Policy,
  path: PolicyPath,
  c: Context,
  enabled: Set<string>,
) => calculateFeature(p, path, "delivery", c, enabled);
export function calculateUrgencyScore(
  path: PolicyPath,
  request: Request,
): number[] {
  const deadline = path.deadline ? Date.parse(path.deadline) : NaN;
  return request.view === "CURRENT" &&
    path.availability === "OPEN" &&
    path.availabilityEvidence.length &&
    Number.isFinite(deadline) &&
    deadline > Date.parse(request.evaluatedAt)
    ? [0, deadline]
    : [1, 0];
}
export function calculatePolicyScore(
  policy: Policy,
  path: PolicyPath,
  context: Context,
  request: Request,
  enabled: Set<string>,
): { features: FeatureEvaluation[]; rank: number[] } {
  const features = [
    calculateNeedScore(path, request.needs),
    calculateTimingScore(policy, path, context, enabled),
    calculateLifeStageScore(policy, path, context, enabled),
    calculateDeliveryScore(policy, path, context, enabled),
  ];
  return {
    features,
    rank: [
      ...features.map((f) =>
        f.value === "MATCH" || f.value === "NOT_USED"
          ? 0
          : f.value === "UNKNOWN"
            ? 1
            : 2,
      ),
      ...calculateUrgencyScore(path, request),
    ],
  };
}
export function compareRank(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    if (a[i] !== b[i]) return (a[i] ?? 0) - (b[i] ?? 0);
  return 0;
}
const lexical = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const comparePaths = (a: PathResult, b: PathResult): number =>
  compareRank(a.rank, b.rank) ||
  lexical(a.pathId, b.pathId) ||
  lexical(JSON.stringify(a.subject), JSON.stringify(b.subject));
/** Diversity changes ties only; a household path is never counted as every child. */
export function rankPolicies(cards: Card[]): Card[] {
  const remaining = [...cards].sort(
    (a, b) =>
      compareRank(a.representative.rank, b.representative.rank) ||
      lexical(a.policyId, b.policyId),
  );
  const output: Card[] = [];
  const children = new Map<string, number>();
  const purposes = new Map<string, number>();
  const childIds = (card: Card) => [
    ...new Set(
      card.pathResults
        .filter(
          (r) =>
            r.subject.kind === "CHILD" && r.eligibility.value !== "INELIGIBLE",
        )
        .map((r) => r.subject.id),
    ),
  ];
  const coverage = (card: Card) => {
    const ids = childIds(card);
    return ids.length
      ? Math.min(...ids.map((id) => children.get(id) ?? 0))
      : Infinity;
  };
  while (remaining.length) {
    const rank = remaining[0].representative.rank;
    const ties = remaining.filter(
      (card) => compareRank(card.representative.rank, rank) === 0,
    );
    ties.sort((a, b) => {
      const ca = coverage(a),
        cb = coverage(b);
      return (
        (ca === cb ? 0 : ca < cb ? -1 : 1) ||
        (purposes.get(a.representative.purpose) ?? 0) -
          (purposes.get(b.representative.purpose) ?? 0) ||
        lexical(a.representative.purpose, b.representative.purpose) ||
        lexical(a.policyId, b.policyId)
      );
    });
    const selected = ties[0];
    remaining.splice(remaining.indexOf(selected), 1);
    output.push(selected);
    for (const id of childIds(selected))
      children.set(id, (children.get(id) ?? 0) + 1);
    purposes.set(
      selected.representative.purpose,
      (purposes.get(selected.representative.purpose) ?? 0) + 1,
    );
  }
  return output;
}
/** Whether a question fact is actually supplied for this binding. */
export const hasProvidedFact = (
  context: Context,
  ref: import("./types.ts").FactRef,
) =>
  context.answers.some(
    (a) =>
      a.active !== false &&
      a.state === "PROVIDED" &&
      factKey(a.key) === factKey(bindFact(ref, context)),
  );
