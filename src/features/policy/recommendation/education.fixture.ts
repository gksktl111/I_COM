import type {
  Catalog,
  Expression,
  FactRef,
  FactValue,
  Policy,
  Predicate,
  QuestionDefinition,
  Request,
} from "./types.ts";

/**
 * E03/E04 simplified synthetic TEST ONLY data, inspired by the mapping audit.
 * This is NOT current official eligibility, qualified source material, or public
 * policy data. Evidence IDs identify this artificial contract, never real sources.
 * `completePaths`, `complete`, and OPEN describe only this test universe.
 * E03 deliberately models one regular high-school first-entry uniform case;
 * real middle-school, adult-class, transfer/reentry and other exceptions are not
 * exhaustively implemented. E04 likewise is not a literal policy transcription.
 * No official eligibility or real application availability follows from a pass.
 */
const sourceVersion = "synthetic-education-1";
const childFact = (
  attribute: string,
  basis: string,
  reference = "2026",
): FactRef => ({
  attribute,
  subject: "BENEFICIARY",
  basis,
  reference,
});
const facts = {
  registeredRegion: childFact("residence.region", "REGISTERED", "2026-03-01"),
  applicationRegion: childFact("residence.region", "APPLICATION", "2026-09-09"),
  schoolRegion: childFact("school.region", "ATTENDING_SCHOOL"),
  schoolStage: childFact("school.stage", "ATTENDING_SCHOOL"),
  schoolCourse: childFact("school.course", "ATTENDING_SCHOOL"),
  uniform: childFact("school.uniform", "ATTENDING_SCHOOL"),
  entryYear: childFact("entry.year", "SCHOOL_ENTRY"),
  entryGrade: childFact("entry.grade", "SCHOOL_ENTRY"),
  entryKind: childFact("entry.kind", "SCHOOL_ENTRY"),
  duplicateAid: childFact("duplicate.entryAid", "BENEFIT_RECEIPT"),
};
const evidence = (id: string): string[] => [`fixture:${sourceVersion}:${id}`];
const eq = (
  id: string,
  fact: FactRef,
  expected: string | boolean,
  label: string,
): Predicate => ({
  id,
  fact,
  expected,
  label,
  operator: "EQ",
  review: "FIXTURE",
  sourceVersion,
  evidenceRefs: evidence(id),
});
const predicate = (ruleId: string): Expression => ({
  kind: "PREDICATE",
  ruleId,
});
const not = (ruleId: string): Expression => ({
  kind: "NOT",
  child: predicate(ruleId),
});

const e03: Policy = {
  id: "E03",
  title: "[TEST ONLY] E03 교복 지원 합성 사례",
  category: "education",
  sourceVersion,
  release: "FIXTURE",
  releaseSourceVersion: sourceVersion,
  completePaths: true,
  rules: [
    eq(
      "E03.registered",
      facts.registeredRegion,
      "GIJANG",
      "합성 기준일 주민등록지: 기장",
    ),
    eq("E03.stage", facts.schoolStage, "HIGH_SCHOOL", "합성 경로: 고등학교"),
    eq("E03.course", facts.schoolCourse, "REGULAR", "합성 경로: 일반 과정"),
    eq("E03.uniform", facts.uniform, true, "합성 경로: 교복 착용"),
    eq("E03.year", facts.entryYear, "2026", "합성 입학 연도: 2026"),
    eq("E03.entry", facts.entryKind, "FIRST", "합성 경로: 최초 입학"),
  ],
  paths: [
    {
      id: "E03.uniform",
      subject: "CHILD",
      complete: true,
      expression: {
        kind: "ALL",
        children: [
          "E03.registered",
          "E03.stage",
          "E03.course",
          "E03.uniform",
          "E03.year",
          "E03.entry",
        ].map(predicate),
      },
      purposes: ["uniform"],
      purposeEvidence: evidence("E03.purpose"),
      availability: "OPEN",
      availabilityEvidence: evidence("E03.synthetic-open"),
    },
  ],
};
const e04: Policy = {
  id: "E04",
  title: "[TEST ONLY] E04 입학준비 지원 합성 사례",
  category: "education",
  sourceVersion,
  release: "FIXTURE",
  releaseSourceVersion: sourceVersion,
  completePaths: true,
  rules: [
    eq(
      "E04.application",
      facts.applicationRegion,
      "GWANAK",
      "합성 신청일 거주지: 관악",
    ),
    eq("E04.seoul", facts.schoolRegion, "SEOUL", "합성 학교 소재지: 서울"),
    eq("E04.year", facts.entryYear, "2026", "합성 입학 연도: 2026"),
    eq("E04.grade", facts.entryGrade, "1", "합성 입학 학년: 1학년"),
    eq("E04.entry", facts.entryKind, "FIRST", "합성 경로: 최초 입학"),
    eq(
      "E04.duplicate",
      facts.duplicateAid,
      true,
      "합성 2026년 유사 입학지원 수급",
    ),
  ],
  paths: [
    {
      id: "E04.entry-preparation",
      subject: "CHILD",
      complete: true,
      expression: {
        kind: "ALL",
        children: [
          predicate("E04.application"),
          not("E04.seoul"),
          predicate("E04.year"),
          predicate("E04.grade"),
          predicate("E04.entry"),
          not("E04.duplicate"),
        ],
      },
      purposes: ["entry-preparation"],
      purposeEvidence: evidence("E04.purpose"),
      availability: "OPEN",
      availabilityEvidence: evidence("E04.synthetic-open"),
    },
  ],
};

