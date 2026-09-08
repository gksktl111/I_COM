import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePolicyRelevance } from "./relevance.ts";

test("recognizes core family services with Korean source evidence", () => {
  for (const name of [
    "위기임신 및 보호출산 지원",
    "가정양육수당",
    "육아 지원",
    "어린이집 지원",
    "유치원 방과후 지원",
    "아이돌봄서비스",
    "아동 발달재활서비스",
    "초등학생 급식 지원",
    "한부모가족 지원",
    "신혼부부 전세자금 대출",
    "다자녀가구 주거 지원",
  ]) {
    const result = evaluatePolicyRelevance({ name });
    assert.equal(result.status, "RELATED", name);
    assert.ok(result.categories.length);
    assert.deepEqual(result.evidence[0].field, "name");
    assert.equal(result.evidence[0].excerpt, name);
    assert.equal(result.version, "policy-relevance-3");
    assert.match(result.reason, /신청 자격 판정은 아닙니다/);
  }
});

test("generic housing, welfare, health and disability remain reviewable", () => {
  for (const name of [
    "주거급여",
    "국민임대주택 공급",
    "건강검진 지원",
    "생활안정자금",
    "장애인 의료비 지원",
    "청년 월세 지원",
  ]) {
    assert.equal(evaluatePolicyRelevance({ name }).status, "REVIEW", name);
  }
});

test("uses beneficiaries and benefits without inferring one mandatory applicant path", () => {
  const display = {
    name: "건강관리 지원",
    target_text: "임신출산한 결혼이주여성, 배우자, 시부모 등 다문화가족",
    benefit_text: "산모의 산후 건강관리 상담 지원",
    criteria_text: "소득 및 거주 요건 확인 필요",
  };
  const before = structuredClone(display);
  const result = evaluatePolicyRelevance(display);
  assert.equal(result.status, "RELATED");
  assert.ok(result.categories.includes("임신·출산"));
  assert.deepEqual(display, before);
  assert.deepEqual(evaluatePolicyRelevance(display), result);
});

test("explicit industry and adult allowances stay unrelated despite incidental child references", () => {
  for (const name of [
    "어업인 어선 구입자금 지원",
    "참전유공자 명예수당",
    "국가유공자 생활지원",
    "노인 돌봄 지원",
    "장례식장 시설 운영 지원",
  ]) {
    const result = evaluatePolicyRelevance({
      name,
      criteria_text: "자녀 양육 및 아동수당 수급 여부 확인",
      required_documents_text: "자녀 가족관계증명서",
      contact_text: "가족센터 아동복지과",
      benefit_text: "아동 및 임산부 지원 제외",
    });
    assert.equal(result.status, "UNRELATED", name);
    assert.deepEqual(result.categories, []);
  }
});

test("exclusions do not establish relatedness even in target and title", () => {
  for (const phrase of [
    "아동은 지원대상이 아님",
    "신혼부부 제외",
    "임산부는 지원하지 않음",
    "아동 양육수당 중복 수급 제한",
  ]) {
    assert.equal(
      evaluatePolicyRelevance({ name: "생활 지원", target_text: phrase })
        .status,
      "REVIEW",
      phrase,
    );
  }
});

test("distinguishes child disability from explicit adult-only disability and broad disability", () => {
  assert.equal(
    evaluatePolicyRelevance({ name: "장애아동 재활치료 지원" }).status,
    "RELATED",
  );
  assert.equal(
    evaluatePolicyRelevance({
      name: "장애인 지원",
      target_text: "성인 장애인만 지원",
    }).status,
    "UNRELATED",
  );
  assert.equal(
    evaluatePolicyRelevance({ name: "장애인 지원" }).status,
    "REVIEW",
  );
  assert.equal(
    evaluatePolicyRelevance({
      name: "장애인 지원",
      target_text: "성인 장애인과 장애아동",
      benefit_text: "장애아동 재활치료 지원",
    }).status,
    "RELATED",
  );
});

test("conflicting specific topics require review instead of suppressing a child path", () => {
  const result = evaluatePolicyRelevance({
    name: "노인 돌봄 지원 및 아동 돌봄 지원",
  });
  assert.equal(result.status, "REVIEW");
  assert.ok(result.evidence.some((item) => item.rule.startsWith("범위 밖:")));
  assert.ok(result.categories.includes("아동 돌봄"));
});

test("missing and malformed display values do not manufacture evidence", () => {
  assert.equal(evaluatePolicyRelevance({}).status, "REVIEW");
  const result = evaluatePolicyRelevance({
    name: null,
    target_text: ["임신"],
    benefit_text: { text: "아동" },
    summary: 0,
  });
  assert.equal(result.status, "REVIEW");
  assert.deepEqual(result.evidence, []);
});

