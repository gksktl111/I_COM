import type {
  Context,
  Eligibility,
  Evaluation,
  Expression,
  FactKey,
  FactValue,
  Policy,
  PolicyPath,
  Predicate,
  Truth,
  Unknown,
} from "./types.ts";
import { bindFact, factKey, validateValue } from "./facts.ts";

function result(
  value: Truth,
  reasonCodes: string[] = [],
  evidenceRefs: string[] = [],
  usedAnswerKeys: FactKey[] = [],
  unknowns: Unknown[] = [],
): Evaluation<Truth> {
  return { value, reasonCodes, evidenceRefs, usedAnswerKeys, unknowns };
}
function unknown(
  kind: Unknown["kind"],
  rule?: Predicate,
  key?: FactKey,
  resolvableByQuestion = false,
): Evaluation<Truth> {
  return result(
    "UNKNOWN",
    [kind],
    rule?.evidenceRefs ?? [],
    [],
    [
      {
        kind,
        ...(rule ? { ruleId: rule.id } : {}),
        ...(key ? { factKey: key } : {}),
        resolvableByQuestion,
      },
    ],
  );
}
function valueIdentity(value: FactValue): string {
  switch (value.kind) {
    case "CODE":
    case "BOOLEAN":
      return JSON.stringify([value.kind, value.value]);
    case "DATE_RANGE":
      return JSON.stringify([value.kind, value.earliest, value.latest]);
    case "NUMBER_RANGE":
      return JSON.stringify([
        value.kind,
        value.min,
        value.max,
        value.min === null ? false : value.minInclusive,
        value.max === null ? false : value.maxInclusive,
        value.unit,
      ]);
  }
}

function compare(rule: Predicate, value: FactValue): Truth {
  if (rule.operator === "EQ")
    return (value.kind === "CODE" && typeof rule.expected === "string") ||
      (value.kind === "BOOLEAN" && typeof rule.expected === "boolean")
      ? value.value === rule.expected
        ? "TRUE"
        : "FALSE"
      : "UNKNOWN";
  if (rule.operator === "IN_SET")
    return value.kind === "CODE" && rule.expected.length > 0
      ? rule.expected.includes(value.value)
        ? "TRUE"
        : "FALSE"
      : "UNKNOWN";
  if (rule.operator === "DATE_RANGE") {
    if (value.kind !== "DATE_RANGE") return "UNKNOWN";
    validateValue({
      kind: "DATE_RANGE",
      earliest: rule.earliest,
      latest: rule.latest,
    });
    if (value.earliest >= rule.earliest && value.latest <= rule.latest)
      return "TRUE";
    return value.latest < rule.earliest || value.earliest > rule.latest
      ? "FALSE"
      : "UNKNOWN";
  }
  if (value.kind !== "NUMBER_RANGE" || value.unit !== rule.unit)
    return "UNKNOWN";
  validateValue({ ...rule, kind: "NUMBER_RANGE" });
  const a = value.min ?? -Infinity,
    b = value.max ?? Infinity;
  const lo = rule.min ?? -Infinity,
    hi = rule.max ?? Infinity;
  const lowerInside =
    a > lo ||
    (a === lo &&
      (lo === -Infinity || !value.minInclusive || rule.minInclusive));
  const upperInside =
    b < hi ||
    (b === hi && (hi === Infinity || !value.maxInclusive || rule.maxInclusive));
  if (lowerInside && upperInside) return "TRUE";
  if (
    b < lo ||
    a > hi ||
    (b === lo && (!value.maxInclusive || !rule.minInclusive)) ||
    (a === hi && (!value.minInclusive || !rule.maxInclusive))
  )
    return "FALSE";
  return "UNKNOWN";
}

