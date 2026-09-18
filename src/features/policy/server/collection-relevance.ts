export const COLLECTION_RELEVANCE_VERSION = "policy-relevance-4" as const;
export const COLLECTION_RELEVANCE_CATEGORIES = [
  "임신·출산",
  "양육·보육",
  "돌봄",
  "의료·건강",
  "아동 교육",
  "주거·생활지원",
] as const;

type CollectionCategory = (typeof COLLECTION_RELEVANCE_CATEGORIES)[number];
type Evidence = { field: string; excerpt: string; rule: string };

export type CollectionPolicyRelevance = {
  version: typeof COLLECTION_RELEVANCE_VERSION;
  status: "RELATED" | "UNRELATED" | "REVIEW";
  categories: CollectionCategory[];
  evidence: Evidence[];
  conditionChecks: string[];
  reason: string;
};

const excludedClause =
  /제외|미지원|지원하지|해당하지|대상.{0,8}아[님닌]|불가|구비서류|제출서류|증빙|사례\s*참고/;
const pregnancyTarget = /임신|임산부|임부|산모|산후|출산|난임|불임|신생아|출생아|예비부모/;
const pregnancyBenefit = /임신|산전|산후|출산|난임|불임|분만|산모|신생아|출생.{0,8}(?:지원|축하|이용권)/;
const parentingTarget = /영아|영유아|유아|아동|어린이|양육자|부모|한부모|가정위탁|입양/;
const parentingBenefit = /양육|보육|육아|어린이집|아이돌봄|부모급여|부모수당|아동수당|가정위탁|입양/;
const careBenefit =
  /돌봄|간병|가사.{0,8}(?:지원|서비스)|활동지원|방문.{0,8}(?:돌봄|요양|간호|목욕|가사)|재가.{0,8}(?:돌봄|요양|서비스)|요양.{0,8}(?:서비스|급여)|안부.{0,8}(?:확인|서비스)|일상생활.{0,8}(?:지원|서비스)/;
const healthBenefit =
  /의료비|진료비|치료비|수술비|입원비|약제비|검사비|투석비|건강보험료|진단서.{0,8}비용|영양제.{0,8}(?:지원|제공)|검진|예방접종|진료|수술|의료.{0,8}(?:지원|서비스)|치료.{0,8}(?:지원|서비스)|건강관리|방문간호|정신건강.{0,8}(?:상담|치료|서비스|지원)|심리.{0,8}(?:치료|상담|치유)|발달.{0,8}(?:검사|재활|치료)|(?:물리|작업|언어|운동|기능)\s*재활|보장구|보조기기|의료기기/;
const childTarget =
  /아동|어린이|영유아|유아|유치원|초등|중학생|중학교|고등학생|고등학교|학교밖청소년|청소년|미성년|(?<![\d.])(?:만\s*)?(?:[0-9]|1[0-7])\s*세/;
const schoolBenefit = /교육|학비|학습|학업|급식|교복|장학|입학|수업|수강|교재|학용품|졸업앨범|진학|통학/;
const universityOnly = /대학생|대학원|대학교|대학\s*재학|국가장학금|희망사다리|고졸\s*후학습자/;
const livingBenefit =
  /주거비|월세|전세|임차료|임대료|이사비|이주비|주택.{0,8}(?:공급|임대|구입|개량|수리)|집수리|주거.{0,8}(?:지원|안정|개선)|난방비|냉방비|연료비|월동비|월동기.{0,8}지원|전기요금|가스요금|수도요금|상.?하수도.{0,8}(?:요금|감면)|에너지바우처|연탄|단열|창호|보일러|가스시설|금속배관|생계비|생활비|생계보조수당|생활안정.{0,8}지원|정주생활지원금|자립수당|자산형성.{0,12}적립금|양곡|쌀.{0,8}(?:지원|할인)|식료품|생필품|도시락|반찬|식사.{0,8}(?:지원|배달)|급식.{0,8}지원|기저귀|생리용품|종량제봉투|긴급구호비|재해위로금|교통비|택시요금|귀향\s*여비|이.?미용.{0,8}(?:지원|서비스)|필수생활.{0,8}(?:물품|용품|지원)/;