test("child mentions under multiline exclusion headings are not positive evidence", () => {
  const result = evaluatePolicyRelevance({
    name: "어업인 장비 구입 지원",
    benefit_text: "지원 제외 대상:\n임산부 출산 지원\n아동 보육 지원",
  });
  assert.equal(result.status, "UNRELATED");
  assert.deepEqual(result.categories, []);
});

// Source excerpts captured in the 2026-09-08 local relevance dry run. These are
// regressions for actual lexical false positives, not assumptions about eligibility.
test("v2 excludes documented producer, incubator and veteran purposes despite incidental family words", () => {
  const records = [
    {
      name: "여성기업종합지원센터운영",
      target_text:
        "「여성기업지원에 관한 법률」 제2조에 따른 여성기업 및 (예비)여성창업자를 지원합니다.",
      benefit_text:
        "여성 전용 창업 보육실 입주를 지원합니다.\n여성기업종합지원센터 전국 18개 지역센터 내 여성창업보육실 운영 228개 보육실",
    },
    {
      name: "여성농업인 복지바우처 지원",
      summary:
        "농작업, 가사, 육아를 병행하는 여성농업인에게 바우처(포인트) 지급을 통한 문화 혜택의 기회 제공으로 영농의욕 고취 및 삶의 질 향상 도모",
      target_text:
        "도내 농촌지역 거주, 실제 영농에 종사하는 만20세이상~ 만75세 미만의 여성농업인으로 2025.1.1이전 농업경영체 등록자",
      benefit_text:
        "여성농업인 문화, 여행, 스포츠부문 지원(1인 20만원 : 보조 100%)",
    },
    {
      name: "고엽제환자2세수당",
      summary:
        "고엽제후유증환자의 자녀가 안정된 생활을 할 수 있도록 장애 정도에 따른 수당을 지원합니다.",
      target_text: "고엽제후유증 2세환자를 대상으로 지원합니다.",
      benefit_text:
        "고엽제 후유증 2세 환자의 장애정도에 따라 아래와 같이 지원합니다.",
    },
    {
      name: "어업활동 지원",
      purpose_text:
        "사고, 질병, 교육, 임신 등으로 영어활동이 곤란한 어업인에게 대체인력 채용 비용 지원",
      target_text:
        "사업 지원 대상자격을 갖춘 어업경영체(신청인 : 어업경영체에 등록된 경영주)로 경영주 및 경영주외 어업인",
      benefit_text:
        "최대 12만원(국비 50%, 지방비 30%, 자부담 20%), 1인당 최대 30일(단, 4대중증질환 및 임심출산가구는 최대60일)",
    },
  ];
  for (const display of records) {
    assert.equal(
      evaluatePolicyRelevance(display).status,
      "UNRELATED",
      display.name,
    );
    assert.deepEqual(
      evaluatePolicyRelevance(display).categories,
      [],
      display.name,
    );
  }
});

test("actual monthly rent scheme retains the explicitly supported newlywed pathway", () => {
  const result = evaluatePolicyRelevance({
    name: "관악구 청년 월세 지원사업",
    target_text:
      "관악구 주민등록 및 월세 거주하는 19~39세 무주택 청년 1인 가구 또는 청년 신혼부부 가구",
    benefit_text: "선정자 개인별 계좌이체",
  });
  assert.equal(result.status, "RELATED");
  assert.ok(result.categories.includes("신혼·자녀가구 주거"));
  assert.ok(
    result.evidence.some(
      (item) => item.field === "target_text" && item.excerpt.includes("또는"),
    ),
  );
});

test("newborn target and benefit establish scope even without a recognized title", () => {
  const result = evaluatePolicyRelevance({
    name: "이용권 지급 사업",
    target_text:
      "출생아로서 출생신고되어 정상적으로 주민등록번호를 부여받은 아동을 대상으로 합니다.",
    benefit_text: "(지원금액) 출생아당 200만원 이상의 이용권 지급",
  });
  assert.equal(result.status, "RELATED");
  assert.ok(
    result.evidence.some((item) =>
      item.rule.startsWith("대상·지원 교차 근거:"),
    ),
  );
});

test("child benefit mentions without a supporting target remain reviewable", () => {
  assert.equal(
    evaluatePolicyRelevance({
      name: "생활안정 지원",
      target_text: "일반 사업자",
      benefit_text: "자녀 양육비 지원 사례 참고",
    }).status,
    "REVIEW",
  );
  assert.equal(
    evaluatePolicyRelevance({
      name: "자녀 의료비 지원",
      target_text: "유공자의 자녀",
      benefit_text: "장애 정도에 따른 수당 지원",
    }).status,
    "REVIEW",
  );
});

