import type {
  Catalog,
  Expression,
  FactRef,
  FactValue,
  Policy,
  PolicyPath,
  Predicate,
  QuestionDefinition,
} from "../../recommendation/types.ts";
import { REGIONS } from "../../public/types.ts";
import type { RecommendationSource } from "../recommendation-sources.ts";

/** Research draft only. A separate, hash-bound human decision must authorize use. */
const questionVersion = "education-official-draft-20260911-r3";
const gijangId = "046f6387-44ae-4770-8181-35545094340b";
const gwanakId = "065aebae-110a-41a6-9c07-c816be1209b9";

export const educationSourceVersions: Record<
  string,
  RecommendationSource["source"]
> = {
  "046f6387-44ae-4770-8181-35545094340b": {
    snapshotId: "5f303d08-2bac-4a56-9f91-9485808d7d3f",
    normalizerVersion: "1",
    displayHash:
      "522cfbc4e5ea5858f39595bd467556f750864ec264e924ed74395a7279b56e69",
    normalizedFingerprint:
      "c4a27e856b6993c2cf61c2c001b63b3df061205b301b9b3b883c01c13f3c7729",
  },
  "065aebae-110a-41a6-9c07-c816be1209b9": {
    snapshotId: "74626e51-95a3-4e2f-ac31-92fa9952bf89",
    normalizerVersion: "1",
    displayHash:
      "7e1a7495e95243924c1ae1de00b2509a3302ae2b163819ceedbe131366d227f8",
    normalizedFingerprint:
      "f88dff50792df6f61830ccc4fa46765916aa613433de01169eaa547d9bdb50e5",
  },
};

const gijangNotice =
  "https://www.gijang.go.kr/board/view.gijang?boardId=BBS_0000002&dataSid=243259&menuCd=DOM_000000101001001000&paging=ok&startPage=1";
const gijangGuide =
  "https://www.gijang.go.kr/upload_data/board_data/BBS_0000002/177190743886989.jpg";
const gijangForm =
  "https://www.gijang.go.kr/board/SynapViewer.gijang?boardId=BBS_0000002&menuCd=DOM_000000101001001000&paging=ok&startPage=1&dataSid=243259&command=update&fileSid=97159";
const gwanakNotice =
  "https://www.gwanak.go.kr/site/gwanak/ex/bbs/View.do?cbIdx=239&bcIdx=191543&parentSeq=191543";
const gwanakForm =
  "https://www.gwanak.go.kr/synapView.do?bcIdx=191543&cbIdx=239&streFileNm=1ce50444-4e46-4f8d-b39d-4bf49b71f3d3.hwp";

const gijangOrdinance =
  "https://www.law.go.kr/LSW/ordinInfoP.do?chrClsCd=010202&gubun=ELIS&ordinSeq=1370848";
const gwanakBokjiro =
  "https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do?wlfareInfoId=WLF00006588&wlfareInfoReldBztpCd=02";

export const educationOfficialSources: Record<string, string[]> = {
  [gijangId]: [gijangNotice, gijangGuide, gijangForm, gijangOrdinance],
  [gwanakId]: [gwanakNotice, gwanakForm, gwanakBokjiro],
};

