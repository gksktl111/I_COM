/** Service scope only: this classifier never evaluates an applicant's eligibility. */
export const POLICY_RELEVANCE_VERSION = "policy-relevance-3" as const;
export const POLICY_RELEVANCE_CATEGORIES = {
  pregnancy: "임신·출산",
  parenting: "양육·보육",
  care: "아동 돌봄",
  health: "아동 의료·건강",
  education: "아동 교육",
  family: "가족 지원",
  housing: "신혼·자녀가구 주거",
} as const;

export type PolicyRelevance = {
  version: typeof POLICY_RELEVANCE_VERSION;
  status: "RELATED" | "UNRELATED" | "REVIEW";
  categories: string[];
  evidence: Array<{ field: string; excerpt: string; rule: string }>;
  reason: string;
};

type Category = keyof typeof POLICY_RELEVANCE_CATEGORIES;
const child =
  /아동|어린이|영유아|영아|유아|유치원|초등|중학생|중학교|고등학생|고등학교|고등(?=\s*[,·])|중[·ㆍ,\s]*고교|고[1-3](?!\d)|초[·ㆍ,\s]*중[·ㆍ,\s]*고|중[·ㆍ\s]*고등학교|청소년|미성년/;
const housing = /주거|주택|전세|월세|임대|주택구입|주택 구입/;
const familyHousing =
  /신혼|다자녀|출산가구|출산 가구|신생아|자녀.{0,15}(가구|가정)|자녀가구|자녀 가구|아동(?:이|을)?\s*(?:있는|포함된|양육하는)?\s*(?:가구|가정)/;
const action =
  /지원|수당|급여|급식|장려금|교육|돌봄|보육|양육|상담|(?<!안)치료|검진|접종|보호|제공|감면|대출|공급/;
// A negative/administrative clause cannot prove positive service scope. Skipping
// the whole clause intentionally favors REVIEW over interpreting legal exceptions.
const incidental =
  /제외|미지원|지원하지|지원하지는|지원대상.{0,8}아[님닌]|지원 대상.{0,8}아[님닌]|해당하지|대상.{0,8}아[님닌]|불가|제한|중복|구비서류|제출서류|증빙|문의처|여부와?\s*관계없이|사례\s*참고/;