test("v2 excludes explicit post-care adult services but keeps general welfare references reviewable", () => {
  for (const display of [
    {
      name: "자립지원 전담기관 운영",
      target_text:
        "가정위탁 보호종료 5년이내 자립준비청년 * 아동복지시설 : 아동복지법 제52조 상 아동양육시설, 공동생활가정, 아동일시보호시설",
      benefit_text:
        "생활, 주거, 교육, 취업, 의료 등 자립에 필요한 서비스 지원 및 복지급여, 서비스 연계",
    },
    {
      name: "양곡할인",
      target_text:
        "법정 차상위계층* 법정 차상위계층 지원사업: 차상위계층 건강보험 본인부담 경감, 차상위 장애(아동)수당\n「한부모가족지원법」제5조 및 제5조의2에 따른 지원 대상자 가구",
      benefit_text:
        "복지용 쌀의 할인을 지원합니다.\n생계급여, 의료급여 수급자는 10kg 1포당 2,500원을 개인부담합니다.",
    },
  ])
    assert.equal(
      evaluatePolicyRelevance(display).status,
      display.name === "자립지원 전담기관 운영" ? "UNRELATED" : "REVIEW",
      display.name,
    );
});

// These formerly REVIEW records have affirmative non-service purpose/target
// evidence. v2 intentionally changes that contract; age omission is not evidence.
test("v2 excludes actual business, producer, senior and higher-education services", () => {
  const records = [
    {
      name: "1인 창조기업 지원센터",
      target_text: "1인 창조기업 및 예비창업자",
      benefit_text: "사무공간 제공 및 사업화 지원",
    },
    {
      name: "M&A 활성화 지원",
      target_text: "중소기업",
      benefit_text: "인수합병 상담 및 자금 지원",
    },
    {
      name: "광산 현대화 장비 및 시설 지원",
      target_text: "광업권자 또는 조광권자",
      benefit_text: "광산 장비 구입비 지원",
    },
    {
      name: "농산물 우수관리(GAP) 시설 보완 지원",
      target_text: "농산물우수관리시설로 지정받은 자",
      benefit_text: "시설보완 지원",
    },
    {
      name: "과수분야 스마트팜확산",
      target_text: "과수 재배 농가",
      benefit_text: "ICT 시설 장비 지원",
    },
    {
      name: "100세 장수축하금 지원",
      target_text: "100세 이상 어르신",
      benefit_text: "축하금 지급",
    },
    {
      name: "차상위계층 대상포진 예방접종 지원사업",
      target_text: "울산 중구 거주 65세 이상 차상위계층 어르신",
      benefit_text: "대상포진 예방접종 지원",
    },
    {
      name: "경로 목욕 및 이미용권 지원",
      target_text: "65세 이상 어르신",
      benefit_text: "목욕 및 이미용 이용권 제공",
    },
    {
      name: "고졸 후학습자 장학금 (희망사다리Ⅱ유형)",
      target_text: "대학 재학 중인 고졸 재직자",
      benefit_text: "대학교 등록금 지원",
    },
    {
      name: "공공근로사업",
      target_text: "만18세 이상 실업자 또는 일용근로자",
      benefit_text: "공공 일자리 제공",
    },
    {
      name: "장애인자립자금대여",
      target_text: "19세 이상의 등록장애인",
      benefit_text: "생업자금 융자 지원",
    },
    {
      name: "부산광역시 서구 장수축하물품 지원사업",
      target_text: "100세 어르신(1925년 출생자)",
      benefit_text: "1925년 출생자에게 장수축하물품 지급",
    },
  ];
  for (const display of records) {
    const result = evaluatePolicyRelevance(display);
    assert.equal(result.status, "UNRELATED", display.name);
    assert.deepEqual(result.categories, [], display.name);
    assert.ok(
      result.evidence.some(
        (item) =>
          item.rule.startsWith("범위 밖:") && /[가-힣]/.test(item.excerpt),
      ),
      display.name,
    );
  }
});

test("v2 recognizes collected child health and school wording", () => {
  for (const name of [
    "2세미만 영유아 입원진료비 본인부담금 면제",
    "강동구 초중고 신입생 입학준비금 사업",
    "고등학교 학교급식(조석식)지원",
    "강북구 아동·청소년 동행카드 지원사업",
    "대학병원 아동 진료비 지원",
    "발달장애인 가족휴식지원사업",
    "출생축하용품 지원사업",
  ])
    assert.equal(evaluatePolicyRelevance({ name }).status, "RELATED", name);
});

