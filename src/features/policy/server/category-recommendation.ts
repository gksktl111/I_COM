import {
  activeBankAnswers,
  getBankQuestions,
  validBankRegion,
  type BankAnswer,
  type BankContext,
} from "../recommendation/category-bank.ts";
import { RECOMMENDATION_FIELDS } from "../recommendation/intake.ts";
import { matchesInterests, type PublicPolicy } from "../public/types.ts";
import { RecommendationRequestError } from "./recommendation-service.ts";
export type CategoryBankRequest = BankContext & {
  flow: "CATEGORY_BANK_V1";
  revision: number;
  bankAnswers: BankAnswer[];
  phase: "RESULTS";
};
export type CategoryBankResponse = {
  flow: "CATEGORY_BANK_V1";
  revision: number;
  policies: {
    policy: PublicPolicy;
    score: number;
    reasons: string[];
    tags: string[];
  }[];
  candidateCount: number;
};
function invalid(): never {
  throw new RecommendationRequestError();
}
function object(input: unknown, keys: string[]): Record<string, unknown> {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((k) => !keys.includes(k))
  )
    invalid();
  return input as Record<string, unknown>;
}
function text(input: unknown): input is string {
  return typeof input === "string" && input.length > 0 && input.length <= 128;
}
export function parseCategoryBankRequest(
  input: unknown,
  year = new Date().getUTCFullYear(),
): CategoryBankRequest {
  const r = object(input, [
    "flow",
    "revision",
    "category",
    "needs",
    "childProfiles",
    "residence",
    "bankAnswers",
    "phase",
  ]);
  const field = RECOMMENDATION_FIELDS.find((f) => f.id === r.category);
  if (
    r.flow !== "CATEGORY_BANK_V1" ||
    r.phase !== "RESULTS" ||
    !Number.isSafeInteger(r.revision) ||
    (r.revision as number) < 0 ||
    !field ||
    !Array.isArray(r.needs) ||
    r.needs.length > field.needs.length ||
    new Set(r.needs).size !== r.needs.length ||
    !r.needs.every((n) => field.needs.some((x) => x.id === n)) ||
    !Array.isArray(r.childProfiles) ||
    r.childProfiles.length > 30 ||
    !Array.isArray(r.bankAnswers) ||
    r.bankAnswers.length > 300
  )
    invalid();
  const ids = new Set<string>();
  for (const inputChild of r.childProfiles) {
    const child = object(inputChild, ["id", "sex", "birthYear"]);
    if (
      !text(child.id) ||
      !/^[a-zA-Z0-9_-]+$/.test(child.id) ||
      ["HOUSEHOLD", "SELF", "PARTNER", "OTHER_FAMILY", "CHILD"].includes(
        child.id,
      ) ||
      ids.has(child.id) ||
      !["MALE", "FEMALE", null].includes(child.sex as string | null) ||
      (child.birthYear !== null &&
        (!Number.isInteger(child.birthYear) ||
          (child.birthYear as number) < 1900 ||
          (child.birthYear as number) > year))
    )
      invalid();
    ids.add(child.id);
  }
  if (r.residence !== undefined) {
    const home = object(r.residence, [
      "region",
      "district",
      "basis",
      "reference",
    ]);
    if (
      typeof home.region !== "string" ||
      typeof home.district !== "string" ||
      home.region.length > 128 ||
      home.district.length > 128 ||
      home.basis !== "REGISTERED_RESIDENCE" ||
      home.reference !== "CURRENT" ||
      (home.region === ""
        ? home.district !== ""
        : !validBankRegion(`${home.region}|${home.district}`))
    )
      invalid();
  }
  const keys = new Set<string>();
  for (const inputAnswer of r.bankAnswers) {
    const a = object(inputAnswer, [
      "questionId",
      "subjectId",
      "state",
      "value",
    ]);
    if (
      !text(a.questionId) ||
      !text(a.subjectId) ||
      !["PROVIDED", "DONT_KNOW", "SKIPPED"].includes(a.state as string) ||
      (a.state === "PROVIDED" ? !text(a.value) : "value" in a)
    )
      invalid();
    const key = `${a.questionId}:${a.subjectId}`;
    if (keys.has(key)) invalid();
    keys.add(key);
  }
  const request = r as CategoryBankRequest;
  if (
    activeBankAnswers(request, request.bankAnswers).length !==
    request.bankAnswers.length
  )
    invalid();
  return request;
}
// These are relevance terms, never eligibility rules. Only explicitly selected values contribute.
const needTerms: Record<string, string[]> = {
  "pregnancy-planning": ["임신 준비", "난임", "가임"],
  prenatal: ["임산부", "산전", "임신"],
  "birth-preparation": ["출산", "출생"],
  postpartum: ["산후", "산모"],
  "childcare-costs": ["양육비", "부모급여", "아동수당"],
  daycare: ["어린이집", "보육료"],
  parenting: ["부모교육", "양육", "육아"],
  "after-school": ["방과후", "방과 후", "다함께돌봄"],
  "temporary-care": ["일시", "긴급", "시간제"],
  "night-care": ["야간", "주말", "휴일"],
  checkups: ["검진", "예방", "접종"],
  "medical-costs": ["의료비", "진료비", "치료비"],
  development: ["발달", "재활"],
  uniform: ["교복"],
  "entry-preparation": ["입학", "신입생"],
  learning: ["학습", "교재", "교육 참여"],
  "education-costs": ["교육비", "장학", "교육급여", "학비"],
  "housing-costs": ["주거비", "월세", "임차료"],
  "housing-search": ["주택", "이사", "임대"],
  "living-costs": ["생계", "생활비", "감면"],
  meals: ["급식", "식사", "식료품"],
};
const detailTerms: Record<string, Record<string, string[]>> = {
  P02: {
    PLANNING: ["임신 준비", "난임"],
    PREGNANT: ["임산부", "산전", "임신"],
    POSTPARTUM: ["산후", "산모", "출산 후"],
  },
  B01: {
    HOME: ["가정양육", "양육수당"],
    DAYCARE: ["어린이집", "보육료"],
    KINDERGARTEN: ["유치원", "유아학비"],
    SCHOOL: ["초등", "학생"],
  },
  B03: {
    HOME: ["가정양육", "양육수당"],
    DAYCARE: ["어린이집", "보육료"],
    KINDERGARTEN: ["유치원", "유아학비"],
  },
  D01: {
    WEEKDAY_DAY: ["주간"],
    AFTER_SCHOOL: ["방과후", "방과 후"],
    EVENING_NIGHT: ["야간", "저녁"],
    WEEKEND: ["주말", "공휴일"],
  },
  D02: {
    HOME_VISIT: ["방문", "아이돌봄"],
    CENTER: ["돌봄센터", "지역아동센터"],
    AFTER_SCHOOL: ["방과후", "방과 후"],
  },
  D03: {
    REGULAR: ["정기"],
    OCCASIONAL: ["일시", "시간제"],
    SHORT_TERM: ["단기"],
  },
  H03: { MEDICAL_AID: ["의료급여"], HEALTH_INSURANCE: ["건강보험"] },
  E01: { ENTERING: ["입학", "신입생"], OUT_OF_SCHOOL: ["학교 밖", "학교밖"] },
  E02: {
    ELEMENTARY: ["초등"],
    MIDDLE: ["중학", "중·고"],
    HIGH: ["고등", "중·고"],
  },
  E05: {
    FIRST: ["신입생", "신입학"],
    TRANSFER: ["전학", "전입"],
    REENTRY: ["재입학"],
  },
  L01: {
    OWNED: ["자가"],
    JEONSE: ["전세"],
    MONTHLY_RENT: ["월세"],
    PUBLIC_RENT: ["공공임대"],
    TEMPORARY: ["긴급주거", "임시거처"],
  },
  L03: { MOVING: ["이사", "입주"], CURRENT: ["주거비", "임차료"] },
  L05: {
    CASH: ["현금", "생활비"],
    BILL_REDUCTION: ["감면", "공과금"],
    GOODS_FOOD: ["생필품", "식료품", "급식", "식사"],
  },
};
export function createCategoryRecommendationService({
  loadPolicies,
}: {
  loadPolicies: () => Promise<PublicPolicy[]>;
}) {
  return async (input: unknown): Promise<CategoryBankResponse> => {
    const request = parseCategoryBankRequest(input);
    const field = RECOMMENDATION_FIELDS.find((f) => f.id === request.category)!;
    const all = await loadPolicies();
    const candidates = all.filter((p) =>
      matchesInterests(
        {
          ...p,
          summary: [p.summary, p.purpose_text, p.criteria_text]
            .filter(Boolean)
            .join(" "),
        },
        [field.label],
      ),
    );
    const questions = getBankQuestions(request, request.bankAnswers);
    const policies = candidates
      .map((policy) => {
        const body = [
          policy.name,
          policy.summary,
          policy.purpose_text,
          policy.target_text,
          policy.criteria_text,
          policy.benefit_text,
        ]
          .filter(Boolean)
          .join(" ");
        let score = 10;
        const reasons = [`${field.label} 관련 공개 정책`];
        for (const need of field.needs)
          if (
            request.needs.includes(need.id) &&
            needTerms[need.id]?.some((term) => body.includes(term))
          ) {
            score += 8;
            reasons.push(`${need.label} 목적과 관련된 내용`);
          }
        const signals = new Set<string>();
        for (const answer of request.bankAnswers) {
          if (answer.state !== "PROVIDED") continue;
          const q = questions.find(
            (q) =>
              q.id === answer.questionId && q.subjectId === answer.subjectId,
          )!;
          if (
            detailTerms[answer.questionId]?.[answer.value!]?.some((term) =>
              body.includes(term),
            )
          ) {
            const signal = `${answer.questionId}:${answer.value}`;
            if (!signals.has(signal)) {
              score += 3;
              signals.add(signal);
            }
            reasons.push(
              `${q.subjectLabel}: ${q.options.find((o) => o.value === answer.value)?.label} 응답과 관련된 내용`,
            );
          }
          if (q.answerType === "REGION") {
            const [region, district] = answer.value!.split("|");
            if ((district || region) && body.includes(district || region)) {
              const signal = `school-region:${answer.value}`;
              if (!signals.has(signal)) {
                score += 2;
                signals.add(signal);
              }
              reasons.push(`${q.subjectLabel} 학교 소재지 관련 내용`);
            }
          }
        }
        const location =
          request.residence?.district || request.residence?.region;
        if (
          location &&
          [body, policy.provider_name].join(" ").includes(location)
        ) {
          score += 2;
          reasons.push("입력한 거주 지역 관련 내용");
        }
        return {
          policy,
          score,
          reasons: [...new Set(reasons)],
          tags: ["잠정 추천", "자격·소득·신청기간 추가 확인 필요"],
        };
      })
      .sort(
        (a, b) => b.score - a.score || a.policy.id.localeCompare(b.policy.id),
      );
    return {
      flow: "CATEGORY_BANK_V1",
      revision: request.revision,
      policies: policies.slice(0, 20),
      candidateCount: candidates.length,
    };
  };
}
/** Cache public catalog only; never requests or answers. Publish only a complete traversal. */
export function createCompletePublicCatalogLoader(
  readPage: (input: {
    offset: number;
  }) => Promise<{ items: PublicPolicy[]; nextOffset: number | null }>,
  now = () => Date.now(),
) {
  let cached: { expires: number; items: PublicPolicy[] } | undefined;
  let pending: Promise<PublicPolicy[]> | undefined;
  return async () => {
    if (cached && now() < cached.expires) return cached.items;
    if (pending) return pending;
    pending = (async () => {
      const items = new Map<string, PublicPolicy>();
      let offset = 0;
      for (let pages = 0; pages < 101; pages++) {
        const page = await readPage({ offset });
        for (const item of page.items) items.set(item.id, item);
        if (page.nextOffset === null) {
          const result = [...items.values()];
          cached = { expires: now() + 60_000, items: result };
          return result;
        }
        if (
          !Number.isSafeInteger(page.nextOffset) ||
          page.nextOffset <= offset ||
          page.nextOffset > 100000
        )
          throw new Error("incomplete-public-catalog");
        offset = page.nextOffset;
      }
      throw new Error("incomplete-public-catalog");
    })();
    try {
      return await pending;
    } finally {
      pending = undefined;
    }
  };
}
