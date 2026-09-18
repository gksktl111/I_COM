# 교육 20건 추천 비교

이 기록은 초안 2건 시점의 보존 결과입니다. 같은 날 11건으로 확장한 결과는 [후속 구현 기록](recommendation-integration-20260911.md#공통-조건-변환과-교육-일괄-준비)을 따릅니다.

고정 평가 시각: 2026-09-11T00:00:00.000Z

**내부 비교 자료 · 실정책 승인 없음 · 추천 효과 미검증**

보존 정책 20건 / 매핑 경로 30개 / 구현 초안 2건·6경로 / 시나리오 9개

실제 검수 결정 0건. 현재 PUBLIC 규칙 정책 0건. 이는 사용자 추천 목록이 비었다는 뜻이 아닙니다. 미승인 분야의 실제 서비스는 잠정 추천을 제공합니다. 공개 카탈로그 버전: `11c5d38b314401062f47b3a59c56e14086c8403294122c0c3953a7abd17a3dba`.

## 해석 한계

- 20건은 목적 표집한 보존 자료이며 독립 성능 평가 표본이 아닙니다. 정확도·효과 개선 비율을 산출하지 않습니다.
- baseline은 보존 표시 문자열의 관련성 추천입니다. 현재 원격 공개 데이터의 재조회 결과가 아닙니다.
- baseline의 classifyScope는 항상 undefined로 고정해 수정 전 분야 발견을 보존합니다. 현재 잠정 서비스는 기본 분류 보정을 적용합니다. 이는 분야 발견 교정이며 자격 정확도·추천 효과는 미검증입니다.
- 현재 PUBLIC 규칙 경로는 실제 검수 등록부를 사용합니다. 규칙 0건은 사용자 목록 0건이 아닙니다. 현재 guided 서비스는 미승인 분야에 분류 보정을 적용한 PROVISIONAL 추천을 제공하며, 이 보고서에서는 같은 보존 20건으로 실제 분기를 실행합니다.
- 초안은 복사본의 release/rule만 FIXTURE로 바꾼 내부 계산입니다. HUMAN 승인 생성이나 production 등록부 변경을 하지 않습니다.
- 경로·목적의 불완전성과 UNRESOLVED는 유지합니다. 일부 원자 조건 TRUE/FALSE도 정책 전체 자격 확정이나 효과 검증이 아닙니다.
- 현재 가구 주소를 학생의 과거 기준일·신청일 거주로 대체하지 않습니다. 입학 연도·법정 학교 여부·중복 지원 등의 추가 사실은 만들지 않습니다.
- 초안에 없는 18건은 NOT_IN_DRAFT_CATALOG이며 INELIGIBLE이 아닙니다. 현재 승인과 완전한 경로가 없으므로 추천 효과는 미검증입니다.

## 전체 20건 매핑·구현 범위

| 표본 | 정책 | 설계 처분 | 매핑 경로 | 초안 경로 | 구현 범위 |
| --- | --- | --- | ---: | ---: | --- |
| E01 | 교육급여 | CANDIDATE | 2 | 0 | NOT_IN_DRAFT_CATALOG |
| E02 | 초·중·고 교육비 지원 | CANDIDATE | 2 | 0 | NOT_IN_DRAFT_CATALOG |
| E03 | 기장군 신입생 교복구입비 지원 | CANDIDATE | 1 | 3 | INCOMPLETE_DRAFT |
| E04 | 타 시·도 초·중·고등학교 신입생 입학준비금 지원 | CANDIDATE | 1 | 3 | INCOMPLETE_DRAFT |
| E05 | 타 시·도 초·중·고등학교 신입생 입학준비금 지원 | HOLD | 1 | 0 | NOT_IN_DRAFT_CATALOG |
| E06 | 저소득 다문화 자녀 교육활동비 지원 | HOLD | 1 | 0 | NOT_IN_DRAFT_CATALOG |
| E07 | 초 중 고 학생 통학교통비 지원 | CANDIDATE | 1 | 0 | NOT_IN_DRAFT_CATALOG |
| E08 | 해운대구 학교 밖 청소년 검정고시 합격축하금 지원 | CANDIDATE | 1 | 0 | NOT_IN_DRAFT_CATALOG |
| E09 | 한부모가족 자녀 학습 지원 | CANDIDATE | 1 | 0 | NOT_IN_DRAFT_CATALOG |
| E10 | 대구시교육청 방과후학교 자유수강권 지원 | HOLD | 3 | 0 | NOT_IN_DRAFT_CATALOG |
| E11 | 청소년 방과후 아카데미 운영 | CANDIDATE | 2 | 0 | NOT_IN_DRAFT_CATALOG |
| E12 | 다자녀가정 입학축하금 | CANDIDATE | 1 | 0 | NOT_IN_DRAFT_CATALOG |
| E13 | 재가장애아동 학습지도 지원 | CANDIDATE | 1 | 0 | NOT_IN_DRAFT_CATALOG |
| E14 | 사립유치원 학부모부담금 보전 및 교육비 지원 | ADJACENT | 2 | 0 | NOT_IN_DRAFT_CATALOG |
| E15 | 결식아동급식비지원 | ADJACENT | 1 | 0 | NOT_IN_DRAFT_CATALOG |
| E16 | 원어민 화상외국어 교육 | HOLD | 1 | 0 | NOT_IN_DRAFT_CATALOG |
| E17 | 결혼이민여성 농업교육 지원 | HOLD | 3 | 0 | NOT_IN_DRAFT_CATALOG |
| E18 | 대청장학금 지원 | OUTSIDE | 1 | 0 | NOT_IN_DRAFT_CATALOG |
| E19 | 행복둥지 사랑의 집수리 지원 | CANDIDATE | 2 | 0 | NOT_IN_DRAFT_CATALOG |
| E20 | 사립휴양시설 조성·보완·운영 사업비 융자 | HOLD | 2 | 0 | NOT_IN_DRAFT_CATALOG |

## 시나리오별 결과

### uniform-high-busan

기장군 현재 거주·부산 고등학교·교복 필요

- 실제 bank 코드: child-1/C-TIMING=DONT_KNOW, child-1/E01=ENROLLED, child-1/E02=HIGH, child-1/E03=G1, child-1/E04=부산광역시|기장군, child-1/E05=FIRST
- Baseline 전체 순서: E04 → E05 → E18 → E02 → E06 → E11 → E01 → E07 → E14 → E09 → E13
- Baseline Top 5: E04, E05, E18, E02, E06
- 현재 PUBLIC 규칙 경로: AWAITING_REVIEW, 0건. 순서: 없음
- 실제 사용자 흐름(같은 보존 표본): PROVISIONAL, 11건. 순서: E03 → E04 → E05 → E02 → E06 → E11 → E01 → E07 → E14 → E09 → E13
- 수정 전후 분야 발견 변화: 추가 E03; 제외 E18. 분야 발견 교정이며 자격 정확도는 미검증입니다.
- 내부 초안 순서: E03 → E04
- 초안 자격 제외: 없음; 초안 미구현: E01, E02, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15, E16, E17, E18, E19, E20

| 초안 | 대표 상태 | 필요 관련성 | 대상별 상태 | 원자 규칙 비교 | 미확인 원인 |
| --- | --- | --- | --- | --- | --- |
| E03 | UNKNOWN | MATCH | child-1:UNKNOWN | child-1: gijang-transfer=FALSE, gijang-reentry=FALSE, gijang-high=TRUE, gijang-middle=FALSE, gijang-school-busan=TRUE | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |
| E04 | UNKNOWN | UNKNOWN | child-1:UNKNOWN | child-1: gwanak-grade-one=TRUE, gwanak-school-seoul=FALSE, gwanak-stage-elementary=FALSE, gwanak-stage-middle=FALSE, gwanak-stage-high=TRUE | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |

### uniform-middle-busan

기장군 현재 거주·부산 중학교·교복 필요

- 실제 bank 코드: child-1/C-TIMING=DONT_KNOW, child-1/E01=ENROLLED, child-1/E02=MIDDLE, child-1/E03=G1, child-1/E04=부산광역시|기장군, child-1/E05=FIRST
- Baseline 전체 순서: E04 → E05 → E02 → E06 → E11 → E18 → E01 → E07 → E14 → E09 → E13
- Baseline Top 5: E04, E05, E02, E06, E11
- 현재 PUBLIC 규칙 경로: AWAITING_REVIEW, 0건. 순서: 없음
- 실제 사용자 흐름(같은 보존 표본): PROVISIONAL, 11건. 순서: E03 → E04 → E05 → E02 → E06 → E11 → E01 → E07 → E14 → E09 → E13
- 수정 전후 분야 발견 변화: 추가 E03; 제외 E18. 분야 발견 교정이며 자격 정확도는 미검증입니다.
- 내부 초안 순서: E03 → E04
- 초안 자격 제외: 없음; 초안 미구현: E01, E02, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15, E16, E17, E18, E19, E20

| 초안 | 대표 상태 | 필요 관련성 | 대상별 상태 | 원자 규칙 비교 | 미확인 원인 |
| --- | --- | --- | --- | --- | --- |
| E03 | UNKNOWN | MATCH | child-1:UNKNOWN | child-1: gijang-transfer=FALSE, gijang-reentry=FALSE, gijang-high=FALSE, gijang-middle=TRUE, gijang-school-busan=TRUE | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |
| E04 | UNKNOWN | UNKNOWN | child-1:UNKNOWN | child-1: gwanak-grade-one=TRUE, gwanak-school-seoul=FALSE, gwanak-stage-elementary=FALSE, gwanak-stage-middle=TRUE, gwanak-stage-high=FALSE | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |

### uniform-middle-outside-busan

기장군 현재 거주·울산 중학교·교복 필요

- 실제 bank 코드: child-1/C-TIMING=DONT_KNOW, child-1/E01=ENROLLED, child-1/E02=MIDDLE, child-1/E03=G1, child-1/E04=울산광역시|남구, child-1/E05=FIRST
- Baseline 전체 순서: E04 → E05 → E02 → E06 → E11 → E18 → E01 → E07 → E14 → E09 → E13
- Baseline Top 5: E04, E05, E02, E06, E11
- 현재 PUBLIC 규칙 경로: AWAITING_REVIEW, 0건. 순서: 없음
- 실제 사용자 흐름(같은 보존 표본): PROVISIONAL, 11건. 순서: E03 → E04 → E05 → E02 → E06 → E11 → E01 → E07 → E14 → E09 → E13
- 수정 전후 분야 발견 변화: 추가 E03; 제외 E18. 분야 발견 교정이며 자격 정확도는 미검증입니다.
- 내부 초안 순서: E03 → E04
- 초안 자격 제외: 없음; 초안 미구현: E01, E02, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15, E16, E17, E18, E19, E20

| 초안 | 대표 상태 | 필요 관련성 | 대상별 상태 | 원자 규칙 비교 | 미확인 원인 |
| --- | --- | --- | --- | --- | --- |
| E03 | UNKNOWN | MATCH | child-1:UNKNOWN | child-1: gijang-transfer=FALSE, gijang-reentry=FALSE, gijang-high=FALSE, gijang-middle=TRUE, gijang-school-busan=FALSE | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |
| E04 | UNKNOWN | UNKNOWN | child-1:UNKNOWN | child-1: gwanak-grade-one=TRUE, gwanak-school-seoul=FALSE, gwanak-stage-elementary=FALSE, gwanak-stage-middle=TRUE, gwanak-stage-high=FALSE | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |

### entry-elementary-outside-seoul

관악구 현재 거주·경기 초등학교 1학년·입학준비 필요

- 실제 bank 코드: child-1/C-TIMING=DONT_KNOW, child-1/E01=ENROLLED, child-1/E02=ELEMENTARY, child-1/E03=G1, child-1/E04=경기도|수원시 영통구, child-1/E05=FIRST
- Baseline 전체 순서: E04 → E18 → E05 → E01 → E02 → E06 → E11 → E07 → E14 → E09 → E13
- Baseline Top 5: E04, E18, E05, E01, E02
- 현재 PUBLIC 규칙 경로: AWAITING_REVIEW, 0건. 순서: 없음
- 실제 사용자 흐름(같은 보존 표본): PROVISIONAL, 11건. 순서: E04 → E05 → E03 → E01 → E02 → E06 → E11 → E07 → E14 → E09 → E13
- 수정 전후 분야 발견 변화: 추가 E03; 제외 E18. 분야 발견 교정이며 자격 정확도는 미검증입니다.
- 내부 초안 순서: E04 → E03
- 초안 자격 제외: 없음; 초안 미구현: E01, E02, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15, E16, E17, E18, E19, E20

| 초안 | 대표 상태 | 필요 관련성 | 대상별 상태 | 원자 규칙 비교 | 미확인 원인 |
| --- | --- | --- | --- | --- | --- |
| E04 | UNKNOWN | MATCH | child-1:UNKNOWN | child-1: gwanak-grade-one=TRUE, gwanak-school-seoul=FALSE, gwanak-stage-elementary=TRUE, gwanak-stage-middle=FALSE, gwanak-stage-high=FALSE | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |
| E03 | UNKNOWN | UNKNOWN | child-1:UNKNOWN | child-1: gijang-transfer=FALSE, gijang-reentry=FALSE, gijang-high=FALSE, gijang-middle=FALSE, gijang-school-busan=FALSE | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |

### entry-elementary-seoul

관악구 현재 거주·서울 초등학교 1학년·입학준비 필요

- 실제 bank 코드: child-1/C-TIMING=DONT_KNOW, child-1/E01=ENROLLED, child-1/E02=ELEMENTARY, child-1/E03=G1, child-1/E04=서울특별시|관악구, child-1/E05=FIRST
- Baseline 전체 순서: E04 → E18 → E05 → E01 → E02 → E06 → E11 → E07 → E14 → E09 → E13
- Baseline Top 5: E04, E18, E05, E01, E02
- 현재 PUBLIC 규칙 경로: AWAITING_REVIEW, 0건. 순서: 없음
- 실제 사용자 흐름(같은 보존 표본): PROVISIONAL, 11건. 순서: E04 → E05 → E03 → E01 → E02 → E06 → E11 → E07 → E14 → E09 → E13
- 수정 전후 분야 발견 변화: 추가 E03; 제외 E18. 분야 발견 교정이며 자격 정확도는 미검증입니다.
- 내부 초안 순서: E04 → E03
- 초안 자격 제외: 없음; 초안 미구현: E01, E02, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15, E16, E17, E18, E19, E20

| 초안 | 대표 상태 | 필요 관련성 | 대상별 상태 | 원자 규칙 비교 | 미확인 원인 |
| --- | --- | --- | --- | --- | --- |
| E04 | UNKNOWN | MATCH | child-1:UNKNOWN | child-1: gwanak-grade-one=TRUE, gwanak-school-seoul=TRUE, gwanak-stage-elementary=TRUE, gwanak-stage-middle=FALSE, gwanak-stage-high=FALSE | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |
| E03 | UNKNOWN | UNKNOWN | child-1:UNKNOWN | child-1: gijang-transfer=FALSE, gijang-reentry=FALSE, gijang-high=FALSE, gijang-middle=FALSE, gijang-school-busan=FALSE | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |

### learning-elementary

현행 지역 사전의 전남광주통합특별시 동구·초등학교 4학년·학습 필요

- 실제 bank 코드: child-1/C-TIMING=DONT_KNOW, child-1/E01=ENROLLED, child-1/E02=ELEMENTARY, child-1/E03=G4, child-1/E04=전남광주통합특별시|동구
- Baseline 전체 순서: E11 → E06 → E09 → E13 → E18 → E04 → E01 → E05 → E07 → E02 → E14
- Baseline Top 5: E11, E06, E09, E13, E18
- 현재 PUBLIC 규칙 경로: AWAITING_REVIEW, 0건. 순서: 없음
- 실제 사용자 흐름(같은 보존 표본): PROVISIONAL, 11건. 순서: E11 → E06 → E09 → E13 → E04 → E01 → E05 → E07 → E03 → E02 → E14
- 수정 전후 분야 발견 변화: 추가 E03; 제외 E18. 분야 발견 교정이며 자격 정확도는 미검증입니다.
- 내부 초안 순서: E04 → E03
- 초안 자격 제외: 없음; 초안 미구현: E01, E02, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15, E16, E17, E18, E19, E20

| 초안 | 대표 상태 | 필요 관련성 | 대상별 상태 | 원자 규칙 비교 | 미확인 원인 |
| --- | --- | --- | --- | --- | --- |
| E04 | UNKNOWN | UNKNOWN | child-1:UNKNOWN | child-1: gwanak-grade-one=FALSE, gwanak-school-seoul=FALSE, gwanak-stage-elementary=TRUE, gwanak-stage-middle=FALSE, gwanak-stage-high=FALSE | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |
| E03 | UNKNOWN | UNKNOWN | child-1:UNKNOWN | child-1: gijang-high=FALSE, gijang-middle=FALSE, gijang-school-busan=FALSE | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |

### two-children-different-schools

첫째 부산 고등학교·둘째 경기 초등학교, 교복과 입학준비 필요

- 실제 bank 코드: child-1/C-TIMING=DONT_KNOW, child-1/E01=ENROLLED, child-1/E02=HIGH, child-1/E03=G1, child-1/E04=부산광역시|기장군, child-1/E05=FIRST, child-2/C-TIMING=DONT_KNOW, child-2/E01=ENROLLED, child-2/E02=ELEMENTARY, child-2/E03=G1, child-2/E04=경기도|수원시 영통구, child-2/E05=FIRST
- Baseline 전체 순서: E04 → E05 → E18 → E01 → E02 → E06 → E11 → E07 → E14 → E09 → E13
- Baseline Top 5: E04, E05, E18, E01, E02
- 현재 PUBLIC 규칙 경로: AWAITING_REVIEW, 0건. 순서: 없음
- 실제 사용자 흐름(같은 보존 표본): PROVISIONAL, 11건. 순서: E04 → E05 → E03 → E01 → E02 → E06 → E11 → E07 → E14 → E09 → E13
- 수정 전후 분야 발견 변화: 추가 E03; 제외 E18. 분야 발견 교정이며 자격 정확도는 미검증입니다.
- 내부 초안 순서: E04 → E03
- 초안 자격 제외: 없음; 초안 미구현: E01, E02, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15, E16, E17, E18, E19, E20

| 초안 | 대표 상태 | 필요 관련성 | 대상별 상태 | 원자 규칙 비교 | 미확인 원인 |
| --- | --- | --- | --- | --- | --- |
| E04 | UNKNOWN | MATCH | child-1:UNKNOWN, child-2:UNKNOWN | child-1: gwanak-grade-one=TRUE, gwanak-school-seoul=FALSE, gwanak-stage-elementary=FALSE, gwanak-stage-middle=FALSE, gwanak-stage-high=TRUE; child-2: gwanak-grade-one=TRUE, gwanak-school-seoul=FALSE, gwanak-stage-elementary=TRUE, gwanak-stage-middle=FALSE, gwanak-stage-high=FALSE | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |
| E03 | UNKNOWN | MATCH | child-1:UNKNOWN, child-2:UNKNOWN | child-1: gijang-transfer=FALSE, gijang-reentry=FALSE, gijang-high=TRUE, gijang-middle=FALSE, gijang-school-busan=TRUE; child-2: gijang-transfer=FALSE, gijang-reentry=FALSE, gijang-high=FALSE, gijang-middle=FALSE, gijang-school-busan=FALSE | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |

### unknown-uniform

거주지·학교급 모름, 입학유형 건너뜀·교복 필요

- 실제 bank 코드: child-1/C-TIMING=DONT_KNOW, child-1/E01=DONT_KNOW, child-1/E05=SKIPPED
- Baseline 전체 순서: E04 → E05 → E02 → E06 → E14 → E11 → E09 → E18 → E01 → E13 → E07
- Baseline Top 5: E04, E05, E02, E06, E14
- 현재 PUBLIC 규칙 경로: AWAITING_REVIEW, 0건. 순서: 없음
- 실제 사용자 흐름(같은 보존 표본): PROVISIONAL, 11건. 순서: E03 → E04 → E05 → E02 → E06 → E14 → E11 → E09 → E01 → E13 → E07
- 수정 전후 분야 발견 변화: 추가 E03; 제외 E18. 분야 발견 교정이며 자격 정확도는 미검증입니다.
- 내부 초안 순서: E03 → E04
- 초안 자격 제외: 없음; 초안 미구현: E01, E02, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15, E16, E17, E18, E19, E20

| 초안 | 대표 상태 | 필요 관련성 | 대상별 상태 | 원자 규칙 비교 | 미확인 원인 |
| --- | --- | --- | --- | --- | --- |
| E03 | UNKNOWN | MATCH | child-1:UNKNOWN | child-1: 확정 비교 없음 | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |
| E04 | UNKNOWN | UNKNOWN | child-1:UNKNOWN | child-1: 확정 비교 없음 | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |

### unknown-all-purposes

거주지·학교급 모름·세부 목적 선택 없음

- 실제 bank 코드: child-1/C-TIMING=DONT_KNOW, child-1/E01=DONT_KNOW
- Baseline 전체 순서: E04 → E02 → E06 → E14 → E11 → E09 → E18 → E01 → E05 → E13 → E07
- Baseline Top 5: E04, E02, E06, E14, E11
- 현재 PUBLIC 규칙 경로: AWAITING_REVIEW, 0건. 순서: 없음
- 실제 사용자 흐름(같은 보존 표본): PROVISIONAL, 11건. 순서: E03 → E04 → E02 → E06 → E14 → E11 → E09 → E01 → E05 → E13 → E07
- 수정 전후 분야 발견 변화: 추가 E03; 제외 E18. 분야 발견 교정이며 자격 정확도는 미검증입니다.
- 내부 초안 순서: E04 → E03
- 초안 자격 제외: 없음; 초안 미구현: E01, E02, E05, E06, E07, E08, E09, E10, E11, E12, E13, E14, E15, E16, E17, E18, E19, E20

| 초안 | 대표 상태 | 필요 관련성 | 대상별 상태 | 원자 규칙 비교 | 미확인 원인 |
| --- | --- | --- | --- | --- | --- |
| E04 | UNKNOWN | NOT_USED | child-1:UNKNOWN | child-1: 확정 비교 없음 | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |
| E03 | UNKNOWN | NOT_USED | child-1:UNKNOWN | child-1: 확정 비교 없음 | USER_MISSING, POLICY_MISSING, INCOMPLETE_PATHS |

## 실제 관찰

- uniform-high-busan: E18가 baseline 3위. 매핑 처분 OUTSIDE: 실제 급여는 대학생 장학금으로 아동 교육 범위 밖이며 과거 고교 신입생 문구는 현재 고교 지원 근거가 아니다.
- entry-elementary-outside-seoul: E18가 baseline 2위. 매핑 처분 OUTSIDE: 실제 급여는 대학생 장학금으로 아동 교육 범위 밖이며 과거 고교 신입생 문구는 현재 고교 지원 근거가 아니다.
- entry-elementary-seoul: E18가 baseline 2위. 매핑 처분 OUTSIDE: 실제 급여는 대학생 장학금으로 아동 교육 범위 밖이며 과거 고교 신입생 문구는 현재 고교 지원 근거가 아니다.
- learning-elementary: E18가 baseline 5위. 매핑 처분 OUTSIDE: 실제 급여는 대학생 장학금으로 아동 교육 범위 밖이며 과거 고교 신입생 문구는 현재 고교 지원 근거가 아니다.
- two-children-different-schools: E18가 baseline 3위. 매핑 처분 OUTSIDE: 실제 급여는 대학생 장학금으로 아동 교육 범위 밖이며 과거 고교 신입생 문구는 현재 고교 지원 근거가 아니다.

## 표본별 보완 사항

### E01 교육급여

교육활동비와 무상교육 제외학교 학비의 교육 목적이 명시됨. CANDIDATE는 설계 후보이며 공개 승인이나 자격 충족을 뜻하지 않는다.
- E01-P1: 교육활동지원비 / PARTIAL; 미확인: MISSING: 소득 기준 적용 연도와 상세 산정 기준의 검수. 2026년 급여 문구만으로 소득 산정 연도를 확정하지 않음. / MISSING: 명시적 지역 적용 범위. 교육부라는 이유로 전국으로 추정하지 않음.
- E01-P2: 교과서대·입학금·수업료 / PARTIAL; 미확인: MISSING: 소득 기준 적용 연도와 상세 산정 기준의 검수. 2026년 급여 문구만으로 소득 산정 연도를 확정하지 않음. / MISSING: 명시적 지역 적용 범위. 교육부라는 이유로 전국으로 추정하지 않음.

### E02 초·중·고 교육비 지원

교육비와 급식비를 분리할 수 있으나 시도별 기준은 미완전함. CANDIDATE는 설계 후보이며 공개 승인이나 자격 충족을 뜻하지 않는다.
- E02-P1: 학비·교육정보화·방과후 수강권 / PARTIAL; 미확인: MISSING: 시도교육청·항목별 정확한 소득 기준, 연도, 지원 범위와 예산 선정 기준. / MISSING: 지역 적용 기준이 학교 소재지인지 거주지인지 확인 필요. 중앙기관으로 전국 적용을 추정하지 않음.
- E02-P2: 학교급식 비용 / PARTIAL; 미확인: MISSING: 시도교육청·항목별 정확한 소득 기준, 연도, 지원 범위와 예산 선정 기준. / MISSING: 지역 적용 기준이 학교 소재지인지 거주지인지 확인 필요. 중앙기관으로 전국 적용을 추정하지 않음.

### E03 기장군 신입생 교복구입비 지원

교복 지원의 학교 위치·입학 사건·제외 조건이 명시됨. CANDIDATE는 설계 후보이며 공개 승인이나 자격 충족을 뜻하지 않는다.
- E03-P1: 신입생 교복구입비 / PARTIAL; 미확인: MISSING: 학교이외 교육기관 인정 범위와 ‘등’으로 표시된 제외의 완전성.
- 공식 초안 검수 과제: HUMAN 공개·규칙 승인이 없는 검토 초안이며 공식 자료와 저장 원본의 차이를 검수해야 합니다.
- 공식 초안 검수 과제: 공식 조례 검색 본문의 교복비 공제와 2026 공고의 중복수급 환수 관계를 대조해야 합니다. 차액 지급을 확정하거나 중복 수급자를 일괄 탈락시키지 않습니다.
- 공식 초안 검수 과제: 대안기관은 대안교육을 실시하며 초·중등교육법 제4조 인가를 받지 않은 기관이라는 조례 정의가 확인됐습니다. 개별 기관 인정·증빙과 입학 전 전학 등 예외는 미확인입니다. 학교급 OTHER만으로 인정하지 않습니다.
- 공식 초안 검수 과제: 공지·안내문은 본인 신청·본인 통장을 허용하지만 신청서는 부모·보호자 중심입니다. 신청자 역할·서류의 우선 근거를 검수해야 합니다.
- 공식 초안 검수 과제: 신청 날짜는 2026-03-03~12-11이나 시간·예산 잔액·현재 접수 성공은 확인하지 않았습니다. 지급은 다음 달 중순 이후이며 지연·변경될 수 있습니다.
- 공식 초안 검수 과제: 학교급·학년·소재지의 SELECTED_ENROLLMENT_EVENT와 입학유형의 SELECTED_ENTRY_EVENT가 같은 실제 입학 사건인지 답변 연결을 검수해야 합니다.

### E04 타 시·도 초·중·고등학교 신입생 입학준비금 지원

학교 소재지와 주민등록을 별도로 비교하는 입학준비금 후보. CANDIDATE는 설계 후보이며 공개 승인이나 자격 충족을 뜻하지 않는다.
- E04-P1: 입학준비금 / PARTIAL; 미확인: MISSING: 유사지원의 세부 인정 범위 및 중복 판정 시점.
- 공식 초안 검수 과제: HUMAN 공개·규칙 승인이 없는 검토 초안입니다. 저장 구비서류의 잘린 문구를 공식 공지의 발급 1주 내 재학증명서와 대조해야 합니다.
- 공식 초안 검수 과제: 2026년 신입학은 확인되나 전·편입·재입학의 예외 범위가 미확인입니다. FIRST만 허용하는 규칙을 추가하지 않습니다.
- 공식 초안 검수 과제: 신청일은 실제 공식 신청일입니다. 현재 가구 주소나 평가 날짜를 학생의 해당 날짜 주민등록으로 대체하지 않습니다.
- 공식 초안 검수 과제: 초·중등교육법 제2조 학교 범위, 특정 유사 지원의 실제 수급 여부를 검수해야 합니다. 다른 지역의 지원액이 적어도 차액을 지급하지 않는다는 공식 안내는 보존합니다.
- 공식 초안 검수 과제: 학생 본인 신청에 대한 앞면의 부모·보호자 부재 조건과 뒷면의 법정대리인 동의 안내를 함께 검수해야 합니다.
- 공식 초안 검수 과제: 공식 본문은 이메일·방문만 안내하나 저장 자료에는 정부24도 있습니다. 신청 경로의 현행성·신청 종료 시각·현재 예산·실접수 성공은 미확인입니다.
- 공식 초안 검수 과제: 신청 날짜는 2026-03-09~10-30, 지급은 익월 중 최소 3주 소요입니다. 포인트는 마감 후 잔액 자동 반납·환불/이월 불가이나 정확한 사용 마감 날짜는 미확인입니다.

### E05 타 시·도 초·중·고등학교 신입생 입학준비금 지원

제목·금액의 초등학생과 대상 본문의 중고등학교 범위가 충돌하여 학교급 의미 확인 필요. CANDIDATE는 설계 후보이며 공개 승인이나 자격 충족을 뜻하지 않는다.
- E05-P1: 입학준비금(학교급 보류) / PARTIAL; 미확인: UNRESOLVED: 제목과 초등 급여액은 초등을 언급하나 대상·지원내용의 학교 범위는 중고등. 정책 확인 전 초등 포함·제외 확정 금지. / MISSING: 주민등록·체류지 기준일, 대상 입학 연도, 유사지원 범위. / UNRESOLVED: 외국인 체류지 대체 조건은 대상에만 존재하므로 보존·검수 필요.

### E06 저소득 다문화 자녀 교육활동비 지원

연령 문구와 고정 출생일 범위의 적용 연도가 불명확하여 대상 경계 보류. CANDIDATE는 설계 후보이며 공개 승인이나 자격 충족을 뜻하지 않는다.
- E06-P1: 다문화 자녀 교육활동비 / PARTIAL; 미확인: UNRESOLVED: 연령 기준일·적용 연도와 고정 출생일 범위의 정합성. / MISSING: 다문화가족 인정 정의, 소득 산정 방식·연도·가구 범위. / MISSING: 학교 밖 자녀의 급여 분기, 지역별 운영·접수 범위. / 신청 절차: 최초 1회 방문 필수, 추가 서류는 우편 등기 가능이라는 안내를 수혜 자격과 분리.

### E07 초 중 고 학생 통학교통비 지원

원거리 통학 지원이며 학구조정 예외와 기숙사 급여 분기를 별도로 보존. CANDIDATE는 설계 후보이며 공개 승인이나 자격 충족을 뜻하지 않는다.
- E07-P1: 통학교통비 / PARTIAL; 미확인: UNRESOLVED: ‘주소’의 주민등록/실거주 의미와 기준일. / MISSING: 직선거리 산정 기준, 농어촌학교 및 학구조정 인정 범위, 적용 연도·지원일 세부 범위. / UNRESOLVED: 선정기준의 문장 붙음은 원문 보존 후 예외·요금 구조 검수 필요.

### E08 해운대구 학교 밖 청소년 검정고시 합격축하금 지원

학교 밖 청소년의 교육 복귀 목적이며 24세까지의 범위를 삭제하지 않음. CANDIDATE는 설계 후보이며 공개 승인이나 자격 충족을 뜻하지 않는다.
- E08-P1: 고졸 검정고시 합격축하금 / PARTIAL; 미확인: MISSING: 연령 계산 방식·기준일, 주민등록 기준일, 당해 연도의 구체적 적용 연도. / UNRESOLVED: 입학지원금 ‘지원대상자 중복수혜 불가’의 제외 판정 단계는 재검수 필요. / MISSING: 19~24세 수혜자를 자녀/본인으로 연결하는 현 입력의 범위 검토.

### E09 한부모가족 자녀 학습 지원

방문학습 교육 목적 후보이며 재학 요건은 이 원문에서 확인되지 않는다. CANDIDATE는 설계 후보이며 공개 승인이나 자격 충족을 뜻하지 않는다.
- E09-P1: 맞춤 방문학습 / PARTIAL; 미확인: MISSING: 연령 계산 방식·기준일과 법정 인정 유효 시점. / MISSING: 명시적 적용 지역·방문 서비스 범위. 노원구 기관명과 관할 주민센터 신청만으로 노원구 거주 필수를 만들지 않음. / MISSING: 이용 기간·횟수·과목별 운영 범위.

### E10 대구시교육청 방과후학교 자유수강권 지원

교육 목적은 명확하나 순위별 대상 연결과 추천 선정 범위를 검수해야 함. CANDIDATE는 설계 후보이며 공개 승인이나 자격 충족을 뜻하지 않는다.
- E10-P1: 방과후학교 수강료: 1순위 / PARTIAL; 미확인: MISSING: ‘기초·차상위·한부모’의 정확한 인정 범위, 학교·지역 적용 범위. 기관명만으로 학생 거주지 조건 확정 금지. / UNRESOLVED: 순위별 선정 기준과 예산·지원 인원 및 복수 인정 시 급여 적용.
- E10-P2: 방과후학교 수강료: 2순위 / PARTIAL; 미확인: UNRESOLVED: 열거 조건의 OR 관계와 순위 선정 운영을 공식 기준으로 검수 필요. / MISSING: 소득 산정 방식·연도·가구 정의와 인정 종류별 대상·시점. 현재 소득 구간이 80% 경계를 걸치면 추가 확인. / MISSING: 소득 외 인정 대상의 일반 급여 적용 범위.
- E10-P3: 방과후학교 수강료: 학교장 추천 / PARTIAL; 미확인: UNRESOLVED: 3%의 산정 모집단·분모·시점, 추천 대상 자격과 특수교육대상자 제외의 적용 범위. / MISSING: 추천 학생의 급여 상한과 지역·학교 적용 범위.

### E11 청소년 방과후 아카데미 운영

교과학습 경로가 명시된 교육 설계 후보이며 공개 승인 의미는 아니다.
- E11-P1: 방과후 교과·보충학습 / PARTIAL; 미확인: 완전성 PARTIAL: 표시 원문에 근거한 미검수 조건 후보이며 전체 자격 MATCH를 허용하지 않는다. / 거주의 주민등록/실거주 기준·기준일 MISSING. / 선정기준·정원·학년도·개별 프로그램 이용 조건 MISSING. / 목적의 맞벌이·한부모·취약계층 언급을 필수 자격이나 우선순위로 확정하지 않는다.
- E11-P2: 방과후 돌봄·활동 및 부대 급식·귀가·상담 / PARTIAL; 미확인: 완전성 PARTIAL: 표시 원문에 근거한 미검수 조건 후보이며 전체 자격 MATCH를 허용하지 않는다. / 주중/주말 실제 시간·귀가차량 범위·상담 이용 조건 MISSING. / 개별 지원의 단독 신청 가능 여부 MISSING.

### E12 다자녀가정 입학축하금

초중고 입학 사건의 지원으로 교육 설계 후보이다.
- E12-P1: 다자녀 입학축하금 / PARTIAL; 미확인: 완전성 PARTIAL: 표시 원문에 근거한 미검수 조건 후보이며 전체 자격 MATCH를 허용하지 않는다. / 셋째 산정의 포함 자녀·예외 정의 MISSING. / 신청기한·적용 학년도·입학 인정 상세 기준 MISSING.

### E13 재가장애아동 학습지도 지원

장애아동 가정방문 학습 경로가 명확한 교육 설계 후보이다.
- E13-P1: 장애아동 가정방문 일대일 학습 / PARTIAL; 미확인: 완전성 PARTIAL: 표시 원문에 근거한 미검수 조건 후보이며 전체 자격 MATCH를 허용하지 않는다. / 국민기초·차상위 및 사례관리 대상의 세부 인정 기준·유효 시점 MISSING. / 연령 계산 기준일·만 나이 여부·18세 이상 인정 학교 범위 MISSING; 요약 초중고와 본문의 연령/재학 관계 확인 필요. / provider_name과 주민센터 신청만으로 적용 지역을 확정할 수 없어 지역 MISSING.

### E14 사립유치원 학부모부담금 보전 및 교육비 지원

유치원 기본 비용 지원이며 직접 수혜자는 사립유치원이다. 아동 교육 개인 신청 후보와 구분한다.
- E14-P1: 사립유치원 학부모부담금 보전 / PARTIAL; 미확인: 완전성 PARTIAL: 표시 원문에 근거한 미검수 조건 후보이며 전체 자격 MATCH를 허용하지 않는다. / 기관 등록 원아 수와 감면액은 개인 입력 범위 밖이다. / 개별 원아 적용 기준·지원 시점 MISSING.
- E14-P2: 사립유치원 교육비 지원 / PARTIAL; 미확인: 완전성 PARTIAL: 표시 원문에 근거한 미검수 조건 후보이며 전체 자격 MATCH를 허용하지 않는다. / 보전 차액 계산·10만원 한도의 적용 범위 상세 MISSING; 임의 합산 지원액 금지. / 기관 재정·부담금 사실은 현재 개인 입력으로 비교 불가.

### E15 결식아동급식비지원

학교·학습 조건이 없는 결식 예방 급식카드로 주거·생활 인접 사례이다.
- E15-P1: 결식우려 아동 급식카드 / PARTIAL; 미확인: 완전성 PARTIAL: 표시 원문에 근거한 미검수 조건 후보이며 전체 자격 MATCH를 허용하지 않는다. / 근로 및 질병의 AND/OR 관계 UNRESOLVED. / 저소득 기준·산정 연도·가구 범위·아동 연령·적용 지역 MISSING; 기관명으로 양구군 거주 요건 확정 금지. / 선정기준의 결식우려만으로 지원대상의 저소득·보호자 사유를 삭제하지 않는다.

### E16 원어민 화상외국어 교육

학교 학생의 연령·학교급과 거주/학교 조건 관계, 저소득 경로 의미가 미해결이라 교육 자동 포함을 보류한다.
- E16-P1: 원어민 화상영어 / PARTIAL; 미확인: 완전성 PARTIAL: 표시 원문에 근거한 미검수 조건 후보이며 전체 자격 MATCH를 허용하지 않는다. / 학교급·대상 연령 MISSING; 일반 학교 학생을 아동으로 확정 불가. / 거주 및 학교의 조건 관계와 저소득 별도 행의 범위 UNRESOLVED. / 한부모가족이 법정 인정인지, 저소득 산정 기준·연도·혜택 차이 MISSING.

### E17 결혼이민여성 농업교육 지원

청소년 미래세대캠프 하위 경로는 존재하지만 다문화 이해·정착이 현 아동 교육 범주에 해당하는지 재검토가 필요하다.
- E17-P1: 다문화가족 농촌정착 미래세대캠프 / PARTIAL; 미확인: 완전성 PARTIAL: 표시 원문에 근거한 미검수 조건 후보이며 전체 자격 MATCH를 허용하지 않는다. / 청소년 연령·농촌지역 정의·거주 기준·선발 기준 MISSING. / 캠프의 실제 학습 목적·내용과 child_education 세부유형 대응 UNRESOLVED. / 농림축산식품부 소관만으로 전국 적용을 추정하지 않는다.
- E17-P2: 결혼이민여성 단계별·맞춤 농업교육 및 농외 자격증 / PARTIAL; 미확인: 완전성 PARTIAL: 표시 원문에 근거한 미검수 조건 후보이며 전체 자격 MATCH를 허용하지 않는다. / 심화기초교육 수료 구절과 과정 단계 관계·과정별 상세 기준 MISSING. / 성인 직업교육 조건을 자녀 입력으로 비교할 수 없다.
- E17-P3: 다문화가족 농촌정착 현장과정 / PARTIAL; 미확인: 완전성 PARTIAL: 표시 원문에 근거한 미검수 조건 후보이며 전체 자격 MATCH를 허용하지 않는다. / 현장과정 대상의 관계·지역 범위·선발 상세 MISSING. / 가족 참여만으로 모든 자녀를 교육 수혜자로 확정하지 않는다.

### E18 대청장학금 지원

실제 급여는 대학생 장학금으로 아동 교육 범위 밖이며 과거 고교 신입생 문구는 현재 고교 지원 근거가 아니다.
- E18-P1: 대청 대학 장학금 / PARTIAL; 미확인: 완전성 PARTIAL: 표시 원문에 근거한 미검수 조건 후보이며 전체 자격 MATCH를 허용하지 않는다. / 복수 수혜범위의 대체 관계·각 인물의 거주 조건 범위 UNRESOLVED. / 대청동 지역 경계·관할 학군·주민지원사업 대상 상세·적용 연도·신청 마감일 MISSING.

### E19 행복둥지 사랑의 집수리 지원

복합 집수리 중 아동 공부방·책상 지원만 교육 설계 후보이며 다른 경로의 조건을 섞지 않는다.
- E19-P1: 저소득아동 공부방·책상·의자 지원 / PARTIAL; 미확인: 완전성 PARTIAL: 표시 원문에 근거한 미검수 조건 후보이며 전체 자격 MATCH를 허용하지 않는다. / 공통 대상 목록과 저소득아동 경로의 결합 관계·저소득 정의 UNRESOLVED. / 연령·지역·소득 산정 연도·공부방 선정 세부 기준 MISSING.
- E19-P2: 노후주택 집수리 및 장애인 맞춤 주거환경개선 / PARTIAL; 미확인: 완전성 PARTIAL: 표시 원문에 근거한 미검수 조건 후보이며 전체 자격 MATCH를 허용하지 않는다. / 요약 임차가구 제한과 본문 범위 관계 UNRESOLVED. / 지역·주택 기준·장애인 하위 경로의 공통 조건 적용·세부 선정 기준 MISSING.

### E20 사립휴양시설 조성·보완·운영 사업비 융자

유아숲체험원 운영비도 아동·학부모 직접 지원이 아닌 시설 운영자 융자이다. 교육 라벨의 개인 추천 적합성과 선정기준 모순이 미해결이다.
- E20-P1: 산림교육시설 운영비 융자 / PARTIAL; 미확인: 완전성 PARTIAL: 표시 원문에 근거한 미검수 조건 후보이며 전체 자격 MATCH를 허용하지 않는다. / 수혜자 유형과 현재 child_education 라벨 적용 범위 UNRESOLVED; 개인 직접 혜택 근거 MISSING. / 지원불가 문구의 긍정/부정 의미 UNRESOLVED. / 공통 조성계획 승인 조건과 등록·지정 운영기관의 관계 UNRESOLVED. / 산림청 소관으로 전국 적용을 확정하지 않는다.
- E20-P2: 기타 사립휴양시설 조성·보완·운영 융자 / PARTIAL; 미확인: 완전성 PARTIAL: 표시 원문에 근거한 미검수 조건 후보이며 전체 자격 MATCH를 허용하지 않는다. / 수목원 승인/등록과 정원 허가/등록의 AND/OR 관계 UNRESOLVED. / 지원불가 문구 모순, 시설별 공통 승인 조건 적용 범위 UNRESOLVED. / 사업장 지역과 이용 아동 거주지를 혼동하지 않는다.

## 재현 정보

입력과 원자 규칙·경로별 미확인 사유는 함께 생성한 JSON에 보존됩니다.

- 표본 SHA-256: `6e09786218528bd81126c382a9eb9af3653916509581de8313bd180211b48b3b`
- 매핑 A/B SHA-256: `ee4cb24c8e3c82be03efadbad84012d7d83a1f7dd033158a10e2b068c0bc31fc` / `baf7cbbda3ec83715597276952117c34dfc3225de196531c4faf9176b8056427`
- 원본 초안 SHA-256: `fb3d1445d5105fb73f9b5bff57758983f9f9a632d815dfc4d47e4f0758b3d0a3`