test("v2 preserves parenting benefits for farmers, employers and young adult parents", () => {
  for (const display of [
    {
      name: "농업인 출산 도우미 지원",
      target_text: "출산한 여성농업인",
      benefit_text: "출산 농가 도우미 비용 지원",
    },
    {
      name: "농번기돌봄지원",
      target_text:
        "주말동안 영유아의 돌봄수요가 있는 농촌지역에서 아이돌봄방을 운영하는 지역농협 및 여성농업인센터",
      benefit_text: "교재, 교구, 급식 및 시설 운영비 지원",
    },
    {
      name: "출산육아기 고용안정장려금",
      target_text: "육아휴직을 부여한 중소기업 사업주",
      benefit_text: "육아휴직 지원금 지급",
    },
    {
      name: "유연근무제 장려금 지원",
      target_text: "유연근무를 활용하는 중소ㆍ중견기업 사업주",
      benefit_text: "육아기 자녀를 둔 근로자는 일반근로자 대비 2배 지원",
    },
    {
      name: "생활안정자금(융자)(이차보전)",
      target_text: "근로자 및 중소기업 사업주",
      benefit_text:
        "자녀양육비: 2,000만 원 한도 내 자녀 1인당 1,000만 원(18세 미만 자녀)",
    },
    {
      name: "청소년 미혼 한부모 자립지원",
      target_text: "20세 이상 24세 이하 청소년 미혼 한부모",
      benefit_text: "아동양육비 지원",
    },
    {
      name: "보육교직원 처우개선 지원",
      target_text: "보육교직원 근로자",
      benefit_text: "보육교직원 수당 지원",
    },
  ])
    assert.equal(
      evaluatePolicyRelevance(display).status,
      "RELATED",
      display.name,
    );
});

test("v2 producer purpose overrides incidental family-welfare descriptions", () => {
  const result = evaluatePolicyRelevance({
    name: "산업 기술 사업화 지원",
    target_text: "중소기업, 다문화가족이 운영하는 기업 포함",
    benefit_text: "양육 관련 제품의 사업화, 시장조사 및 판로개척 지원",
    summary: "육아와 일을 병행하는 기업인의 경영환경 개선",
  });
  assert.equal(result.status, "UNRELATED");
  assert.deepEqual(result.categories, []);
});

test("v2 does not infer exclusive adult scope from general welfare or a mixed title", () => {
  for (const display of [
    {
      name: "생활안정자금",
      target_text: "저소득 주민",
      benefit_text: "생활비 지원",
    },
    {
      name: "건강보험료 및 장기요양보험료 지원",
      target_text: "저소득 가구",
      benefit_text: "보험료 지원",
    },
    {
      name: "장애인 의료비 지원",
      target_text: "등록장애인",
      benefit_text: "의료비 지원",
    },
    {
      name: "양곡할인",
      target_text: "수급자 및 차상위 자활근로 가구, 한부모가족",
      benefit_text: "복지용 쌀 할인",
    },
    { name: "청년 월세 지원" },
  ])
    assert.equal(
      evaluatePolicyRelevance(display).status,
      "REVIEW",
      display.name,
    );
  assert.notEqual(
    evaluatePolicyRelevance({ name: "청년 및 신혼부부 주택 지원" }).status,
    "UNRELATED",
  );
  assert.equal(
    evaluatePolicyRelevance({
      name: "청년 월세 지원",
      target_text: "19세 이상 청년 1인 가구",
      benefit_text: "월세 지원",
    }).status,
    "UNRELATED",
  );
});

test("forest products 임산물 are not pregnancy services", () => {
  for (const display of [
    {
      name: "임산물 수출 지원",
      target_text: "○ 임산물 수출업체 및 생산자",
      benefit_text:
        "○ 박람회, 해외판촉, 바이어 초청, 수출패키지 지원, 해외인증, 수출검역, 이력관리, 수출협의회 및 통합조직 육성, 수출선도조직, 수출특화시설 지원 등",
    },
    {
      name: "임산물 소비촉진 사업 지원",
      target_text: "○ 단기소득임산물 관련 산림청 등록 단체",
      benefit_text:
        "○ 소비촉진 직거래장터 운영\n○ 우수임산물 전시회 지원\n○ 소비촉진 교육지원 등",
    },
  ]) {
    const result = evaluatePolicyRelevance(display);
    assert.equal(result.status, "UNRELATED", display.name);
    assert.deepEqual(result.categories, [], display.name);
    assert.ok(
      result.evidence.some((item) => item.rule.startsWith("범위 밖:")),
      display.name,
    );
  }
  assert.equal(
    evaluatePolicyRelevance({ name: "임산부 건강관리 지원" }).status,
    "RELATED",
  );
});

