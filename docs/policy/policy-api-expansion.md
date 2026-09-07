# 다음 정책 API 연결 준비

확인일: 2026-09-08 · 상태: 공식 명세 확보·매핑 초안 완료, 인증된 실응답 미검증

## 1. 연결 후보

현재 저장소에 구체적으로 설정된 정책 API는 Gov24다. 다음 표본 후보로 복지로의 중앙부처·지자체 서비스를 조사했다. 사용자 활용 신청 상태는 아직 확인되지 않았다.

| 후보 | 공식 포털 | 확인한 기능·형식 | 준비 상태 |
| --- | --- | --- | --- |
| 한국사회보장정보원 중앙부처복지서비스 | [15090532](https://www.data.go.kr/data/15090532/openapi.do) | 목록·상세, XML; 기준연도·지원주기·분류 필드 | 명세 저장, 승인·키·실응답 확인 필요 |
| 한국사회보장정보원 지자체복지서비스 | [15108347](https://www.data.go.kr/data/15108347/openapi.do) | 목록·상세, XML; 지역명·시행일·수정일 필드 | 명세 저장, 승인·키·실응답 확인 필요 |
| 서울 열린데이터광장 복지서비스 상세 | [OA-23014](https://data.seoul.go.kr/dataList/OA-23014/S/1/datasetView.do) | 한국사회보장정보원 지자체 API 중 서울 자료를 제공한다고 안내 | 복지로 지자체와 원천이 겹치므로 별도 신규 정책으로 자동 중복 수집하지 않음 |

공식 포털은 개발계정 신청 가능 트래픽을 중앙 100, 지자체 1,000으로 안내한다. 실제 계정 잔여량·초기화·증설 상태는 별도 확인한다. 공통 인증키 문자열을 쓰더라도 API별 활용 권한이 확보됐다고 가정하지 않는다.

## 2. 확보한 명세와 호출 경로

공식 포털 HTML의 `swaggerJson`을 JSON으로 파싱하여 저장했다. 사이트 스크립트는 실행하지 않았다. 아래 파일은 실제 응답 fixture가 아니다.

- [중앙부처 명세](../fixtures/bokjiro/central-official-schema.json)
- [지자체 명세](../fixtures/bokjiro/local-official-schema.json)

| 구분 | HTTPS 기본 주소 | 목록 경로 | 상세 경로 |
| --- | --- | --- | --- |
| 중앙 | `https://apis.data.go.kr/B554287/NationalWelfareInformationsV001` | `/NationalWelfarelistV001` | `/NationalWelfaredetailedV001` |
| 지자체 | `https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations` | `/LcgvWelfarelist` | `/LcgvWelfaredetailed` |

중앙 상세의 요청 필수 값은 `serviceKey`, `callTp=D`, `servId`, 지자체 상세는 `serviceKey`, `servId`로 명세에 나타난다. 저장한 명세의 `swaggerOprtinVOs`에는 현재 선택된 상세 요청 정의만 포함돼 있어 **목록 요청 필터·필수 인자는 추가 확인이 필요하다.** 예제 servId를 실제 선정 정책으로 간주하지 않는다.

응답 명세의 목록 요소가 object로 선언돼 있어 실제 XML의 0/1/복수 반복, 빈 태그·누락, 결과코드와 오류 envelope를 실응답으로 확인해야 한다. Gov24의 JSON 파서·완전성 규칙을 그대로 복사하지 않는다. XML 원문을 보관하고 반복 요소·문자열 숫자·CDATA·HTML을 구분한다.

## 3. 공통 필드 매핑 초안

아래는 명세 필드와 내부 의미의 연결 후보다. 실제 non-null 여부·문자열 형태·공식성·조건 해석을 검증한 결과가 아니다.

| 내부 의미 | 중앙부처 | 지자체 | 처리 기준 |
| --- | --- | --- | --- |
| 외부 식별자·이름 | servId / servNm | servId / servNm | 제공자 범위에서 문자열 유지 |
| 요약 | 목록 servDgst / 상세 wlfareInfoOutlCn | servDgst | 목록·상세 각각 보존, 우선 출처 검수 |
| 지원대상 | tgtrDtlCn | sprtTrgtCn | 텍스트 정제와 조건 규칙 추출 분리 |
| 선정기준 | slctCritCn | slctCritCn | 누락을 무제한으로 해석하지 않음 |
| 지원내용 | alwServCn | alwServCn | 금액·예외·급여 분기 보존 |
| 제공기관 관련 | jurMnofNm / jurOrgNm | ctpvNm / sggNm / bizChrDeptNm | 기관·부서·지역 역할을 구분, 거주 조건 추정 금지 |
| 생애주기·가구·관심 분류 | lifeArray / trgterIndvdlArray / intrsThemaArray | lifeNmArray / trgterIndvdlNmArray / intrsThemaNmArray | 코드·명칭·복수값 구분, 코드 사전 확인 전 임의 분해 금지 |
| 지원주기·제공유형 | sprtCycNm / srvPvsnNm | sprtCycNm / srvPvsnNm | 지급 주기를 신청 기간으로 쓰지 않음 |
| 신청방법 | applmetList 반복 후보 | aplyMtdNm / aplyMtdCn | 원문 항목·관계 보존, 단일 URL로 축약 금지 |
| 출처 링크 | 목록 servDtlLink | 목록 servDtlLink | 문법·공식성·페이지 일치 별도 검증 |
| 문의·관련 웹사이트 | inqplCtadrList / inqplHmpgReldList | 동일 이름의 목록, 내부 필드 형태는 다름 | 연락처와 신청 링크 역할 구분 |
| 서식·근거법령 | basfrmList / baslawList | basfrmList / baslawList | 링크가 있다고 필수 제출 서류로 단정하지 않음 |
| 시점 | crtrYr / svcfrstRegTs | enfcBgngYmd / enfcEndYmd / lastModYmd | 기준연도·등록·시행·수정 구분, 시행 종료를 신청 마감으로 변환 금지 |

## 4. 연결 전 필요한 설정

`.env.example`에 준비용 이름을 추가했다. 아직 이 변수를 소비하는 복지로 수집 CLI는 없다.

```dotenv
BOKJIRO_CENTRAL_API_KEY=
BOKJIRO_LOCAL_API_KEY=
```

각 API 활용 승인을 받은 공공데이터포털 인증키를 로컬 `.env.local`에 저장한다. 동일 키로 두 API를 승인받았다면 같은 값을 각각 설정할 수 있다. 실제 키를 문서·대화·명령 인자로 전달하지 않는다. 현재 두 설정 모두 없는 것을 이름·설정 여부만 조회해 확인했으며 기존 Gov24 키를 복지로에 전송하지 않았다.

## 5. 다음 실행 범위

1. 포털에서 목록 요청 명세와 코드표를 확보하고 인증된 목록 1페이지를 조회한다.
2. 육아 관련 소규모 표본을 선정해 상세를 조회한다. 각 호출 예산을 제한하고 인증·할당량 오류는 반복하지 않는다.
3. 정상/빈값/반복 요소/페이지 경계·ID 일치·날짜·분류·출처를 확인한다. 표본이 부족한 실패 구조는 합성 검증과 구분한다.
4. [공통 데이터 계약](./policy-common-data-contract.md)에 매핑하고 8개 Gov24와 같은 적합성 표를 작성한다.
5. 표시 정제·원본 보관과 검색 규칙의 검수 상태를 구분한 뒤 저장 구조 확장을 진행한다.

현재 복지로 연결·정제·DB 반영 성공을 주장할 근거는 없다. 이 문서는 키와 목록 명세가 확보되면 진행할 작업을 구체화한 준비 결과다.