/** These gaps are not facts a user can resolve by repeatedly answering questions. */
export const educationReviewGaps: Record<string, string[]> = {
  [gijangId]: [
    "HUMAN 공개·규칙 승인이 없는 검토 초안이며 공식 자료와 저장 원본의 차이를 검수해야 합니다.",
    "공식 조례 검색 본문의 교복비 공제와 2026 공고의 중복수급 환수 관계를 대조해야 합니다. 차액 지급을 확정하거나 중복 수급자를 일괄 탈락시키지 않습니다.",
    "대안기관은 대안교육을 실시하며 초·중등교육법 제4조 인가를 받지 않은 기관이라는 조례 정의가 확인됐습니다. 개별 기관 인정·증빙과 입학 전 전학 등 예외는 미확인입니다. 학교급 OTHER만으로 인정하지 않습니다.",
    "공지·안내문은 본인 신청·본인 통장을 허용하지만 신청서는 부모·보호자 중심입니다. 신청자 역할·서류의 우선 근거를 검수해야 합니다.",
    "신청 날짜는 2026-03-03~12-11이나 시간·예산 잔액·현재 접수 성공은 확인하지 않았습니다. 지급은 다음 달 중순 이후이며 지연·변경될 수 있습니다.",
    "학교급·학년·소재지의 SELECTED_ENROLLMENT_EVENT와 입학유형의 SELECTED_ENTRY_EVENT가 같은 실제 입학 사건인지 답변 연결을 검수해야 합니다.",
  ],
  [gwanakId]: [
    "일반 최초 신입학의 학교급별 충분조건 3경로는 작성 완료. 다른 예외 경로는 불완전하며 실제 HUMAN 공개·규칙 검수는 남아 있습니다.",
    "HUMAN 공개·규칙 승인이 없는 검토 초안입니다. 저장 구비서류의 잘린 문구를 공식 공지의 발급 1주 내 재학증명서와 대조해야 합니다.",
    "2026년 신입학은 확인되나 전·편입·재입학의 예외 범위가 미확인입니다. FIRST는 일반 최초 신입학의 충분조건 경로에만 적용하며 정책 전체의 필수조건으로 사용하지 않습니다.",
    "신청일은 실제 공식 신청일입니다. 현재 가구 주소나 평가 날짜를 학생의 해당 날짜 주민등록으로 대체하지 않습니다.",
    "초·중등교육법 제2조 학교 범위, 특정 유사 지원의 실제 수급 여부를 검수해야 합니다. 다른 지역의 지원액이 적어도 차액을 지급하지 않는다는 공식 안내는 보존합니다.",
    "학생 본인 신청에 대한 앞면의 부모·보호자 부재 조건과 뒷면의 법정대리인 동의 안내를 함께 검수해야 합니다.",
    "공식 본문은 이메일·방문만 안내하나 저장 자료에는 정부24도 있습니다. 신청 경로의 현행성·신청 종료 시각·현재 예산·실접수 성공은 미확인입니다.",
    "신청 날짜는 2026-03-09~10-30, 지급은 익월 중 최소 3주 소요입니다. 포인트는 마감 후 잔액 자동 반납·환불/이월 불가이나 정확한 사용 마감 날짜는 미확인입니다.",
  ],
};