test("mortuary 안치료 and minor next-of-kin do not turn public funerals into child healthcare", () => {
  for (const display of [
    {
      name: "무연고, 저소득주민을 위한 '공영장례지원'",
      target_text:
        "아동학대로 인해 사망한 자로서 연고자가 구속된 경우 또는 저소득층 사망자의 연고자가 미성년자 또는 장애인으로 장례 처리 능력이 없는 경우",
      benefit_text:
        "영안실 안치료, 운구비, 추모의식에 필요한 장례서비스, 화장 및 봉안 비용 지급 등 공영장례 추진",
    },
    {
      name: "무연고 사망자 공영장례 지원",
      target_text:
        "저소득층 사망자로서 연고자가 미성년자 또는 장애인으로만 구성되어 있어 장례처리 능력이 없는 경우",
      benefit_text:
        "사체 검안비, 운반비, 영안실 안치료, 장례용품 대여비, 화장비용 지원",
    },
  ]) {
    const result = evaluatePolicyRelevance(display);
    assert.equal(result.status, "UNRELATED", display.name);
    assert.deepEqual(result.categories, [], display.name);
  }
  assert.equal(
    evaluatePolicyRelevance({
      name: "의료 지원",
      target_text: "아동",
      benefit_text: "아동 치료비 지원",
    }).status,
    "RELATED",
  );
});

