import assert from "node:assert/strict";
import test from "node:test";
import {
  COLLECTION_RELEVANCE_CATEGORIES,
  evaluateCollectionRelevance,
} from "./collection-relevance.ts";

test("신규 수집은 일반 대상의 실제 여섯 태그 급여를 v4로 활성화한다", () => {
  const cases = [
    ["산모 진료비", "출산한 산모", "산후 진료비 지원", ["임신·출산", "의료·건강"]],
    ["장애인 활동지원", "등록 장애인", "일상생활 활동지원 서비스 제공", ["돌봄"]],
    ["저소득층 생활지원", "저소득 주민", "생활비와 난방비 지원", ["주거·생활지원"]],
    ["학생 입학지원", "초등학교 신입생", "교복과 입학준비금 지원", ["아동 교육"]],
  ] as const;
  for (const [name, target_text, benefit_text, categories] of cases) {
    const value = evaluateCollectionRelevance({ name, target_text, benefit_text });
    assert.equal(value.version, "policy-relevance-4");
    assert.equal(value.status, "RELATED", name);
    assert.deepEqual(value.categories, categories);
    assert.deepEqual(value.evidence.map((item) => item.field), ["target_text", "benefit_text"]);
    assert.ok(value.conditionChecks.length > 0);
  }
  assert.deepEqual([...COLLECTION_RELEVANCE_CATEGORIES], [
    "임신·출산", "양육·보육", "돌봄", "의료·건강", "아동 교육", "주거·생활지원",
  ]);
});

test("세부 자격 불확실성은 검토 보류 대신 확인 항목으로 남긴다", () => {
  const value = evaluateCollectionRelevance({
    name: "주민 의료비 지원",
    target_text: "소득과 거주기간 기준을 충족하는 주민",
    benefit_text: "외래 진료비 지원",
    criteria_text: "세부 소득 기준은 별도 확인",
  });
  assert.equal(value.status, "RELATED");
  assert.deepEqual(value.categories, ["의료·건강"]);
  assert.match(value.conditionChecks[0], /연령·소득·거주·기간/);
});

test("명확한 비태그 서비스는 제외하고 실제 내용 부족만 검토로 남긴다", () => {
  for (const display of [
    { name: "장애인 정보화교육", target_text: "등록 장애인", benefit_text: "컴퓨터 기초교육 제공" },
    { name: "복지카드 수수료", target_text: "등록 장애인", benefit_text: "카드 발급 수수료 4천원 지원" },
  ]) {
    const value = evaluateCollectionRelevance(display);
    assert.equal(value.status, "UNRELATED", display.name);
    assert.deepEqual(value.categories, []);
    assert.deepEqual(value.conditionChecks, []);
    assert.deepEqual(value.evidence.map((item) => item.field), ["target_text", "benefit_text"]);
  }
  for (const display of [
    { name: "지정 장학금", target_text: "학생", benefit_text: "장학금 지원" },
    { name: "명절 위문품", target_text: "저소득 주민", benefit_text: "위문품 지원" },
    { name: "명절 위문금", target_text: "저소득 주민", benefit_text: "설 명절 위문금 5만원 지급" },
    { name: "학생 지원", target_text: "학생" },
  ]) {
    const value = evaluateCollectionRelevance(display);
    assert.equal(value.status, "REVIEW", display.name);
    assert.deepEqual(value.categories, []);
    assert.ok(value.conditionChecks.length > 0);
  }
});

test("목록 단계는 제목만으로 제외하지 않고 상세 원문을 기다린다", () => {
  for (const name of ["중소기업 수출 장비 지원", "노인 돌봄 지원", "장애인 의료비 지원", "청년 월세 지원", "여성농업인 출산 지원"])
    assert.equal(evaluateCollectionRelevance({ name }).status, "REVIEW", name);
});

test("대학 교육과 음악·정보 서비스가 태그 단어만으로 활성화되지 않는다", () => {
  for (const display of [
    { name: "대학생 장학금", target_text: "대학교 재학생", benefit_text: "대학 등록금 장학금 지원" },
    { name: "시각장애인 음악재활", target_text: "시각 장애인", benefit_text: "점자악보와 음악 활동 지원" },
    { name: "유료방송 이용료", target_text: "저소득 장애인", benefit_text: "유료방송 시청료 지원" },
  ]) assert.equal(evaluateCollectionRelevance(display).status, "UNRELATED", display.name);
});

test("상세 급여를 제목보다 우선하고 사업체 직접 지원은 개인 생활지원으로 활성화하지 않는다", () => {
  const mixed = evaluateCollectionRelevance({
    name: "자동차 검사비 지원",
    target_text: "저소득 가구",
    benefit_text: "자동차 검사비와 외래 진료비 지원",
  });
  assert.equal(mixed.status, "RELATED");
  assert.deepEqual(mixed.categories, ["의료·건강"]);

  const business = evaluateCollectionRelevance({
    name: "사업장 에너지 지원",
    target_text: "수출 중소기업",
    benefit_text: "사업장 전기요금과 설비비 지원",
  });
  assert.equal(business.status, "UNRELATED");
  assert.deepEqual(business.categories, []);
});

test("미등록 표현은 제외하지 않고 다중행 직접 근거는 원문 그대로 보존한다", () => {
  assert.equal(evaluateCollectionRelevance({
    name: "겨울나기 지원",
    target_text: "지역 취약가구",
    benefit_text: "동절기 난방용 연료비 지원",
  }).status, "RELATED");
  assert.equal(evaluateCollectionRelevance({
    name: "새로운 주민 서비스",
    target_text: "지역 주민",
    benefit_text: "새 유형의 회복 꾸러미 제공",
  }).status, "REVIEW");
  const display = {
    name: "방문 건강관리",
    target_text: "건강 취약 주민\n장기 거주 요건 별도 확인",
    benefit_text: "방문간호 제공\n외래 진료비 지원",
  };
  const value = evaluateCollectionRelevance(display);
  assert.equal(value.status, "RELATED");
  for (const evidence of value.evidence) {
    const original = display[evidence.field as "target_text" | "benefit_text"];
    assert.ok(original.includes(evidence.excerpt));
  }
});