const enrollmentReference = "SELECTED_ENROLLMENT_EVENT";
const fact = (
  attribute: string,
  basis: string,
  reference = enrollmentReference,
): FactRef => ({
  attribute,
  subject: "BENEFICIARY",
  basis,
  reference,
});
// The first four FactRefs match the bank projection without renaming its codes.
const facts = {
  schoolStage: fact("education.schoolStage", "CURRENT_OR_PLANNED_INSTITUTION"),
  grade: fact("education.grade", "SELF_REPORTED_GRADE"),
  schoolRegion: fact("education.schoolRegion.region", "INSTITUTION_LOCATION"),
  entryType: fact(
    "education.entryType",
    "SELF_REPORTED_ENTRY_EVENT",
    "SELECTED_ENTRY_EVENT",
  ),
  enrollmentYear: fact(
    "education.enrollmentYear",
    "SELF_REPORTED_ENROLLMENT_YEAR",
  ),
  gijangResidence: fact(
    "residence.gijangOn20260301",
    "REGISTERED_RESIDENCE",
    "2026-03-01",
  ),
  uniform: fact("education.uniformRequired", "INSTITUTION_UNIFORM_REQUIREMENT"),
  adultCourse: fact(
    "education.adultLifelongCourse",
    "SELF_REPORTED_INSTITUTION_COURSE",
  ),
  alternativeInstitution: fact(
    "education.alternativeEducationInstitution",
    "SELF_REPORTED_INSTITUTION_TYPE",
  ),
  gwanakSameFirstEntry: fact(
    "education.gwanakSameActualFirstEntry",
    "EXPLICIT_SAME_ENROLLMENT_EVENT_CONFIRMATION",
  ),
  gwanakResidence: fact(
    "residence.gwanakOnApplicationDate",
    "REGISTERED_RESIDENCE",
    "ACTUAL_APPLICATION_DATE",
  ),
  legalSchool: fact(
    "education.schoolUnderArticle2",
    "ELEMENTARY_SECONDARY_EDUCATION_ACT_ARTICLE_2",
  ),
  duplicateEntryAid: fact(
    "education.receivedComparableEntryAid",
    "GWANAK_2026_ENTRY_AID_DUPLICATION",
  ),
};
function eq(
  policyId: string,
  id: string,
  key: FactRef,
  expected: string | boolean,
  label: string,
  url: string | string[],
): Predicate {
  return {
    id,
    fact: key,
    label,
    evidenceRefs: typeof url === "string" ? [url] : url,
    review: "UNREVIEWED",
    sourceVersion: educationSourceVersions[policyId].normalizedFingerprint,
    operator: "EQ",
    expected,
  };
}
const predicate = (ruleId: string): Expression => ({
  kind: "PREDICATE",
  ruleId,
});
const not = (ruleId: string): Expression => ({
  kind: "NOT",
  child: predicate(ruleId),
});
function path(
  id: string,
  purpose: string,
  url: string,
  expressions: Expression[],
): PolicyPath {
  return {
    id,
    subject: "CHILD",
    complete: false,
    expression: {
      kind: "ALL",
      children: [...expressions, { kind: "UNRESOLVED" }],
    },
    purposes: [purpose],
    purposesComplete: false,
    purposeEvidence: [url],
    availability: "UNKNOWN",
    availabilityEvidence: [],
  };
}
const code = (value: string): FactValue => ({ kind: "CODE", value });
const bool = (value: boolean): FactValue => ({ kind: "BOOLEAN", value });
const choices = (options: [string, string][]): QuestionDefinition["options"] =>
  options.map(([value, label]) => ({ label, value: code(value) }));
function question(
  id: string,
  key: FactRef,
  prompt: string,
  whyAsked: string,
  options: QuestionDefinition["options"],
  burden: QuestionDefinition["burden"] = 1,
): QuestionDefinition {
  return {
    id,
    version: questionVersion,
    fact: key,
    prompt,
    whyAsked,
    burden,
    options,
    prerequisites: [],
  };
}
const yesNo = [
  { label: "예", value: bool(true) },
  { label: "아니요", value: bool(false) },
];

const gijang: Policy = {
  id: gijangId,
  title: "기장군 신입생 교복구입비 지원",
  category: "education",
  sourceVersion: educationSourceVersions[gijangId].normalizedFingerprint,
  release: "HIDDEN",
  releaseSourceVersion: educationSourceVersions[gijangId].normalizedFingerprint,
  completePaths: false,
  rules: [
    eq(
      gijangId,
      "gijang-residence",
      facts.gijangResidence,
      true,
      "학생의 2026년 3월 1일 기장군 주민등록",
      gijangNotice,
    ),
    eq(
      gijangId,
      "gijang-enrollment-2026",
      facts.enrollmentYear,
      "2026",
      "같은 학교·교육기관에 실제로 입학한 연도가 2026년",
      gijangNotice,
    ),
    eq(
      gijangId,
      "gijang-uniform",
      facts.uniform,
      true,
      "해당 학교·교육기관의 교복 착용",
      gijangNotice,
    ),
    eq(
      gijangId,
      "gijang-adult-course",
      facts.adultCourse,
      true,
      "제외되는 성인 대상 평생교육시설 성인반",
      gijangNotice,
    ),
    eq(
      gijangId,
      "gijang-transfer",
      facts.entryType,
      "TRANSFER",
      "제외되는 전학",
      gijangNotice,
    ),
    eq(
      gijangId,
      "gijang-reentry",
      facts.entryType,
      "REENTRY",
      "제외되는 재입학",
      gijangNotice,
    ),
    eq(
      gijangId,
      "gijang-high",
      facts.schoolStage,
      "HIGH",
      "고등학교 경로",
      gijangNotice,
    ),
    eq(
      gijangId,
      "gijang-middle",
      facts.schoolStage,
      "MIDDLE",
      "중학교 경로",
      gijangNotice,
    ),
    eq(
      gijangId,
      "gijang-school-busan",
      facts.schoolRegion,
      "부산광역시",
      "부산 소재 중학교 제외의 학교 위치",
      gijangNotice,
    ),
    eq(
      gijangId,
      "gijang-alternative",
      facts.alternativeInstitution,
      true,
      "학교 외 대안교육기관 경로의 기관 구분",
      gijangNotice,
    ),
  ],
  paths: [],
};
const gijangCommon = [
  "gijang-residence",
  "gijang-enrollment-2026",
  "gijang-uniform",
]
  .map(predicate)
  .concat([
    not("gijang-adult-course"),
    not("gijang-transfer"),
    not("gijang-reentry"),
  ]);