const topicRules: Array<[Category, RegExp]> = [
  [
    "pregnancy",
    /임신|임산부|출산|산모|산후|난임|모자보건|출생아|출생\s*축하|첫돌|돌맞이|신생아|임부|산전|예비부모|난자.{0,12}냉동|불임|첫만남\s*이용권/,
  ],
  [
    "parenting",
    /육아|양육|보육|어린이집|부모급여|부모수당|아동수당|입양|가정위탁/,
  ],
  [
    "care",
    /아이돌봄|아이 돌봄|아동.{0,12}돌봄|초등.{0,12}돌봄|지역아동센터|다함께돌봄/,
  ],
  [
    "family",
    /한부모|조손|다문화가족|다문화 가족|가족센터|가족상담|가족 상담|가족돌봄|가족 돌봄|다자녀|다둥이|[둘셋넷]째아|소년소녀가정|가족휴식|부모\s*상담|자녀\s*장려금/,
  ],
];
// These are service purposes/populations, never an applicant eligibility filter.
// Broad housing/disability/welfare titles alone remain unknown. A documented
// adult/producer purpose supplies the negative evidence that missing child words cannot.
const outsideRules: Array<[string, RegExp]> = [
  [
    "기업·창업·상공업 지원",
    /창업|스타트업|벤처|소상공인|소공인|중소[ㆍ·]?기업|중견기업|여성기업|장애인기업|창조기업|투자기업|기업.{0,12}(?:기술|금융|자금|보증|판로|매출|사업화)|전통시장|상점가|M&A|액셀러레이팅/,
  ],
  [
    "산업·수출·생산 기반 지원",
    /수출|해외진출|광산|광업|조광권|플랜트|산업재산권|지식재산|특허|사업화|생산자\s*단체|공급업체|제조업체/,
  ],
  [
    "농림축수산 생산자 지원",
    /농업인|농민|농가|농업경영|농업법인|영농|농협|농어가|농산물|농축산물|농식품|축산|가축|과수|인삼|특용작물|화훼|GAP|귀농|귀어|귀산촌|임업|임산물|산림소유자|산림사업|조림|숲가꾸기|어업|어선|어구|어촌(?:정착|지도자)|수산|양식업|양식장|염전|천일염/,
  ],
  [
    "노인 전용 지원",
    /노인|어르신|경로당|경로수당|경로\s*목욕|기초연금|장수(?:수당|축하|노인)|효도수당|효행장려금|노부모|봉양수당|치매|노후생활|노후준비|장기\s*요양(?:급여|기관|등급)|(?:만\s*)?(?:6[0-9]|[7-9]\d|100)\s*세\s*이상/,
  ],
  [
    "보훈·군인 지원",
    /유공자|보훈|고엽제|전상군경|공상군경|보국수훈|무공수훈|독립유공|현충일|특수임무수행자|제대군인|전역예정|군인.{0,12}(?:재해|금연)|장병.{0,12}(?:취업|인권)/,
  ],
  ["장례·사망자 지원", /장례|화장장|화장\s*장려|장제처리|무연고.{0,8}사망/],
  [
    "대학·대학원 교육 지원",
    /대학생|대학원|대학\s*재학|대학교.{0,12}재학|폴리텍대학|국가장학금|인문100년|고졸\s*후학습자|희망사다리/,
  ],
  [
    "일반 취업·근로 지원",
    /공공근로|자활근로|취업|재취업|구직|직업\s*(?:훈련|능력)|고용(?:안정|유지|장려|지원|허가)|일자리|산재근로|실업급여|근로자|노무제공자|내일배움카드|인턴제|체불청산|운전면허/,
  ],
  [
    "성인 생활·자립 지원",
    /성인\s*장애인.{0,15}(?:전용|한정|만\s*(?:지원|대상))|성인만.{0,15}장애|성인용\s*기저귀|자립준비\s*청년|보호\s*종료.{0,15}자립|청년.{0,15}(?:월세|이사비|통장|저축|자격증|응시료|문화예술패스)|(?:만\s*)?(?:1[89]|[2-5]\d)\s*세\s*이상/,
  ],
];
const sectorRules = new Set([
  "기업·창업·상공업 지원",
  "산업·수출·생산 기반 지원",
  "농림축수산 생산자 지원",
]);
const familyBenefit =
  /(?:임신|임산부|산모|산후|출산|신생아|영유아|아동|육아|양육|보육|난임).{0,30}(?:휴가|휴직|급여|수당|양육비|의료비|진료비|치료비|검진|돌봄|도우미|대체인력|지원금)|(?:육아|출산)\s*(?:기|전후)|아이\s*돌봄|부모급여|자녀\s*양육비|자녀장려금/;

// Identify children themselves, including explicit age paths. Neither a generic
// student nor an adult's child proves childhood. Remove law titles and benefit
// qualification labels before looking for an actual child population.
const postCare =
  /보호\s*종료|자립\s*준비\s*청년|보호.{0,8}(?:종결|만료)|만기\s*퇴소|자립지원정착금|퇴소청소년.{0,8}자립|자립지원\s*전담기관/;
const schoolChild =
  /초등|중학생|중학교|고등학생|고등학교|초[·ㆍ,\s]*중[·ㆍ,\s]*고/;
function childPopulation(text: string): boolean {
  if (postCare.test(text) && !schoolChild.test(text)) return false;
  const population = text
    .replace(/[「｢][^」｣]*[」｣]/g, "")
    .replace(/(?:장애)?아동수당|장애\(아동\)수당|아동복지법|초중등교육법/g, "");
  if (child.test(population)) return true;
  // A range starting below adulthood, or a child upper bound. Bound numeric
  // tokens so 65세/119세 cannot match 5세/19세, and 세대/세제곱 are not ages.
  return /(?<![\d.])(?:만\s*)?(?:[0-9]|1[0-7])\s*세?\s*(?:이상\s*)?[~～〜–-]\s*(?:만\s*)?\d{1,2}\s*세(?![대제])|(?<![\d.])(?:만\s*)?(?:[0-9]|1[0-8])\s*세\s*(?:이하|미만)|(?<![\d.])(?:만\s*)?19\s*세\s*미만|(?<![\d.])(?:만\s*)?(?:[0-9]|1[0-7])\s*세\s*이상/.test(
    population,
  );
}