// Actual collected GOV24/Bokjiro records: keep recipient and benefit wording.
test("v3 recovers real child-only and mixed child services", () => {
  const records = [
    {
      sourceId: "23575085-a422-42bd-9420-017912059dd1",
      name: "청소년 상담 서비스 제공",
      target_text: "○ 9세~24세 (위기)청소년",
      benefit_text:
        "○ 위기 청소년에 대한 상담, 긴급 구조, 학업지원, 자할지원 등의 서비스 제공",
    },
    {
      sourceId: "18b5c581-8062-4b03-8604-c2197476dac6",
      name: "수민동장학회 장학금",
      target_text:
        "○ 수민동에 거주하고 있는 고1~고3, 대학생 1·2학년 학생\n- 신청자 중 성적상위 30%, 수민동 거주기간, 가족상황(한부모, 다자녀 등)등의 선발기준에 따라 총점이 높은 학생에게 지급",
      benefit_text:
        "○ 중·고교 학생에게 장학금 연 100만원 지급\n- 추천주체(학교장)의 추천을 받아 수민장학회 심사를 거쳐 장학생 최종 선정",
    },
    {
      sourceId: "805d8111-76da-4a8c-add0-6ab766d9c24f",
      name: "미취학아동 구강관리 지원",
      target_text: "○ 미취학아동, 서초구 만5~6세 아동",
      benefit_text: "○ 개인 및 단체 대상자 충치예방을 위한 불소도포",
    },
    {
      sourceId: "cc29e120-1dbf-4fab-9862-b84da220292f",
      name: "저소득층 아동 체험행사",
      target_text:
        "○「국민기초생활보장법」에 의한 국민기초생활보장 수급자 및 차상위 계층 가정의 아동(만 6~18세 미만)\n\n○「한부모복지법」에 의한 저소득 한부모 가정의 아동(만 6~18세 미만)",
      benefit_text:
        "○ 저소득층 아동 체험행사\n- 관내 저소득층  아동을 대상으로 다양한 체험행사 실시",
    },
    {
      sourceId: "2e94ea1c-d2c5-433c-8170-a971bca14490",
      name: "스포츠 강좌 이용권 지원",
      target_text:
        "○  만5~ 만18세 기초, 차상위가구 유청소년\n- 「국민기초생활보장법」에 따른 생계, 의료, 주거, 교육급여 수급 가구 및 차상위* 계층\n* 차상위 장애, 자활근로, 본인부담경감, 차상위계층 확인서 발급대상(구 우선돌봄차상위)/ 법정 한부모 보호가구",
      benefit_text: "○ 1인당 월 10.5만 원 이내 스포츠강좌 수강료 지원",
    },
    {
      sourceId: "666d34b5-21b7-41ca-9c72-87b7639594a0",
      name: "통합문화이용권(문화누리카드)",
      target_text: "○ 기초생활수급자 및 차상위계층 (6세 이상)",
      benefit_text:
        "○ 통합문화이용권(문화누리카드) 발급\n- 문화누리카드 이용분야: 문화예술 프로그램(영화, 공연, 전시 등) 관람, 도서 또는 음반 구매, 국내 관광(관광지, 숙박, 철도 등), 체육활동(농구, 축구, 야구, 배구 관람 및 체육용품 구매, 체육시설 이용 등)\n- 문화누리카드 지원금액 : 개인당 1매 발급 ('26년 1인당 연 15만 원 지원)\n* 청소년기(13-18세), 준고령기(60-64세) 1만원 추가 지원",
    },
    {
      sourceId: "088a4dcf-d2e0-470c-8302-27bf9f3fd82b",
      name: "아동복지시설 생활자 지원",
      target_text: "○ 입소아동",
      benefit_text: "아동복지설 생활아동 부식비, 피복비 등",
    },
    {
      sourceId: "53f79ea7-01fa-43d4-a8eb-97c2c76d88d2",
      name: "어린이 과일간식 지원사업",
      target_text:
        "「초·중등교육법」 제2조 제1호의 초등학교에 재학 중인 학생 중 다음에 해당하는 자 - 충청북도 초등학교 ‘초등돌봄교실’’을 이용하는 1~2학년 초등학생",
      benefit_text: "1회 150g 내외, 연간 30회 정도(주1~3회 선택)하여 공급",
    },
    {
      sourceId: "36ea950c-4840-4c9a-b43f-2690578624c8",
      name: "저소득구민 명절 위문금 지급 (차상위 아동·청소년 가구)",
      target_text: "동주민센터 추천을 받은 차상위 아동·청소년 250가구",
      benefit_text:
        "지원대상\n- 차상위 아동·청소년 250가구\n\n지원내용\n- 초·중·고 자녀 학용품비 가구당 100,000원 지원\n\n지원시기\n설, 추석 명절\n\n지원방법\n- 동주민센터 추천 명단 수합 후 수급자의 계좌에 입금",
    },
    {
      sourceId: "ecc5649d-888c-4cb4-84ab-59edacfb9c78",
      name: "기장군 장학금 지원",
      target_text:
        "○ 공고일 기준 부모 또는 학생 본인이 주민등록상 연속하여 1년 이상 기장군에 계속 거주하고 있는 자로서 각 장학금 종류의 신청 자격을 충족하는 자",
      benefit_text:
        "○ 기장군 성적우수,복지,다자녀, 특기장학금 지원\n- 대학생(성적우수,복지,다자녀,특기장학금) : 학기 등록금 실제 납부금액(최대 200만원)\n- 초·중·고등학생 (특기장학금): 1인당 50만원",
    },
    {
      sourceId: "2f73b762-cca3-496a-a229-89671694c35a",
      name: "청소년회복지원시설운영",
      target_text: "소년법 처분(제1호 ‘보호자 감호위탁’)을 받은 청소년",
      benefit_text:
        "○위탁 청소년의 보호 및 생활지원\n- 보호 청소년들에게 부모를 대신하여 훈육 및 생활지원(법원결정)\n○위탁 청소년 사회서비스 지원\n- 보호 청소년의 신체･심리･정서적 치유와 회복\n- 보호 청소년의 상담･선도･건전 육성 활동 및 학업, 진로 등 자립 지원\n- 성평등가족부, 법원, 법무부, 노동부 등 관련부처의 청소년 복지･활동 지원체계와 연계협력 강화",
    },
    {
      sourceId: "fd2a7b4c-601e-4804-8720-5e12c7f908fd",
      name: "성북구 청소년미래지원센터 수강료 감면(수급자)",
      target_text:
        "「국민기초생활 보장법」에 의한 수급권자 중 성북구 주민 또는 성북구 소재 교육시설에 재학중인 학생",
      benefit_text:
        "성북구 청소년미래지원센터 수강료 감면\n- 대상 : 「국민기초생활 보장법」에 의한 수급권자 중 성북구 주민 또는 성북구 소재 교육시설에 재학 중 학생\n- 감면율 : 100%",
    },
    {
      sourceId: "d8a25afd-7204-4ab2-97b8-b7194103de91",
      name: "장애인 저소득주민 건강보험료 지원",
      target_text:
        "장기요양보험료를 포함한 국민건강보험료가 보건복지부 장관이 정한 최저 월별 보험료액인자 중 65세이상 노인세대 및 장애인세대 및 18세 이하 세대",
      benefit_text: "건강보험료 전액 지원",
    },
    {
      sourceId: "e56f6134-2454-444f-88f3-cb5dc6025a34",
      name: "물리치료 지원",
      target_text: "○ 물리치료가 필요한 10세 이상 누구나",
      benefit_text:
        "○ 물리치료 제공\n\n○ 대상 : 의과 진료실에서 물리치료 처방을 받은 10세 이상 지역주민\n\n○ 물리치료 내용 : 열치료, 전기치료, 운동치료 등",
    },
    {
      sourceId: "d7ad2538-e2b9-4e4e-9826-25ea2eef7dbf",
      name: "청소년 수련활동 지원",
      target_text: "청소년 일반",
      benefit_text: "수련활동 지원",
    },
    {
      sourceId: "dbf18132-9fc0-4ba8-95a4-bf64f1889ca9",
      name: "취약계층 아동 공부방 꾸미기",
      target_text: "학습환경이 열악한 저소득 초등학생 가구",
      benefit_text: "책상, 의자, 책장 지원(필요시 도배, 장판 추가 지원 가능)",
    },
  ];
  for (const { sourceId, ...display } of records) {
    const result = evaluatePolicyRelevance(display);
    assert.equal(result.status, "RELATED", `${sourceId}: ${display.name}`);
    assert.ok(
      result.evidence.some(
        ({ field }) =>
          field === "name" ||
          field === "target_text" ||
          field === "benefit_text",
      ),
    );
  }
});