gijang.paths = [
  path("gijang-2026-high-school", "uniform", gijangNotice, [
    ...gijangCommon,
    predicate("gijang-high"),
  ]),
  path("gijang-2026-middle-outside-busan", "uniform", gijangNotice, [
    ...gijangCommon,
    predicate("gijang-middle"),
    not("gijang-school-busan"),
  ]),
  path("gijang-2026-alternative-institution", "uniform", gijangNotice, [
    ...gijangCommon,
    predicate("gijang-alternative"),
  ]),
];

const gwanak: Policy = {
  id: gwanakId,
  title: "타 시·도 초·중·고등학교 신입생 입학준비금 지원",
  category: "education",
  sourceVersion: educationSourceVersions[gwanakId].normalizedFingerprint,
  release: "HIDDEN",
  releaseSourceVersion: educationSourceVersions[gwanakId].normalizedFingerprint,
  completePaths: false,
  rules: [
    eq(
      gwanakId,
      "gwanak-first-entry",
      facts.entryType,
      "FIRST",
      "일반 최초 신입학 충분조건 경로에만 적용; 전편입 전체 제외 조건 아님",
      gwanakNotice,
    ),
    eq(
      gwanakId,
      "gwanak-same-first-entry",
      facts.gwanakSameFirstEntry,
      true,
      "학교급·학년·소재지·실제 입학연도와 최초 입학 답변이 모두 같은 실제 입학 사건임을 확인",
      gwanakNotice,
    ),
    eq(
      gwanakId,
      "gwanak-residence",
      facts.gwanakResidence,
      true,
      "학생의 실제 신청일 관악구 주민등록",
      gwanakNotice,
    ),
    eq(
      gwanakId,
      "gwanak-enrollment-2026",
      facts.enrollmentYear,
      "2026",
      "같은 학교에 실제로 입학한 연도가 2026년",
      gwanakNotice,
    ),
    eq(
      gwanakId,
      "gwanak-grade-one",
      facts.grade,
      "G1",
      "해당 입학 사건의 1학년",
      gwanakNotice,
    ),
    eq(
      gwanakId,
      "gwanak-school-seoul",
      facts.schoolRegion,
      "서울특별시",
      "서울 소재 학교는 타 시·도 경로에 해당하지 않음",
      gwanakNotice,
    ),
    eq(
      gwanakId,
      "gwanak-legal-school",
      facts.legalSchool,
      true,
      "초·중등교육법 제2조에 해당하는 학교",
      gwanakNotice,
    ),
    eq(
      gwanakId,
      "gwanak-no-duplicate-aid",
      facts.duplicateEntryAid,
      false,
      "서울시교육청 또는 타 시·도 입학준비금·교복지원금·무상교복 등 유사 지원 미수급; 차액 지급 불가",
      [gwanakNotice, gwanakBokjiro],
    ),
    ...(["ELEMENTARY", "MIDDLE", "HIGH"] as const).map((stage) =>
      eq(
        gwanakId,
        `gwanak-stage-${stage.toLowerCase()}`,
        facts.schoolStage,
        stage,
        `${stage === "ELEMENTARY" ? "초등학교 20만 원" : "중·고등학교 30만 원"} 급여 경로`,
        gwanakNotice,
      ),
    ),
  ],
  paths: [],
};
const gwanakCommon = [
  "gwanak-residence",
  "gwanak-enrollment-2026",
  "gwanak-grade-one",
  "gwanak-legal-school",
  "gwanak-no-duplicate-aid",
]
  .map(predicate)
  .concat([not("gwanak-school-seoul")]);