const childBenefits: Array<[Category, RegExp]> = [
  [
    "health",
    /건강|의료|진료|입원|(?<!안)치료|재활|발달|검진|접종|구강|불소|치아|심리|정서|상담|위생|생리용품/,
  ],
  [
    "education",
    /교육|학비|학습|학업|급식|교복|장학|입학|수업|수강|학원비|교재|학용품|공부방|영어|졸업앨범|진학|진로|자격증.{0,8}응시료/,
  ],
  // Culture/sports and basic daily protection belong to existing 아동 돌봄.
  [
    "care",
    /돌봄|보호|생활지원|생활자|생계|부식|피복|식사|식당|간식|급간식|결식|문화|체육|스포츠|체험|수련|놀이|활동지원|교통|버스|이용권|청소년증|복지시설|공동생활\s*가정|복지\s*지원|청소년단체|청소년\s*활동|성장지원금|생일|안심팔찌|난방비/,
  ],
];
function childServiceCategories(
  population: string,
  benefit: string,
): Category[] {
  if (!childPopulation(population)) return [];
  // A minor next-of-kin is incidental to a funeral; school history is not a
  // current child benefit. General work/producer funding is not child care.
  if (/장례|장제|안치료|사망자/.test(benefit)) return [];
  return childBenefits
    .filter(([, pattern]) =>
      pattern.test(benefit.replace(/[「｢][^」｣]*[」｣]/g, "")),
    )
    .map(([key]) => key);
}

// 영안실 안치료 is a mortuary storage fee, not medical treatment (치료).
function categoriesFor(text: string, childServices = true): Category[] {
  // Business incubators use 보육 without providing childcare.
  text = text.replace(/(?:창업|기업)\s*보육(?:실|센터)?|보육실/g, "");
  const result = topicRules
    .filter(([, pattern]) => pattern.test(text))
    .map(([key]) => key);
  if (
    child.test(text) &&
    /건강|의료|진료|입원|(?<!안)치료|재활|발달|검진|접종|장애|보청기/.test(text)
  )
    result.push("health");
  if (
    child.test(text) &&
    /유치원|교육|학비|학습|급식|교복|장학|입학|수업료/.test(text)
  )
    result.push("education");
  if (
    child.test(text) &&
    /교통비|버스|동행카드|긴급구호|용품|이용권/.test(text)
  )
    result.push("care");
  if (/방과후학교|교복|입학준비금/.test(text)) result.push("education");
  if (childServices) result.push(...childServiceCategories(text, text));
  if (housing.test(text) && familyHousing.test(text)) result.push("housing");
  return result;
}

function positiveClauses(value: unknown): string[] {
  if (typeof value !== "string") return [];
  let excludedSection = false;
  return (
    value
      // Remove only an unambiguous excluded adult subset; retain ambiguous
      // parenthetical child exclusions rather than turn them affirmative.
      .replace(/\(성인\s*제외\)/g, "")
      .split(/[\n\r;。※]|\.(?:\s|$)/)
      .map((part) => part.trim())
      .filter((clause) => {
        if (!clause) return false;
        if (incidental.test(clause)) {
          if (
            /(?:제외|미지원|제한).{0,8}(?:대상|사항)|(?:대상|지원).{0,8}(?:제외|제한)\s*[:：]?$/.test(
              clause,
            )
          )
            excludedSection = true;
          return false;
        }
        return !excludedSection;
      })
  );
}

