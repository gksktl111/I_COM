export type PublicPolicy = {
  reviewedScope?: { categories: string[]; fingerprint: string };
  id: string;
  name: string;
  summary: string | null;
  provider_name: string | null;
  purpose_text: string | null;
  target_text: string | null;
  criteria_text: string | null;
  benefit_text: string | null;
  application_method_text: string | null;
  application_period_text: string | null;
  required_documents_text: string | null;
  reception_text: string | null;
  contact_text: string | null;
  source_url: string | null;
  application_url: string | null;
  updated_at: string | null;
};
export const INTERESTS = [
  "임신·출산",
  "양육·보육",
  "돌봄",
  "의료·건강",
  "아동 교육",
  "주거·생활지원",
];
export const FAMILY = ["임신 준비 중", "임신 중", "출산 후", "자녀 양육 중"];
export const HOUSEHOLD = [
  "맞벌이 가구",
  "한부모 가구",
  "조손 가구",
  "다문화 가구",
  "위탁 가정",
  "장애 관련 가족 구성원 있음",
];
export const REGIONS = [
  "서울특별시",
  "부산광역시",
  "대구광역시",
  "인천광역시",
  "광주광역시",
  "대전광역시",
  "울산광역시",
  "세종특별자치시",
  "경기도",
  "강원특별자치도",
  "충청북도",
  "충청남도",
  "전북특별자치도",
  "전라남도",
  "경상북도",
  "경상남도",
  "제주특별자치도",
];
export type ChildInfo = {
  id: number;
  precision: "date" | "month" | "unknown";
  birth: string;
  care: string;
};
export type PolicyConditions = {
  region: string;
  district: string;
  family: string[];
  pregnancy: string;
  interests: string[];
  children: ChildInfo[];
  childrenComplete: string;
  totalChildren: string;
  household: string[];
  incomeBasis: string;
  income: string;
  welfare: string[];
  birthTiming: string;
  careTime: string;
  careType: string;
  healthNeed: string;
  housingType: string;
  livingNeed: string;
};
export function initialConditions(): PolicyConditions {
  return {
    region: "",
    district: "",
    family: [],
    pregnancy: "unknown",
    interests: [],
    children: [],
    childrenComplete: "unknown",
    totalChildren: "",
    household: [],
    incomeBasis: "unknown",
    income: "unknown",
    welfare: [],
    birthTiming: "unknown",
    careTime: "unknown",
    careType: "unknown",
    healthNeed: "unknown",
    housingType: "unknown",
    livingNeed: "unknown",
  };
}
const patterns: Record<string, RegExp> = {
  "임신·출산": /임신|출산|산모|신생아|임산부/,
  "양육·보육": /양육|보육|아동|어린이|부모급여|유아/,
  돌봄: /돌봄|돌보미|방과후/,
  "의료·건강": /의료|건강|검진|진료|예방|재활/,
  "아동 교육":
    /^(?=[\s\S]*(?:아동|어린이|청소년|초등|중학생|고등학생|초중고|중고등|유아|학생|자녀))(?=[\s\S]*(?:교육비|학비|학습|학용품|교재|교복|장학|통학|수업료|입학준비|교육급여|교육 참여))[\s\S]*$/,
  "주거·생활지원": /주거|주택|생활|임대|생계|급식/,
};
export function policyText(policy: PublicPolicy) {
  return [
    policy.name,
    policy.summary,
    policy.provider_name,
    policy.target_text,
    policy.benefit_text,
  ]
    .filter(Boolean)
    .join(" ");
}
export function matchesInterests(policy: PublicPolicy, interests: string[]) {
  return (
    !interests.length ||
    interests.some((interest) => patterns[interest]?.test(policyText(policy)))
  );
}
export function safePolicyUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function selectInterest(
  value: PolicyConditions,
  interest: string,
): PolicyConditions {
  if (value.interests.length === 1 && value.interests[0] === interest)
    return value;
  return {
    ...value,
    interests: INTERESTS.includes(interest) ? [interest] : [],
    family: [],
    pregnancy: "unknown",
    birthTiming: "unknown",
    careTime: "unknown",
    careType: "unknown",
    healthNeed: "unknown",
    housingType: "unknown",
    livingNeed: "unknown",
    children: value.children.map((child) => ({ ...child, care: "unknown" })),
  };
}

export function questionProfile(value: PolicyConditions) {
  const interest = value.interests[0];
  return {
    children:
      interest !== "임신·출산" ||
      value.family.some((family) =>
        ["출산 후", "자녀 양육 중"].includes(family),
      ),
    household: ["양육·보육", "돌봄", "아동 교육", "주거·생활지원"].includes(
      interest,
    ),
    childcare: ["양육·보육", "아동 교육"].includes(interest),
  };
}

export function interestError(value: PolicyConditions): string | null {
  return value.interests.length === 1 && INTERESTS.includes(value.interests[0])
    ? null
    : "관심 있는 지원 분야를 하나 선택해 주세요.";
}

export function conditionError(
  value: PolicyConditions,
  today = new Date().toISOString().slice(0, 10),
): string | null {
  const missingInterest = interestError(value);
  if (missingInterest) return missingInterest;
  if (
    questionProfile(value).children &&
    value.totalChildren !== "" &&
    (!/^\d+$/.test(value.totalChildren) || Number(value.totalChildren) > 30)
  ) {
    return "실제 총자녀 수는 0부터 30 사이의 정수로 입력해 주세요.";
  }
  for (const [index, child] of (questionProfile(value).children
    ? value.children
    : []
  ).entries()) {
    if (!child.birth || child.precision === "unknown") continue;
    const date =
      child.precision === "month" ? `${child.birth}-01` : child.birth;
    const parsed = new Date(`${date}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      date.startsWith("0000") ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date ||
      date > today
    ) {
      return `자녀 ${index + 1}의 출생 정보는 오늘 이전의 유효한 날짜로 입력해 주세요.`;
    }
  }
  return null;
}