gwanak.paths = ["elementary", "middle", "high"].map((stage) =>
  path(`gwanak-2026-${stage}`, "entry-preparation", gwanakNotice, [
    ...gwanakCommon,
    predicate(`gwanak-stage-${stage}`),
  ]),
);

// Sufficient ordinary-entry paths do not assert that every exception path is known.
// Explicit confirmation bridges the two bank references without silently merging events.
for (const stage of ["elementary", "middle", "high"]) {
  gwanak.paths.push({
    ...path(
      `gwanak-2026-first-${stage}`,
      "entry-preparation",
      gwanakNotice,
      [],
    ),
    complete: true,
    expression: {
      kind: "ALL",
      children: [
        ...gwanakCommon,
        predicate(`gwanak-stage-${stage}`),
        predicate("gwanak-first-entry"),
        predicate("gwanak-same-first-entry"),
      ],
    },
  });
}

export const educationDraftCatalog: Catalog = {
  version: questionVersion,
  policies: [gijang, gwanak],
  questions: [
    question(
      "education-2026-school-stage",
      facts.schoolStage,
      "이 자녀가 앞서 답한 학교·교육기관의 학교급은 무엇인가요?",
      "정책별 고등학교·중학교·초등학교 경로를 구분합니다.",
      choices([
        ["ELEMENTARY", "초등학교"],
        ["MIDDLE", "중학교"],
        ["HIGH", "고등학교"],
        ["OTHER", "그 외 학교·교육기관"],
      ]),
    ),
    question(
      "education-2026-grade",
      facts.grade,
      "앞서 답한 같은 학교 입학 사건의 학년은 무엇인가요?",
      "관악구 정책은 2026년 1학년 신입학을 요구합니다.",
      choices([
        ["G1", "1학년"],
        ["G2", "2학년"],
        ["G3", "3학년"],
        ["G4", "4학년"],
        ["G5", "5학년"],
        ["G6", "6학년"],
        ["NO_GRADE", "학년 구분 없음"],
      ]),
    ),
    question(
      "education-2026-school-region",
      facts.schoolRegion,
      "앞서 답한 학교·교육기관은 어느 시·도에 있나요?",
      "학생 거주지와 별도로 부산 밖 중학교와 서울 밖 학교 조건을 확인합니다.",
      choices(REGIONS.map((region) => [region, region])),
    ),
    question(
      "education-2026-entry-type",
      facts.entryType,
      "앞서 답한 같은 입학은 어떤 유형인가요?",
      "기장군 교복비는 전학과 재입학을 제외합니다. 관악구의 같은 제외를 추정하지 않습니다.",
      choices([
        ["FIRST", "해당 학교급에 처음 입학"],
        ["TRANSFER", "전학"],
        ["REENTRY", "재입학"],
        ["OTHER", "그 외 유형"],
      ]),
    ),
    question(
      "education-2026-enrollment-year",
      facts.enrollmentYear,
      "앞서 답한 학교·교육기관에 실제로 입학한 연도는 언제인가요?",
      "두 정책의 2026년 입학 조건을 같은 자녀의 같은 학교 사건에 연결합니다.",
      choices([
        ["2026", "2026년"],
        ["OTHER", "다른 연도"],
        ["NOT_YET", "아직 입학하지 않았어요"],
      ]),
      2,
    ),
    question(
      "gijang-2026-residence",
      facts.gijangResidence,
      "이 자녀는 2026년 3월 1일에 기장군에 주민등록이 되어 있었나요?",
      "기장군 교복비는 학생의 과거 기준일 주민등록을 확인합니다. 현재 가구 주소로 대신하지 않습니다.",
      yesNo,
      2,
    ),
    question(
      "gijang-2026-uniform",
      facts.uniform,
      "앞서 답한 학교·교육기관에서 교복을 입나요?",
      "기장군 교복구입비는 교복을 입는 학교·교육기관의 신입생을 대상으로 합니다.",
      yesNo,
    ),
    question(
      "gijang-2026-adult-course",
      facts.adultCourse,
      "해당 교육과정은 성인 대상 평생교육시설의 성인반인가요?",
      "기장군 공지에서 제외하는 성인반인지 구분합니다.",
      yesNo,
    ),
    question(
      "gijang-2026-alternative-institution",
      facts.alternativeInstitution,
      "앞서 답한 곳은 대안교육을 실시하며 초·중등교육법 제4조 인가를 받지 않은 학교 외 교육기관인가요?",
      "학교급 기타나 대안학교라는 명칭만으로 판단하지 않습니다. 기관의 인가 여부를 확인하지 못했다면 모름을 선택해 주세요. 개별 기관 인정과 증빙은 별도 확인 사항입니다.",
      yesNo,
    ),
    question(
      "gwanak-2026-same-first-entry",
      facts.gwanakSameFirstEntry,
      "앞서 답한 학교급·1학년·학교 위치·실제 입학연도와 최초 입학 여부가 모두 이 자녀의 같은 입학을 가리키나요?",
      "서로 다른 학교나 입학 시점의 답변을 합치지 않기 위한 확인입니다. 같은 실제 입학인지 불확실하면 모름을 선택해 주세요.",
      yesNo,
      2,
    ),
    question(
      "gwanak-2026-application-residence",
      facts.gwanakResidence,
      "이 자녀는 관악구 입학준비금을 실제로 신청하는 날에 관악구에 주민등록이 되어 있나요?",
      "학생의 실제 신청일을 기준으로 답해 주세요. 신청일이나 그날 주소를 확정할 수 없으면 모름·건너뛰기를 선택할 수 있습니다.",
      yesNo,
      2,
    ),
    question(
      "gwanak-2026-legal-school",
      facts.legalSchool,
      "앞서 답한 학교는 초·중등교육법 제2조에 해당하는 학교인가요?",
      "관악구 공식 공지는 그 외 학교를 제외합니다. 확인하지 못한 경우 모름을 선택해 주세요.",
      yesNo,
      2,
    ),
    question(
      "gwanak-2026-duplicate-entry-aid",
      facts.duplicateEntryAid,
      "이 자녀의 같은 입학에 대해 서울시교육청 또는 다른 시·도에서 입학준비금·교복지원금·무상교복 등 유사 지원을 받았나요?",
      "서울시교육청의 유사 지원도 포함합니다. 관악구는 해당 유사 지원의 중복 지급과 지역별 지원액 차액 지급을 하지 않습니다. 일반 교육급여 전체를 묻는 질문이 아닙니다.",
      yesNo,
      2,
    ),
  ],
};

const firstEntryConfirmation = educationDraftCatalog.questions.find(
  (q) => q.id === "gwanak-2026-same-first-entry",
)!;
firstEntryConfirmation.prerequisites = [
  { questionId: "education-2026-enrollment-year", equals: code("2026") },
  { questionId: "education-2026-entry-type", equals: code("FIRST") },
  { questionId: "education-2026-grade", equals: code("G1") },
];