const obviousOutside =
  /창업|스타트업|벤처|소상공인|중소[ㆍ·]?기업|수출|광업|산업.{0,8}(?:기술|설비|장비)|농업.{0,8}(?:시설|장비|경영)|어업.{0,8}(?:시설|장비|경영)|축산.{0,8}(?:시설|장비|경영)|대학(?:생|원|교).{0,12}(?:장학|등록금|교육)|장례|화장장|공공근로|취업.{0,8}(?:교육|훈련|장려)|직업\s*훈련/;
const clearNonTagBenefit =
  /정보화\s*교육|컴퓨터.{0,8}교육|신문.{0,8}(?:구독|제공)|도서.{0,8}(?:배송|대출)|(?:유료)?방송.{0,8}(?:시청료|이용료)|음식물.{0,12}(?:처리기|감량기)|민원.{0,8}수수료|카드.{0,8}(?:발급|수수료)|등록증.{0,8}발급|권익옹호|문화.{0,8}(?:강좌|활동|이용권)|음악.{0,8}(?:활동|교육|교실|아카데미)|체육.{0,8}(?:활동|강좌)/;
const strongNonTagTitle =
  /정보화\s*교육|(?:소리|전자)신문|무인민원발급|복지카드.{0,8}(?:발급|수수료)|등록증\s*발급|음식물.{0,12}(?:처리기|감량기)|음악재활|우수선수.{0,8}활동지원|자동차.{0,8}(?:종합)?검사비|재활용.{0,12}(?:수거|인센티브)/;
const businessTarget =
  /중소[ㆍ·]?기업|소상공인|사업자|사업체|법인|기업체|수출기업|농업법인|어업법인|축산업체/;
const individualBeneficiary = /근로자|종사자|임직원|가족|가구|주민|개인/;
const unclearBenefit =
  /별도\s*안내|추후\s*안내|상세.{0,8}(?:문의|참조)|지원\s*내용.{0,8}(?:없음|미정)|^(?:지원|지원금\s*지급|서비스\s*제공|사업\s*지원|위문|위문품\s*지원)$/;

function positiveText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .split(/[\n\r;。※]|\.(?:\s|$)/)
    .map((part) => part.trim())
    .filter((part) => part && !excludedClause.test(part))
    .join(" ");
}

function directEvidence(
  target: string,
  benefit: string,
  rule: string,
): Evidence[] {
  return [
    { field: "target_text", excerpt: target, rule },
    { field: "benefit_text", excerpt: benefit, rule },
  ];
}

function result(
  status: CollectionPolicyRelevance["status"],
  categories: CollectionCategory[],
  evidence: Evidence[],
  conditionChecks: string[],
  reason: string,
): CollectionPolicyRelevance {
  return {
    version: COLLECTION_RELEVANCE_VERSION,
    status,
    categories,
    evidence,
    conditionChecks,
    reason,
  };
}

