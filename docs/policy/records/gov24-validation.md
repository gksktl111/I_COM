# 정부24 표본·수집 검증 이력

이 문서는 날짜별 관찰·분석 근거를 보존한 작업용 기록이다. 당시의 완료·미구현·진행 중 표현, 건수와 명령을 현재 상태나 실행 지시로 사용하지 않는다. 현재 작업은 [작업 문서 안내](../work/README.md)를 따른다. 원문·fixture는 수정하지 않았다.

## 기록 찾아보기

- [Gov24 API 실제 표본 검증](#policy-api-validation)
- [Gov24 지원조건 코드 관찰](#policy-code-observations)
- [정책 수집 구현 검증 (2026-09-08)](#policy-sync-validation)

<a id="policy-api-validation"></a>

## Gov24 API 실제 표본 검증

상태: **1단계 완료, 2단계 계약 확정 근거 확보** (2026-09-08 KST). 실제 8개 정책의 목록·상세·지원조건, 반복 조회, 페이지 비교를 확보했다. 운영 전체 조회·DB 반영·예약 검증의 완료를 뜻하지 않는다.

<a id="policy-api-validation--근거와-재현-범위"></a>

### 근거와 재현 범위

[실제 fixture manifest](../../fixtures/gov24/real/manifest.json), [선정 목록](../../fixtures/gov24/real/selection.json)은 공개 서비스 설명의 인증된 실응답이다. 선정 목록의 `provenance.artifact`는 fixture 루트 기준으로 열 수 있고 `rowIndex`가 원본 검색 응답의 행을 가리킨다. 원본 로컬 경로도 남겼다. 요청별 endpoint·필터·page·perPage·UTC 조회시각·HTTP 상태·응답 envelope를 보존했다.

첫 수집 2026-09-07 17:54:13–14 UTC (`perPage=5`), 반복 17:54:47–49 UTC (`perPage=1`): 각각 32회, 모두 HTTP 200. 각 ID의 상세와 조건은 1페이지 1행, 2페이지 0행이며 ID 일치, 중복·envelope 이상 없음. [32쌍 비교](../../fixtures/gov24/real/repeat-comparison.json)에서 원본 data와 currentCount/matchCount/totalCount가 모두 같다. 목록은 선정 시 검색 응답이며 이 두 collect에서 재조회한 것이 아니다.

<a id="policy-api-validation--정책별-관찰"></a>

### 정책별 관찰

중앙 4개, 서울시 2개, 동일 서울 중구 2개를 선정했다. 제공기관 위치를 적용 지역으로 단정하지 않는다. 아래 모든 정책은 목록 1행과 상세/조건 각각 최초·반복 1행을 확보했다. 정확한 시각은 연결된 요청과 조건 관찰 자료에 있다.

| 서비스ID | 서비스명 | 선정 이유 |
| --- | --- | --- |
| 134200005012 | 가정양육수당 지원 | 중앙 가정양육 영유아 월 수당과 연령·금액 문장 |
| 135200005055 | 가정위탁 아동양육보조금 지원 | 중앙 가정위탁 아동 지원의 긴 지원대상 설명 |
| 135200005048 | 위기임신 및 보호출산 지원 | 중앙 위기임신·보호출산 서비스 |
| 174000000029 | 출산 관련 서비스 통합처리 신청(행복출산) | 중앙 행복출산 통합신청의 신청방법·구비서류 |
| 301000000124 | 장애인가정 출산지원금 지원 | 서울 중구 등록장애인 출산 지원, 복합 대상 |
| 301000000126 | 출산양육지원금 지급 | 동일 중구 신생아 출산양육지원금, 지역 조건 비교 |
| 611000000155 | 이주여성 건강관리 지원 (구)다문화가족 출산 전후 돌봄서비스) | 서울시 결혼이주여성 임신출산 건강관리, 복합 대상 |
| 611000019644 | 서울형 아이돌봄비 지원 | 서울시 24~36개월 영아 아이돌봄비, 월 시간·금액·소득 문장 |

<a id="policy-api-validation--필드페이지-관찰과-계약-제안"></a>

### 필드·페이지 관찰과 계약 제안

[전체 필드 통계](../../fixtures/gov24/real/field-statistics.json)는 목록 21개·상세 20개·조건 50개 필드 모두의 명세 타입, 관찰 타입별 빈도, 누락/null/빈 문자열/공백 빈도, 최대 문자열 길이와 해당 ID를 제공한다. 통계 모집단은 선정 목록 8행과 최초 상세·조건 각 8행이며 반복 응답을 중복 집계하지 않는다. 문자열 길이는 Unicode code point 수이며 저장 제한값이 아니다.

- 모든 명세 필드가 존재했다. 빈 문자열·공백만인 문자열은 없었으나 null은 있었다. 목록 선정기준 4/8, 접수기관 7/8; 상세 법령 4/8, 서비스목적 2/8, 선정기준 4/8, 온라인신청사이트URL 3/8, 자치법규 4/8, 접수기관명 7/8, 행정규칙 7/8이 null이다. 필드 존재와 non-null 보장은 구분한다.
- 서비스ID는 문자열 12자리, 조회수는 정수로 관찰했다. 내부 ID는 문자열로 보존한다. 미관찰 타입을 강제 문자열화하지 않는다.
- 목록 등록일시·수정일시는 14자리 문자열, 상세 수정일시는 `YYYY-MM-DD`다. 시간대·수정 전파 보장은 미확인이다. 원문과 정밀도를 보존하며 상세 날짜를 임의의 시각으로 만들지 않는다.
- 목록 신청방법은 `||` 구분 요약, 상세 신청방법은 문장·문단이다. 같은 이름의 필드를 무조건 동일시하지 않는다. CRLF, 목록 기호, 금액·개월/연령 문장은 원문으로 보존한다. 표시에는 상세 우선·명시적 목록 보완 규칙을 계약으로 정한다.
- `611000019644` 온라인신청사이트URL에는 원본의 잘린 형태가 있다. URL을 추측하여 복구하지 않는다. 원본 저장과 표시용 URL 검증을 분리한다.
- 조건 코드는 문자열 `Y`/null과 정수 연령으로 관찰했다. [코드 관찰표](#policy-code-observations) 및 모든 ID·시각별 값은 자격 판정 규칙이 아니다.

상세/조건 필터에서 `matchCount=1`, `totalCount=10956`, `currentCount=1→0`였다. 목록 양육 필터는 `matchCount=137`이며 [페이지 근거](../../fixtures/gov24/real/pagination/summary.json)의 5회 요청에서 perPage1의 1·2페이지가 perPage2의 1페이지와 같고, 137페이지 1행·138페이지 0행이었다. 따라서 이 관찰에서는 matchCount가 필터 결과 수이고 totalCount는 전체 수와 부합한다. 전체 137페이지를 순회한 검증은 아니다.

내부 정상 묶음은 HTTP 성공·정상 envelope·요청/응답 페이지 일치·ID 일치·중복 없음·일관된 matchCount와 누적 행수 일치·마지막 빈 페이지 확인을 모두 요구하도록 제안한다. 상세/조건 각 1행만 정상 반영한다. 0건·복수·상충·불완전 응답은 기존 데이터를 유지하고 검토 대상으로 둔다. probe의 `completeness=unverified`는 원본 그대로이며 내부 완료 규칙과 제공자의 전역 완전성 보장은 다르다.

<a id="policy-api-validation--잔여-불확실성과-단계-경계"></a>

### 잔여 불확실성과 단계 경계

약 34초 간격의 같은 응답은 수정 반영 시간·장기 안정성의 증거가 아니다. 실제 오류·최초 0건·복수 응답·미지 코드값은 미관찰이며 합성 검증과 구분한다. 계정 호출 한도·초기화 시각·429 정책·최대 페이지 크기·조회 중 변경의 일관성도 미확인이다. 조건 null을 비해당으로, `Y`를 확정 자격으로, 숫자를 계산 규칙으로 바꾸지 않는다.

실제 정상 묶음과 안전한 실패 처리 계약을 정할 근거는 확보했다. 이 보고서가 2단계 계약·스키마 작성의 입력이며 DB 실행 승인을 대체하지 않는다. 개발 Supabase 대상 확인과 서버 환경 준비, 배포 및 예약 2회 완료는 후속 단계다.

산출물 작성 전 `.env.local`의 현재 키·토큰·비밀값을 메모리에서만 읽어 원문 및 URL 인코딩 형태를 검사했다. 값은 출력하지 않았고 fixture에는 인증 헤더·키 파라미터가 없다. 공개 서비스 설명·기관 문의처는 보존했다.

<a id="policy-code-observations"></a>

## Gov24 지원조건 코드 관찰

상태: 실제 8개 정책 최초·반복 응답 확인 (2026-09-08 KST). 공식 설명은 [명세 fixture](../../fixtures/gov24/official-schema.json)에 근거한다. 값의 의미·자격 규칙은 **UNKNOWN**으로 보존한다.

[모든 코드의 값·JSON 타입·정책 ID·UTC 시각·요청 경로](../../fixtures/gov24/real/condition-observations.json)를 기계 판독 가능한 근거로 제공한다. 아래는 최초 8행만 집계한 값 집합이며 반복에서도 동일했다. null은 비해당·조건 없음이 아니다. 연령 주체·단위·경계·기준일을 확정하지 않는다.

| 코드 | 공식 설명 | 명세 타입 | 관찰 값·타입 | 의미 |
| --- | --- | --- | --- | --- |
| JA0101 | 남성 | string | "Y" (string), null (null) | UNKNOWN |
| JA0102 | 여성 | string | "Y" (string) | UNKNOWN |
| JA0110 | 대상연령(시작) | integer | 2 (integer), 0 (integer), 18 (integer) | UNKNOWN |
| JA0111 | 대상연령(종료) | integer | 7 (integer), 17 (integer), 55 (integer), 60 (integer), 44 (integer) | UNKNOWN |
| JA0201 | 중위소득 0~50% | string | "Y" (string) | UNKNOWN |
| JA0202 | 중위소득 51~75% | string | "Y" (string) | UNKNOWN |
| JA0203 | 중위소득 76~100% | string | "Y" (string) | UNKNOWN |
| JA0204 | 중위소득 101~200% | string | "Y" (string) | UNKNOWN |
| JA0205 | 중위소득 200% 초과 | string | "Y" (string), null (null) | UNKNOWN |
| JA0301 | 예비부모/난임 | string | null (null), "Y" (string) | UNKNOWN |
| JA0302 | 임산부 | string | null (null), "Y" (string) | UNKNOWN |
| JA0303 | 출산/입양 | string | null (null), "Y" (string) | UNKNOWN |
| JA0313 | 농업인 | string | null (null), "Y" (string) | UNKNOWN |
| JA0314 | 어업인 | string | null (null), "Y" (string) | UNKNOWN |
| JA0315 | 축산업인 | string | null (null), "Y" (string) | UNKNOWN |
| JA0316 | 임업인 | string | null (null), "Y" (string) | UNKNOWN |
| JA0317 | 초등학생 | string | null (null), "Y" (string) | UNKNOWN |
| JA0318 | 중학생 | string | null (null), "Y" (string) | UNKNOWN |
| JA0319 | 고등학생 | string | null (null), "Y" (string) | UNKNOWN |
| JA0320 | 대학생/대학원생 | string | null (null), "Y" (string) | UNKNOWN |
| JA0322 | 해당사항없음 | string | "Y" (string), null (null) | UNKNOWN |
| JA0326 | 근로자/직장인 | string | null (null), "Y" (string) | UNKNOWN |
| JA0327 | 구직자/실업자 | string | null (null), "Y" (string) | UNKNOWN |
| JA0328 | 장애인 | string | null (null), "Y" (string) | UNKNOWN |
| JA0329 | 국가보훈대상자 | string | null (null), "Y" (string) | UNKNOWN |
| JA0330 | 질병/질환자 | string | null (null), "Y" (string) | UNKNOWN |
| JA0401 | 다문화가족 | string | null (null), "Y" (string) | UNKNOWN |
| JA0402 | 북한이탈주민 | string | null (null), "Y" (string) | UNKNOWN |
| JA0403 | 한부모가정/조손가정 | string | null (null), "Y" (string) | UNKNOWN |
| JA0404 | 1인가구 | string | null (null), "Y" (string) | UNKNOWN |
| JA0410 | 해당사항없음 | string | "Y" (string), null (null) | UNKNOWN |
| JA0411 | 다자녀가구 | string | null (null), "Y" (string) | UNKNOWN |
| JA0412 | 무주택세대 | string | null (null), "Y" (string) | UNKNOWN |
| JA0413 | 신규전입 | string | null (null), "Y" (string) | UNKNOWN |
| JA0414 | 확대가족 | string | null (null), "Y" (string) | UNKNOWN |
| JA1101 | 예비창업자 | string | null (null) | UNKNOWN |
| JA1102 | 영업중 | string | null (null) | UNKNOWN |
| JA1103 | 생계곤란/폐업예정자 | string | null (null) | UNKNOWN |
| JA1201 | 음식적업 | string | null (null) | UNKNOWN |
| JA1202 | 제조업 | string | null (null) | UNKNOWN |
| JA1299 | 기타업종 | string | null (null) | UNKNOWN |
| JA2101 | 중소기업 | string | null (null) | UNKNOWN |
| JA2102 | 사회복지시설 | string | null (null) | UNKNOWN |
| JA2103 | 기관/단체 | string | null (null) | UNKNOWN |
| JA2201 | 제조업 | string | null (null) | UNKNOWN |
| JA2202 | 농업,임업 및 어업 | string | null (null) | UNKNOWN |
| JA2203 | 정보통신업 | string | null (null) | UNKNOWN |
| JA2299 | 기타업종 | string | null (null) | UNKNOWN |

<a id="policy-sync-validation"></a>

## 정책 수집 구현 검증 (2026-09-08)

<a id="policy-sync-validation--실제-api와-정규화"></a>

### 실제 API와 정규화

[1단계 표본 검증](#policy-api-validation)에서 중앙4·광역2·시군구2의 실제 8개 묶음을 확보했다. 새 `policy:prepare`로 목록 전체 필터 순회·상세·조건·마지막 빈 페이지·ID/건수 검사·정규화를 다시 실행했다.

- 실행: 2026-09-07 18:07:54–57 UTC (KST 2026-09-08 03:07).
- 공식 API 호출 42회, 8개 모두 PREPARED. DB 접근 없음.
- 산출물: `.local/policy-prepared/2026-09-07T18-07-54-774Z-72d3c218-2a82-4fdb-96cb-eb66e22feb0c/`.
- 지원대상/내용/신청 문단, 숫자·단위, 원본 null과 별도 날짜 형식이 정규화 가능함을 확인했다.
- 목록 신청방법은 요약, 상세는 문장이어서 모든 정책에 차이 경고가 있다. 서울형 아이돌봄비 URL은 원문보다 긴 설명 속 URL과 차이를 경고하며 복구하지 않는다. 괄호 닫힘만 뒤따르는 동일 URL은 경고 대상에서 제외했다.

<a id="policy-sync-validation--코드로컬-db"></a>

### 코드·로컬 DB

- 실제 fixture 내용을 사용하는 합성 API → 수집 서비스 → 실제 PostgreSQL(PGlite) RPC 통합: 최초8개·재실행 무중복·dry-run 쓰기0·1개 상세 실패 시 나머지7개 반영·저장 원본 재정규화 API호출0 통과.
- SQL: A→B→A 스냅샷 재사용과 전후 이력, 표시 갱신 후 강제 오류 전체 롤백, 임대 경합/만료/구 세대 거부, 성공 항목 보존 재개, 출처/스냅샷 불일치 거부, anon/authenticated 접근 거부, 실패/중단 원본 이력 보존 검증.
- 정규화: HTML 파서·엔티티·문단/목록, 잘못된 타입, 정상 빈 값, 원본/표시/조건 해시 구분, 날짜 역전 보류.
- HTTP: 비밀 제거·크기/타임아웃/예산 제한·인증/429 중단·일시 네트워크 재시도·긴 Retry-After 보류.

합성 API pagination과 인위적으로 바꾼 데이터는 실제 정책의 변경 관찰로 취급하지 않는다. PGlite는 단일 연결이므로 별도 DB 연결 간 경합을 검증했다는 의미가 아니다.

<a id="policy-sync-validation--원격-개발-db-검증"></a>

### 원격 개발 DB 검증

사용자가 개발·검증용 사용과 DB 적용을 승인한 `policy-dev` (`visumyadkxleiqtxokqg`)에서 관리 토큰 인증 HTTP200, ACTIVE_HEALTHY를 확인했다. 기존 정책 테이블·마이그레이션 이력이 없는 것을 확인하고 공식 Management API로 마이그레이션을 적용했다.

- 적용 버전: `20260907181933_policy_ingestion.sql`. 원격이 생성한 버전에 로컬 파일과 테스트/문서 참조를 맞췄다.
- 6개 테이블 모두 RLS 활성화. service_role만 원본 조회·표시 쓰기·RPC 실행 가능함을 실제 권한 조회로 확인했다.
- 실제 PostgreSQL 연결에서 `SET LOCAL ROLE anon/authenticated` 각각 원본 SELECT와 RPC current를 시도한 4개 요청 모두 permission denied로 거부됐다. 서버 Secret key를 사용하는 실제 Data API RPC는 정상 처리됐다. 사용자 로그인 JWT를 발급한 HTTP 검증과는 구분한다.
- 원격 DB 생성 타입: `src/shared/server/supabase/database.types.ts`. 생성 후 타입 검사·해당 파일 린트 통과.

| 실행 | run ID | 결과 | Gov24 호출 | DB 측 소요 |
| --- | --- | --- | --- | --- |
| 실제 최초 수집 | 847b17ef-7a37-4ab6-b82f-3cba775fe254 | SUCCESS, 8개 성공 | 42 | 11.57초 |
| 실제 재수집 | c2cf36d2-355e-457c-a913-a44cfd95ea16 | SUCCESS, 8개 모두 원본/표시/조건 무변경 | 42 | 7.67초 |
| 원본 재정규화 | c32bd8a0-9f0a-4272-b2d2-7e5cc60fc833 | SUCCESS, 8개 성공 | 0 | 3.11초 |
| 동시에 시작한 재정규화 | 07ecf9dd-20ca-4899-bb79-0276dacbc34e | SKIPPED | 0 | 0초 |

최초 수집은 UTC 2026-09-07 18:20:49–18:21:00, 재수집 18:22:05–18:22:13, 동시 재정규화 18:24:31–18:24:35에 완료했다. 최종 출처8·스냅샷8·표시8개, 스냅샷 raw의 `sum(pg_column_size(raw))=574523 bytes`. 중복 원본은 생성되지 않았고 종료 후 잠금 owner는 null이다. 저장량에는 최초 수집의 목록 페이지 evidence도 포함되며 전체 테이블/인덱스 크기를 뜻하지 않는다.

실제 dry-run은 API42회·8개 비교 성공이며 실행 전후 6개 테이블 전체 행의 정렬 직렬화 지문이 모두 동일했다. 잠금/실행/항목을 포함해 DB 쓰기가 없었다. 동시 실행은 별도 HTTP RPC 요청의 경합에서 하나만 처리됐으며, RUNNING 소유자에 잘못된 generation을 전달한 heartbeat도 HTTP400으로 거부됐다. 임대 만료·트랜잭션 오류·부분 실패의 인위적 시나리오는 앞서 로컬 PostgreSQL 검증과 구분한다.

산출물은 `.local/policy-sync/`의 첫 실행 `2026-09-07T18-20-48-606Z-060c7bed-88ab-45c5-8607-00fe4567aca3`, 반복 `2026-09-07T18-22-06-690Z-d41f08d7-c795-496b-aa36-ed505d09a914`, dry-run `2026-09-07T18-23-08-607Z-4a4d5998-f602-45b0-8b98-41c3899e6844`, `remote-validation/concurrency.json`에 보관했다. 이 디렉터리는 Git 제외 대상이다.

보안/성능 Advisors에서 이번 6개 수집 테이블/RPC의 WARN/ERROR는 없었다. RLS 정책이 없다는 INFO는 서버만 접근하도록 한 의도된 설정이며, 미사용 FK 인덱스 INFO는 새 테이블의 사용량 관찰 전이므로 유지한다. 기존 프로젝트의 `rls_auto_enable()`에 anon/authenticated SECURITY DEFINER 실행권한 WARN 2개가 있었다. 이 함수는 마이그레이션 전부터 존재한 `RETURNS event_trigger` 자동 RLS 활성화 함수로 확인했으며 이번 작업에서 변경하지 않았다.

<a id="policy-sync-validation--현재-완료-범위와-운영-잔여"></a>

### 현재 완료 범위와 운영 잔여

수동 API→수집→정제→원본/표시 DB 반영, 반복·dry-run·서버 전용 권한·원격 중복 실행·저장 원본 재처리까지 검증했다. `npm run policy:test` 7개 파일과 타입·린트 검증을 통과했고, 원격 버전으로 마이그레이션 파일명을 맞춘 뒤 DB/통합 2개 테스트 파일을 다시 통과했다.

전체 Next.js 빌드는 기존 globals.css 처리 중 Turbopack 포트 바인딩 `Operation not permitted`로 실패한 상태다. 소스가 바뀌지 않은 환경 오류를 반복 실행하지 않았으며 전체 빌드 성공으로 표시하지 않는다.

배포 주소·플랫폼·요금제·실행 한도·계정 일일 API 예산은 미확정이다. 자동 수집 HTTP 진입점과 스케줄은 아직 등록하지 않았다. 실제12시간 간격2회 수집 성공도 남아 있으므로 전체 계획의 완료로 표시하지 않는다. [실행·복구 안내](../work/collection-runbook.md)를 따른다.
