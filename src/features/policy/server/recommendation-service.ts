import { evaluateRecommendation } from "../recommendation/engine.ts";
import { bindFact, factKey, validateRequest } from "../recommendation/facts.ts";
import { RECOMMENDATION_FIELDS } from "../recommendation/intake.ts";
import { DISTRICTS_BY_REGION } from "../public/districts.ts";
import type {
  FactValue,
  QuestionDefinition,
  Request as EngineRequest,
  Result,
} from "../recommendation/types.ts";
import type { PublicPolicy } from "../public/types.ts";
import type { RecommendationCatalog } from "./recommendation-release.ts";

export type RecommendationWireRequest = Omit<
  EngineRequest,
  "mode" | "evaluatedAt"
>;
export type RecommendationResponse = {
  result: Result;
  questions: QuestionDefinition[];
  policies: PublicPolicy[];
  coverage: RecommendationCatalog["coverage"];
};
export const RECOMMENDATION_CATEGORIES = RECOMMENDATION_FIELDS.map(
  (field) => field.id,
);
export class RecommendationRequestError extends Error {
  constructor() {
    super("invalid-recommendation-request");
  }
}
function invalid(): never {
  throw new RecommendationRequestError();
}
function object(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !allowed.includes(key))) invalid();
  return record;
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}
function valueShape(value: unknown) {
  const record = object(value, [
    "kind",
    "value",
    "min",
    "max",
    "minInclusive",
    "maxInclusive",
    "unit",
    "earliest",
    "latest",
  ]);
  switch (record.kind) {
    case "CODE":
      object(value, ["kind", "value"]);
      if (!text(record.value)) invalid();
      break;
    case "BOOLEAN":
      object(value, ["kind", "value"]);
      if (typeof record.value !== "boolean") invalid();
      break;
    case "NUMBER_RANGE":
      object(value, [
        "kind",
        "min",
        "max",
        "minInclusive",
        "maxInclusive",
        "unit",
      ]);
      if (
        !text(record.unit) ||
        [record.min, record.max].some(
          (n) => n !== null && (typeof n !== "number" || !Number.isFinite(n)),
        )
      )
        invalid();
      break;
    case "DATE_RANGE":
      object(value, ["kind", "earliest", "latest"]);
      if (!text(record.earliest) || !text(record.latest)) invalid();
      break;
    default:
      invalid();
  }
}
function parseRequest(input: unknown, evaluatedAt: string): EngineRequest {
  const request = object(input, [
    "revision",
    "category",
    "selectedChildren",
    "subjectsComplete",
    "householdId",
    "needs",
    "answers",
    "phase",
    "questionCount",
    "view",
    "residence",
    "childProfiles",
  ]);
  if (
    !Number.isSafeInteger(request.revision) ||
    !Number.isSafeInteger(request.questionCount) ||
    !text(request.category) ||
    !RECOMMENDATION_CATEGORIES.includes(
      request.category as (typeof RECOMMENDATION_CATEGORIES)[number],
    ) ||
    !text(request.householdId) ||
    !Array.isArray(request.selectedChildren) ||
    !request.selectedChildren.every(text) ||
    !Array.isArray(request.needs) ||
    request.needs.length > 30 ||
    !request.needs.every(text) ||
    !Array.isArray(request.answers) ||
    request.answers.length > 300
  )
    invalid();
  if (request.childProfiles !== undefined) {
    if (
      !Array.isArray(request.childProfiles) ||
      request.childProfiles.length > 30
    )
      invalid();
    const currentYear = new Date(evaluatedAt).getUTCFullYear();
    const ids = new Set<string>();
    for (const value of request.childProfiles) {
      const child = object(value, ["id", "sex", "birthYear"]);
      if (
        !text(child.id) ||
        ids.has(child.id) ||
        !request.selectedChildren.includes(child.id) ||
        !["MALE", "FEMALE", null].includes(child.sex as string | null) ||
        (child.birthYear !== null &&
          (typeof child.birthYear !== "number" ||
            !Number.isInteger(child.birthYear) ||
            child.birthYear < 1900 ||
            child.birthYear > currentYear))
      )
        invalid();
      ids.add(child.id);
    }
    if (ids.size !== request.selectedChildren.length) invalid();
    // Year precision and the selected list do not establish a birthday, exact
    // age or the household's actual total number of children.
  }
  if (request.residence !== undefined) {
    const residence = object(request.residence, [
      "region",
      "district",
      "basis",
      "reference",
    ]);
    if (
      typeof residence.region !== "string" ||
      typeof residence.district !== "string" ||
      residence.basis !== "REGISTERED_RESIDENCE" ||
      residence.reference !== "CURRENT" ||
      (residence.region === ""
        ? residence.district !== ""
        : !Object.hasOwn(DISTRICTS_BY_REGION, residence.region) ||
          (residence.district !== "" &&
            !DISTRICTS_BY_REGION[residence.region].includes(
              residence.district,
            )))
    )
      invalid();
    // This exploration scope is not a dated eligibility Fact. Approved rules
    // require an explicit semantic mapping before residence can affect eligibility.
  }
  for (const answer of request.answers) {
    const a = object(answer, [
      "key",
      "recordedAt",
      "questionId",
      "questionVersion",
      "active",
      "state",
      "value",
      "source",
    ]);
    const key = object(a.key, ["attribute", "subject", "basis", "reference"]);
    const subject = object(key.subject, ["kind", "id"]);
    if (
      ![
        key.attribute,
        key.basis,
        key.reference,
        subject.id,
        a.recordedAt,
        a.questionId,
        a.questionVersion,
      ].every(text) ||
      (a.active !== undefined && typeof a.active !== "boolean")
    )
      invalid();
    if (a.state === "PROVIDED") valueShape(a.value);
    else if ("value" in a || "source" in a) invalid();
  }
  try {
    return validateRequest({
      ...request,
      mode: "PUBLIC",
      evaluatedAt,
    } as EngineRequest);
  } catch {
    invalid();
  }
}
function sameValue(a: FactValue, b: FactValue): boolean {
  if (a.kind !== b.kind) return false;
  return (
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(a).every(
      ([key, value]) =>
        (b as unknown as Record<string, unknown>)[key] === value,
    )
  );
}
export function createRecommendationService({
  loadCatalog,
  now = () => new Date(),
}: {
  loadCatalog: () => Promise<RecommendationCatalog>;
  now?: () => Date;
}) {
  return async (input: unknown): Promise<RecommendationResponse> => {
    const request = parseRequest(input, now().toISOString());
    const loaded = await loadCatalog();
    const purposes = new Set(
      loaded.catalog.policies
        .filter((policy) => policy.category === request.category)
        .flatMap((policy) => policy.paths.flatMap((path) => path.purposes)),
    );
    // Registered user preferences remain valid before policy review is complete.
    // They never create policy purposes, rules or publication authority.
    for (const need of RECOMMENDATION_FIELDS.find(
      (field) => field.id === request.category,
    )?.needs ?? [])
      purposes.add(need.id);
    if (request.needs.some((need) => !purposes.has(need))) invalid();
    for (const answer of request.answers) {
      const question = loaded.catalog.questions.find(
        (q) =>
          q.id === answer.questionId && q.version === answer.questionVersion,
      );
      if (
        !question ||
        (answer.key.subject.kind === "HOUSEHOLD"
          ? answer.key.subject.id !== request.householdId
          : !request.selectedChildren.includes(answer.key.subject.id))
      )
        invalid();
      const expected = bindFact(question.fact, {
        beneficiary: answer.key.subject,
        household: { kind: "HOUSEHOLD", id: request.householdId },
      });
      if (
        (question.fact.subject === "BENEFICIARY" &&
          answer.key.subject.kind !== "CHILD") ||
        factKey(expected) !== factKey(answer.key) ||
        (answer.state === "PROVIDED" &&
          !question.options.some((option) =>
            sameValue(option.value, answer.value),
          ))
      )
        invalid();
    }
    const result = evaluateRecommendation(loaded.catalog, request);
    const visible = new Set(result.cards.map((card) => card.policyId));
    return {
      result,
      questions: loaded.catalog.questions,
      policies: loaded.policies.filter((policy) => visible.has(policy.id)),
      coverage: loaded.coverage,
    };
  };
}

export async function readRecommendationRequest(
  request: Request,
): Promise<unknown> {
  const limit = 128 * 1024;
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit))
    invalid();
  if (!request.body) invalid();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        invalid();
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    invalid();
  } finally {
    reader.releaseLock();
  }
}

export function recommendationErrorResponse(error: unknown): Response {
  return Response.json(
    {
      error:
        error instanceof RecommendationRequestError
          ? "invalid-recommendation-request"
          : "recommendation-data-unavailable",
    },
    {
      status: error instanceof RecommendationRequestError ? 400 : 503,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