/** 신규 수집 원문의 여섯 탐색 태그 관련성만 평가하며 개인별 수급 자격은 판정하지 않는다. */
export function evaluateCollectionRelevance(
  display: Record<string, unknown>,
): CollectionPolicyRelevance {
  const name = positiveText(display.name);
  const targetSource =
    typeof display.target_text === "string" ? display.target_text.trim() : "";
  const benefitSource =
    typeof display.benefit_text === "string" ? display.benefit_text.trim() : "";
  const target = positiveText(display.target_text);
  const benefit = positiveText(display.benefit_text);
  const purpose = positiveText(display.purpose_text);
  const context = `${name} ${target} ${benefit} ${purpose}`;
  if (!target || !benefit) {
    const checks = [];
    if (!target) checks.push("실제 지원 대상 원문 확인");
    if (!benefit) checks.push("실제 지원 내용 원문 확인");
    return result(
      "REVIEW",
      [],
      [],
      checks,
      "실제 지원 대상 또는 지원 내용이 없어 여섯 태그 관련성을 판단할 수 없습니다.",
    );
  }

  if (/복지관\s*운영지원|복지센터\s*운영지원/.test(name)) {
    return result(
      "REVIEW",
      [],
      [],
      ["개인에게 실제 제공되는 급여·서비스 내용 확인"],
      "기관 운영 방향만으로 개인에게 제공되는 여섯 태그 급여를 확정할 수 없습니다.",
    );
  }
  if (/빈집/.test(name) && /아무도\s*거주하지|미거주|방치된\s*빈집/.test(target)) {
    return result(
      "REVIEW",
      [],
      [],
      ["실제 거주가구의 주거 지원 경로 확인"],
      "빈집 정비의 최종 수혜자가 실제 거주가구인지 원문만으로 확정할 수 없습니다.",
    );
  }
  if (businessTarget.test(target) && !individualBeneficiary.test(target)) {
    return result(
      "UNRELATED",
      [],
      directEvidence(targetSource, benefitSource, "대상·지원 내용이 여섯 태그 범위 밖에 해당"),
      [],
      "사업체·법인을 직접 지원하는 사업으로 개인 대상 여섯 태그에는 부합하지 않습니다.",
    );
  }

  const categories = new Set<CollectionCategory>();
  if (
    pregnancyTarget.test(`${name} ${target}`) &&
    pregnancyBenefit.test(`${name} ${benefit}`)
  )
    categories.add("임신·출산");
  if (
    parentingTarget.test(`${name} ${target}`) &&
    parentingBenefit.test(`${name} ${benefit}`)
  )
    categories.add("양육·보육");
  if (careBenefit.test(benefit)) categories.add("돌봄");
  if (healthBenefit.test(benefit)) categories.add("의료·건강");
  if (
    childTarget.test(target) &&
    schoolBenefit.test(`${name} ${benefit}`) &&
    (!universityOnly.test(`${name} ${target}`) || childTarget.test(target))
  )
    categories.add("아동 교육");
  const incidentalTrainingExpense =
    /취업|창업|직업|일자리|셀러|훈련/.test(context) &&
    /교통비|중식/.test(benefit) &&
    !/주거비|월세|전세|임차료|난방비|생활비|생계비|의료비/.test(benefit);
  if (livingBenefit.test(`${benefit} ${purpose}`) && !incidentalTrainingExpense)
    categories.add("주거·생활지원");

  if (categories.size > 0) {
    const labels = COLLECTION_RELEVANCE_CATEGORIES.filter((category) =>
      categories.has(category),
    );
    return result(
      "RELATED",
      labels,
      directEvidence(
        targetSource,
        benefitSource,
        `대상·지원 교차 근거: ${labels.join(", ")}`,
      ),
      ["연령·소득·거주·기간 등 세부 자격 조건 확인"],
      "실제 지원 대상과 지원 내용이 하나 이상의 여섯 태그에 부합합니다. 개인별 자격 판정은 아닙니다.",
    );
  }

  const educationUnclear =
    /학생|장학|학비|교복/.test(context) &&
    schoolBenefit.test(`${name} ${benefit}`) &&
    !childTarget.test(target) &&
    !universityOnly.test(`${name} ${target}`);
  if (educationUnclear || unclearBenefit.test(benefit)) {
    return result(
      "REVIEW",
      [],
      [],
      [
        educationUnclear
          ? "교육 대상 학교급 확인"
          : "실제 지급 형태·품목·용도 확인",
      ],
      "표시 원문만으로 실제 지원 범위와 여섯 태그 관련성을 확정할 수 없습니다.",
    );
  }

  if (
    clearNonTagBenefit.test(benefit) ||
    strongNonTagTitle.test(name) ||
    obviousOutside.test(`${name} ${target}`)
  ) {
    return result(
      "UNRELATED",
      [],
      directEvidence(
        targetSource,
        benefitSource,
        "대상·지원 내용이 여섯 태그 범위 밖에 해당",
      ),
      [],
      "구체적인 지원 내용이 확인되지만 현재 여섯 태그에는 부합하지 않습니다.",
    );
  }

  return result(
    "REVIEW",
    [],
    [],
    ["새 표현의 실제 급여 내용과 여섯 태그 관련성 확인"],
    "자동 분류 사전에 없는 지원 내용이므로 제외하지 않고 검토가 필요합니다.",
  );
}