test("v3 preserves explicit child exclusions including parenthetical predicates", () => {
  for (const target_text of [
    "아동(지원대상 제외)",
    "아동(제외)",
    "어린이(지원 불가)",
    "청소년(미지원)",
    "아동(지원 대상에서 제외됨)",
    "아동(의료비 지원 불가)",
    "아동(해당 지원에서 제외됨)",
  ]) {
    assert.equal(
      evaluatePolicyRelevance({
        name: "생활 지원",
        target_text,
        benefit_text: "의료비 지원",
      }).status,
      "REVIEW",
      target_text,
    );
    assert.equal(
      evaluatePolicyRelevance({
        name: "아동 의료 지원",
        target_text,
        benefit_text: "의료비 지원",
      }).status,
      "REVIEW",
      target_text,
    );
  }
  assert.equal(
    evaluatePolicyRelevance({
      name: "생활 지원",
      target_text: "아동 및 성인(성인 제외)",
      benefit_text: "의료비 지원",
    }).status,
    "RELATED",
  );
  assert.equal(
    evaluatePolicyRelevance({
      name: "생활 지원",
      target_text: "성인(아동 제외)",
      benefit_text: "의료비 지원",
    }).status,
    "REVIEW",
  );
});

test("v3 does not infer children from generic students, adult descendants, or legal labels", () => {
  for (const target_text of [
    "학생",
    "유공자의 성인 자녀",
    "차상위 장애(아동)수당 수급 가구",
    "「아동복지법」을 참고하는 주민",
  ]) {
    assert.notEqual(
      evaluatePolicyRelevance({
        name: "생활 지원",
        target_text,
        benefit_text: "문화체험 및 장학금 지원",
      }).status,
      "RELATED",
      target_text,
    );
  }
  assert.equal(
    evaluatePolicyRelevance({
      name: "장학금 지원",
      target_text: "대학생만 지원",
      benefit_text: "대학교 등록금 지원",
    }).status,
    "UNRELATED",
  );
});

test("v3 age tokens never match inside older ages, quantities or dates", () => {
  for (const target_text of [
    "65세 이상 어르신",
    "119세 이하",
    "65~75세",
    "165세 미만",
    "10세제곱미터 사용 가구",
    "2015~2024년 출생자",
    "19~39세 청년",
  ]) {
    assert.notEqual(
      evaluatePolicyRelevance({
        name: "생활 지원",
        target_text,
        benefit_text: "문화체험 및 의료비 지원",
      }).status,
      "RELATED",
      target_text,
    );
  }
  for (const target_text of [
    "5~18세",
    "만 6세 이상",
    "만 15 ~ 64세",
    "18세 이하",
    "19세 미만",
  ]) {
    assert.equal(
      evaluatePolicyRelevance({
        name: "진료 지원",
        target_text,
        benefit_text: "의료비 지원",
      }).status,
      "RELATED",
      target_text,
    );
  }
});

test("v3 working ages and post-care terminology do not reopen adult services", () => {
  for (const display of [
    {
      name: "한국폴리텍대학 훈련생 훈련장려금등 지원",
      target_text:
        "15세 이상 미취업자로 폴리텍대학 직업훈련과정을 수강 중인 훈련생",
      benefit_text: "교통비 및 훈련장려금 지급",
    },
    {
      name: "국민취업지원제도",
      target_text: "15세~69세 구직자",
      benefit_text: "취업지원: 심층상담, 직업훈련, 생계안정 지원",
    },
    {
      name: "청년내일저축계좌",
      target_text: "가입연령: 만 15세~39세",
      benefit_text: "근로활동 지속, 교육이수 시 적립금 지급",
    },
    {
      name: "청소년복지시설 퇴소청소년 자립지원수당",
      target_text: "보호 종료 5년 이내 자립 준비 청년",
      benefit_text: "아동 복지 시설 보호 종료 후 자립 수당 지원",
    },
    {
      name: "대체초지조성비 감면",
      target_text: "초지 전용자",
      benefit_text: "「초·중등교육법」에 따른 초등학교 시설 조성비 감면",
    },
  ])
    assert.notEqual(
      evaluatePolicyRelevance(display).status,
      "RELATED",
      display.name,
    );
});