export function evaluatePredicate(
  rule: Predicate,
  context: Context,
): Evaluation<Truth> {
  if (rule.sourceVersion !== context.sourceVersion)
    return unknown("STALE_RULE", rule);
  if (
    rule.review === "UNREVIEWED" ||
    (rule.review === "FIXTURE" && context.mode !== "FIXTURE")
  )
    return unknown("UNREVIEWED_RULE", rule);
  if (!rule.evidenceRefs.length || rule.evidenceRefs.some((ref) => !ref.trim()))
    return unknown("POLICY_MISSING", rule);
  const key = bindFact(rule.fact, context);
  const answers = context.answers.filter(
    (answer) => answer.active !== false && factKey(answer.key) === factKey(key),
  );
  if (!answers.length) return unknown("USER_MISSING", rule, key, true);
  const identities = new Set(
    answers.map((answer) =>
      answer.state === "PROVIDED" ? valueIdentity(answer.value) : answer.state,
    ),
  );
  const canAsk = !answers.some((answer) =>
    ["SKIPPED", "DONT_KNOW", "EXPLICIT_NOT_APPLICABLE"].includes(answer.state),
  );
  if (identities.size > 1)
    return {
      ...unknown("USER_CONFLICT", rule, key, canAsk),
      usedAnswerKeys: [key],
    };
  const answer = answers[0];
  if (answer.state !== "PROVIDED")
    return {
      ...unknown("USER_MISSING", rule, key, canAsk),
      usedAnswerKeys: [key],
    };
  let value: Truth;
  try {
    validateValue(answer.value);
    value = compare(rule, answer.value);
  } catch {
    value = "UNKNOWN";
  }
  if (value === "UNKNOWN")
    return {
      ...unknown("USER_PRECISION", rule, key, true),
      usedAnswerKeys: [key],
    };
  return result(
    value,
    [value === "TRUE" ? "RULE_MATCH" : "RULE_MISMATCH"],
    rule.evidenceRefs,
    [key],
  );
}

export function evaluateExpression(
  expr: Expression,
  rules: Predicate[],
  context: Context,
): Evaluation<Truth> {
  if (!expr || expr.kind === "UNRESOLVED") return unknown("POLICY_MISSING");
  if (expr.kind === "PREDICATE") {
    const found = rules.filter((rule) => rule.id === expr.ruleId);
    return found.length === 1
      ? evaluatePredicate(found[0], context)
      : unknown("POLICY_MISSING");
  }
  if (expr.kind === "NOT") {
    const child = evaluateExpression(expr.child, rules, context);
    return {
      ...child,
      value:
        child.value === "UNKNOWN"
          ? "UNKNOWN"
          : child.value === "TRUE"
            ? "FALSE"
            : "TRUE",
    };
  }
  if (!expr.children.length) return unknown("POLICY_MISSING");
  const children = expr.children.map((child) =>
    evaluateExpression(child, rules, context),
  );
  const values = children.map((child) => child.value);
  const value: Truth =
    expr.kind === "ALL"
      ? values.includes("FALSE")
        ? "FALSE"
        : values.includes("UNKNOWN")
          ? "UNKNOWN"
          : "TRUE"
      : values.includes("TRUE")
        ? "TRUE"
        : values.includes("UNKNOWN")
          ? "UNKNOWN"
          : "FALSE";
  return {
    value,
    reasonCodes: [...new Set(children.flatMap((child) => child.reasonCodes))],
    evidenceRefs: [...new Set(children.flatMap((child) => child.evidenceRefs))],
    usedAnswerKeys: [
      ...new Map(
        children
          .flatMap((child) => child.usedAnswerKeys)
          .map((key) => [factKey(key), key]),
      ).values(),
    ],
    unknowns: [
      ...new Map(
        children
          .flatMap((child) => child.unknowns)
          .map((item) => [JSON.stringify(item), item]),
      ).values(),
    ],
  };
}

export function evaluateEligibility(
  policy: Policy,
  path: PolicyPath,
  context: Context,
): Evaluation<Eligibility> {
  let evaluation: Evaluation<Truth>;
  if (
    policy.sourceVersion !== context.sourceVersion ||
    policy.releaseSourceVersion !== policy.sourceVersion
  )
    evaluation = unknown("STALE_RULE");
  else if (
    policy.release === "HIDDEN" ||
    (policy.release === "FIXTURE" && context.mode !== "FIXTURE")
  )
    evaluation = unknown("UNREVIEWED_RULE");
  else evaluation = evaluateExpression(path.expression, policy.rules, context);
  if (!path.complete)
    evaluation = {
      ...evaluation,
      value: "UNKNOWN",
      reasonCodes: [
        ...new Set([...evaluation.reasonCodes, "INCOMPLETE_PATHS"]),
      ],
      unknowns: [
        ...evaluation.unknowns,
        { kind: "INCOMPLETE_PATHS", resolvableByQuestion: false },
      ],
    };
  return {
    ...evaluation,
    value:
      evaluation.value === "TRUE"
        ? "ELIGIBLE"
        : evaluation.value === "FALSE"
          ? "INELIGIBLE"
          : "UNKNOWN",
  };
}