export function evaluatePolicyRelevance(
  display: Record<string, unknown>,
): PolicyRelevance {
  const context = [display.name, display.target_text]
    .filter((value) => typeof value === "string")
    .join(" ");
  // Adult post-care services retain their existing classification. A minimum
  // working age does not turn general employment/training/saving into a child
  // service, and a land-development fee is not school tuition.
  const childServices =
    !postCare.test(String(display.name ?? "")) &&
    !/대체초지조성비/.test(context) &&
    (!postCare.test(context) ||
      positiveClauses(display.target_text).some(childPopulation));
  const ageOnlyWork =
    /취업|구직|직업\s*훈련|근로자|청년.{0,8}(?:저축|통장)|청년성장프로젝트/.test(
      context,
    );
  const evidence: PolicyRelevance["evidence"] = [];
  const candidates = new Map<string, Set<Category>>();
  let outside = false;
  let sectorOutside = false;
  let titleOutside = false;
  // Provenance matters: documents, agencies, criteria and arbitrary metadata are
  // not positive evidence of whom or what a service supports.
  for (const field of [
    "name",
    "target_text",
    "benefit_text",
    "purpose_text",
    "summary",
  ]) {
    const value = display[field];
    if (typeof value !== "string") continue;
    for (const clause of positiveClauses(value)) {
      // Preserve the full evidence clause so its matched topic and context remain visible.
      const excerpt = clause;
      if (field === "name" || field === "target_text") {
        for (const [label, pattern] of outsideRules) {
          if (!pattern.test(clause)) continue;
          // Youth housing can contain a newlywed path disclosed only on detail
          // fetch. The title-only pass must retain it for that inspection.
          if (
            field === "name" &&
            label === "성인 생활·자립 지원" &&
            /청년/.test(clause) &&
            housing.test(clause)
          )
            continue;
          outside = true;
          if (field === "name") titleOutside = true;
          if (sectorRules.has(label)) sectorOutside = true;
          evidence.push({ field, excerpt, rule: `범위 밖: ${label}` });
        }
      }
      if (field !== "name" && field !== "target_text" && !action.test(clause))
        continue;
      for (const category of categoriesFor(clause, childServices)) {
        const matches = candidates.get(field) ?? new Set<Category>();
        matches.add(category);
        candidates.set(field, matches);
        evidence.push({
          field,
          excerpt,
          rule: `${field === "name" ? "관련 주제" : "검토 단서"}: ${POLICY_RELEVANCE_CATEGORIES[category]}`,
        });
      }
    }
  }
  const categories = new Set<Category>(candidates.get("name"));
  const target = candidates.get("target_text") ?? new Set<Category>();
  const benefit = candidates.get("benefit_text") ?? new Set<Category>();
  const targetText = positiveClauses(display.target_text).join(" ");
  const benefitText = positiveClauses(display.benefit_text).join(" ");
  // 자녀 is a relationship, not proof of childhood (for example, adult
  // descendants of veterans). Only explicit child populations support these paths.
  const directChildTarget =
    childServices &&
    positiveClauses(display.target_text).some(
      (clause) =>
        childPopulation(clause) && (!ageOnlyWork || child.test(clause)),
    );
  if (directChildTarget) {
    for (const category of [
      "parenting",
      "care",
      "health",
      "education",
    ] as Category[])
      target.add(category);
    for (const category of childServiceCategories(
      positiveClauses(display.target_text).filter(childPopulation).join(" "),
      benefitText,
    ))
      benefit.add(category);
  }
  // A benefit can itself explicitly state both recipient and service (e.g.
  // scholarships with separate school and university amounts). Keep the original
  // clause as evidence; generic 학생/자녀 and purpose-only prose are insufficient.
  for (const clause of positiveClauses(display.benefit_text)) {
    if (
      !childServices ||
      !(
        action.test(clause) ||
        (/장학/.test(String(display.name)) && /(?:천?원|만원)/.test(clause))
      )
    )
      continue;
    const direct = childServiceCategories(
      clause,
      /장학/.test(String(display.name)) ? clause + " 장학" : clause,
    );
    if (!direct.length) continue;
    for (const category of direct) {
      target.add(category);
      benefit.add(category);
    }
    evidence.push({
      field: "benefit_text",
      excerpt: clause,
      rule: "아동 본인 대상·지원 명시",
    });
  }
  if (familyHousing.test(targetText) && housing.test(benefitText)) {
    target.add("housing");
    benefit.add("housing");
  }
  const titleText = positiveClauses(display.name).join(" ");
  if (familyHousing.test(targetText) && housing.test(titleText)) {
    categories.add("housing");
    evidence.push({ field: "name", excerpt: titleText, rule: "주거 사업명" });
    evidence.push({
      field: "target_text",
      excerpt: targetText,
      rule: "주거 지원의 신혼·자녀가구 대상 경로",
    });
  }
  for (const category of target) {
    if (!benefit.has(category)) continue;
    categories.add(category);
    // Include both original fields when their agreement, rather than a title,
    // establishes scope. This also handles a mixed newlywed housing pathway.
    for (const [field, excerpt] of [
      ["target_text", targetText],
      ["benefit_text", benefitText],
    ]) {
      evidence.push({
        field,
        excerpt,
        rule: `대상·지원 교차 근거: ${POLICY_RELEVANCE_CATEGORIES[category]}`,
      });
    }
  }
  // Employer/farmer benefits can truly support pregnancy/parenting. Conversely,
  // a producer grant does not become family support from a welfare aside in a
  // long description. A family-service title or actual family benefit is needed.
  if (
    (sectorOutside || /사업주|근로자|노동자/.test(targetText)) &&
    familyBenefit.test(benefitText)
  ) {
    for (const category of categoriesFor(benefitText)) categories.add(category);
    evidence.push({
      field: "benefit_text",
      excerpt: benefitText,
      rule: "사업주·근로자 대상의 실제 임신·양육 지원 경로",
    });
  }
  const explicitFamilyService =
    categoriesFor(titleText).length > 0 ||
    familyBenefit.test(benefitText) ||
    /자녀\s*양육비|아이\s*돌봄방|영유아.{0,12}돌봄수요/.test(
      targetText + " " + benefitText,
    );
  const sectorOnly =
    sectorOutside &&
    !explicitFamilyService &&
    !(categories.has("housing") && familyHousing.test(targetText));
  if (sectorOnly) categories.clear();
  const related = categories.size > 0;
  // An adult's employment/age is compatible with a parenting benefit; mixed
  // housing and documented target+benefit paths likewise remain in scope.
  const confirmedPath =
    [...target].some((category) => benefit.has(category)) ||
    (categories.has("housing") && familyHousing.test(targetText)) ||
    (/육아|출산|보육/.test(titleText) && familyBenefit.test(titleText));
  const excludedChildTarget =
    !directChildTarget &&
    typeof display.target_text === "string" &&
    /(?:아동|어린이|청소년)\s*(?:은|는)?\s*\([^)]*(?:제외|미지원|불가)[^)]*\)/.test(
      display.target_text,
    );
  const conflict =
    excludedChildTarget ||
    (outside &&
      !(sectorOutside && explicitFamilyService) &&
      !confirmedPath &&
      titleOutside);
  const potentialFamilyPath =
    !sectorOnly &&
    !titleOutside &&
    (target.size > 0 || /자녀.{0,12}(?:의료|교육|학비)/.test(titleText)) &&
    !/자립준비\s*청년|보호\s*종료|경제활동.{0,15}중단/.test(targetText);
  const status = related
    ? conflict
      ? "REVIEW"
      : "RELATED"
    : outside && !potentialFamilyPath
      ? "UNRELATED"
      : "REVIEW";
  return {
    version: POLICY_RELEVANCE_VERSION,
    status,
    categories: Object.keys(POLICY_RELEVANCE_CATEGORIES)
      .filter((key) => categories.has(key as Category))
      .map((key) => POLICY_RELEVANCE_CATEGORIES[key as Category]),
    evidence,
    reason:
      status === "RELATED"
        ? "정책명 또는 대상·지원 설명에서 서비스 관련 주제가 확인됩니다. 신청 자격 판정은 아닙니다."
        : status === "UNRELATED"
          ? "정책명 또는 지원대상에 서비스 범위 밖의 전용 사업이 명시되어 있습니다. 신청 자격 판정은 아닙니다."
          : related
            ? "관련 주제와 범위 밖 사업의 근거가 함께 있어 검토가 필요합니다. 신청 자격 판정은 아닙니다."
            : "서비스 관련성을 확정할 근거가 부족하여 검토가 필요합니다. 신청 자격 판정은 아닙니다.",
  };
}