test("v3 keeps mixed services when another path is post-care adulthood", () => {
  assert.equal(
    evaluatePolicyRelevance({
      name: "보호대상아동 생활안정지원",
      target_text: "관내 가정위탁아동(보호연장, 종결 및 초중고)",
      benefit_text: "초중고학생 학습비 지원",
    }).status,
    "RELATED",
  );
  assert.equal(
    evaluatePolicyRelevance({
      name: "심리 지원",
      target_text:
        "청소년상담복지센터에서 심리 상담이 필요하다고 인정한 주민\n자립 준비 청년 및 보호 연장 아동",
      benefit_text: "심리 상담 지원",
    }).status,
    "RELATED",
  );
});

test("v3 real adult post-care records cannot be promoted by facility definitions", () => {
  const records = [
    {
      name: "청소년복지시설 퇴소청소년 자립지원수당",
      target_text:
        "○ 아동 복지 시설 및 위탁 가정에서 아동 본인의 의사에 따라 18세 이후 24세까지 보호 기간을 연장한 사람\n* 대학 재학 등 아동 복지법 제 16조의 3 및 시행령 제 22조에 규정된 별도 사유가 있을 시 25세 이후에도 보호 기간 추가 연장 가능(관련 법 조항 참고)\n\n○ 아동 복지 시설, 가정 위탁 보호 종료 5년 이내 자립 준비 청년\n* 아동 복지 시설 : 아동 복지법 제 52조 상 아동 양육 시설, 공동 생활 가정, 아동 일시 보호 시설, 학대 피해 아동 쉼터, 아동 보호 치료 시설\n** 단, 소년법 제 32조 제 1항 제 6호에 따른 보호 처분으로 아동 복지 시설에서 보호 종료된 경우에는 아동 복지법 제 15조 제 1항, 제 3호, 제 4호에 따른 보호조치 이력이 있는 자에 한정\n\n○ 18세 또는 연장 보호종료된 경우 보호종료로부터 5년간 지원\n* ’23년부터 보호연장아동도 자립지원통합서비스(맞춤형 사례관리) 지원대상자에 포함\n\n○ 15세 이후 조기 보호종료된 경우 18세가 된 때로부터 5년간 지원\n* 단, 개정된 아동복지법 시행일(‘24.2.9.) 이후 18세가 된 자부터 적용",
      benefit_text:
        "○  아동 복지 시설, 가정 위탁 보호 종료 아동 중 보호 종료일 기준으로 과거 2년 이상 연속하여 보호 받은 자립 준비 청년 대상 보호 종료 후 5년 간 자립 수당 월 50만 원 지급",
    },
    {
      name: "자립지원 전담기관 운영",
      target_text:
        "○ 아동복지시설, 가정위탁 보호종료 5년 이내 자립준비청년\n* 아동복지시설 : 아동복지법 제52조 상 아동양육시설, 공동생활가정, 아동일시보호시설, 학대피해아동쉼터, 아동보호치료시설\n** 단, 소년법 제32조제1항제6호에 따른 보호처분으로 아동복지시설에서 보호종료된 경우에는 아동복지법 제15조제1항제3호, 제4호에 따른 보호조치 이력이 있는 자에 한정\n○ 18세 또는 연장 보호종료된 경우 보호종료로부터 5년 간 지원\n* '23년부터 보호연장아동도 자립지원통합서비스(맞춤형 사례관리) 지원대상자에 포함\n○ 15세 이후 조기 보호종료된 경우 18세가 된 때로부터 5년간 지원\n* 단, 개정된 아동복지법 시행일('24.2.9.) 이후 18세가 된 자부터 적용 \"",
      benefit_text:
        "○ 자립준비청년 대상 사후관리 및 자립지원통합서비스(맞춤형 사례관리) 제공\n※ 사후관리: 사후관리 상담 및 자립수준평가를 연 1~2회 실시하여, 지원이 필요한 경우 자립지원통합서비스 연계\n※ 자립지원통합서비스: 생활, 주거, 교육, 취업, 의료 등 자립에 필요한 각종 서비스 이용 지원 및 복지급여·서비스 연계 제공",
    },
  ];
  for (const display of records)
    assert.equal(
      evaluatePolicyRelevance(display).status,
      "UNRELATED",
      display.name,
    );
});