const code = (value: string): FactValue => ({ kind: "CODE", value });
const codes = (...values: string[]): QuestionDefinition["options"] =>
  values.map((value) => ({ label: value, value: code(value) }));
const booleans: QuestionDefinition["options"] = [
  { label: "예", value: { kind: "BOOLEAN", value: true } },
  { label: "아니요", value: { kind: "BOOLEAN", value: false } },
];
const question = (
  id: string,
  fact: FactRef,
  prompt: string,
  options: QuestionDefinition["options"],
): QuestionDefinition => ({
  id,
  version: sourceVersion,
  fact,
  prompt: `[TEST ONLY] ${prompt}`,
  whyAsked: "해당 자녀의 합성 E03/E04 조건을 확인하기 위한 테스트 질문입니다.",
  burden: 1,
  options,
  prerequisites: [],
});

export const educationFixture: Catalog = {
  version: sourceVersion,
  policies: [e03, e04],
  questions: [
    question(
      "registered-region",
      facts.registeredRegion,
      "이 자녀의 2026-03-01 주민등록지는?",
      codes("GIJANG", "GWANAK", "OTHER"),
    ),
    question(
      "application-region",
      facts.applicationRegion,
      "이 자녀의 합성 신청일 2026-09-09 거주지는?",
      codes("GWANAK", "GIJANG", "OTHER"),
    ),
    question(
      "school-region",
      facts.schoolRegion,
      "이 자녀의 2026년 학교 소재지는?",
      codes("SEOUL", "BUSAN", "OTHER"),
    ),
    question(
      "school-stage",
      facts.schoolStage,
      "이 자녀의 2026년 학교급은?",
      codes("ELEMENTARY", "MIDDLE_SCHOOL", "HIGH_SCHOOL", "OTHER"),
    ),
    question(
      "school-course",
      facts.schoolCourse,
      "이 자녀의 2026년 학교 과정은?",
      codes("REGULAR", "ADULT"),
    ),
    question(
      "school-uniform",
      facts.uniform,
      "이 자녀의 2026년 학교에서 교복을 착용하나요?",
      booleans,
    ),
    question(
      "entry-year",
      facts.entryYear,
      "이 자녀의 입학 연도는?",
      codes("2026", "OTHER"),
    ),
    question(
      "entry-grade",
      facts.entryGrade,
      "이 자녀의 입학 학년은?",
      codes("1", "OTHER"),
    ),
    question(
      "entry-kind",
      facts.entryKind,
      "이 자녀의 입학 유형은?",
      codes("FIRST", "TRANSFER", "REENTRY"),
    ),
    question(
      "duplicate-entry-aid",
      facts.duplicateAid,
      "이 자녀가 합성 계약의 2026년 유사 입학지원을 받았나요?",
      booleans,
    ),
  ],
};

export const educationRequest: Request = {
  revision: 1,
  category: "education",
  selectedChildren: ["child-1", "child-2"],
  subjectsComplete: true,
  householdId: "household-1",
  needs: ["uniform"],
  answers: [],
  phase: "QUESTIONING",
  questionCount: 0,
  evaluatedAt: "2026-09-09T00:00:00.000Z",
  view: "CURRENT",
  mode: "FIXTURE",
};
