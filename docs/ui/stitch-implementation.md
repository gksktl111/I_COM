# 공개 UI 적용 기준

현재 구성 정리: 2026-09-09. 시안은 [아이콤 Stitch 프로젝트](https://stitch.withgoogle.com/projects/11573763693905046904)의 2026-09-08 조회 화면을 기준으로 구현했다. 이후 사용자 결정과 후속 수정은 아래 현재 동작을 우선한다. 관리자 기준은 [관리자 콘솔](../admin-console.md), 남은 구현은 [다음 작업](../next-steps.md)에 통합했다.

## 공용 컴포넌트와 현재 동작

- 공통 색상은 청록색 `#0d7a73`, 활성/호버 `#005f5a`, 배경 `#f8f9ff`와 흰 카드다. `globals.css` 및 `components/ui`의 Button·Input·Select·Badge·Chip·Card·Notice·EmptyState·Skeleton·Dialog를 재사용한다.
- 공개 Header는 브랜드·서비스 내비게이션의 2단 구조다. 하향 스크롤에서 브랜드 줄을 숨기고 상향 시 복귀한다. 모바일 메뉴와 브라우저 글자 크기 저장을 지원한다. 맞춤 입력의 단계 표시는 공통 헤더 아래에 별도로 고정한다.
- Select는 공통 트리거·메뉴와 키보드 조작을 제공한다. Dialog는 배경 클릭·Escape 닫기와 트리거 초점 복귀를 지원한다. 지도 마커는 분류 아이콘과 선택 상태를 표시하며 클릭·Enter로 실제 제공 정보의 상세 모달을 연다.
- 정식 `/policy/match`는 거주지·6개 분야 → 자녀·관심 지원 → 분야별 질문 → 결과 순서다. 현재 기본 정보 변경 시 상세 답변은 초기화한다. 목표 흐름과 현재 경계는 [추천 구현 계획](../policy/work/recommendation-plan.md), 질문·선택지는 [질문 사전](../policy/work/question-bank.md)을 따른다. 기존 입력 컴포넌트의 기록은 [입력 화면 안내](interest-questions.md)에 구분했다.
- 거주지는 고정된 시도·시군구 선택 목록을 사용한다. 과거 자유 텍스트 입력 설명은 현재 기준이 아니다. 시도 변경·세종의 하위 목록 없음·검색·선택 유지 규칙과 출처는 [거주지 데이터](district-data.md)에 있다.

## 화면 대응

| 화면 | Stitch ID | 적용 위치 |
| --- | --- | --- |
| 메인 | `965aaa7f5b304945bda10be914db631d` | `/` |
| 로그인 | `3cb07a82b7ae42e0b76862f268f77b96` | `/login` |
| 주변 시설 및 카테고리 모달 | `53ee21d383f44dc2bde74d3265785fa8` | `/map` |
| 정책 둘러보기 | `62c9709e14ed4a4785abd3dd01bddb13` | `/policy` |
| 기본/관심 입력 | `9bdd98cdc5194107afd0c90fabfbd6ac` | `/policy/match` 1단계 |
| 상세 정보 입력 | `a0e0a64bd918429983b479c2e69fd416` | `/policy/match` 2단계 |
| 결과 및 조건 수정 | `eba4129bdbc74fd6914f5c74cde27b3f` | `/policy/match` 결과 |
| 정책 상세 | `b27e714f3ea3456f8800e3251336f9d2` | `/policy/[id]` |
| 커뮤니티 | `85d16885e472465687def352a937267f` | `/community` |
| 관리자(상세는 관리자 기준 문서) | `4fbedbe2d7b0433aaca3e30e9f2015be`, `a81eca9a24f94ba09a3bf90d4ec4bd7b`, `62fd4f5965bc4a53bd6c1a19d87bf78c`, `21b3352f27db40408746ed63aa668ce1`, `263f02ecd8e24a039392057750f65064`, `f3913f1dc8e841fb9f2299ad88c6925a`, `c9919003cfa4406aafc3da8590ab7cb9` | 기존 `/admin` 하위 화면 |

## 데이터와 미연동 범위

- 공개 정책 API는 ACTIVE 후보의 허용된 표시 필드만 반환한다. 내부 원문 스냅샷·서버 키·검수 내부 정보를 그대로 노출하지 않는다.
- 분야·지역 검색은 현재 원문 키워드 탐색이다. 분야 라벨의 저장·AI 보조 검수 적용은 완료 기록이 있으나 공개 라벨 검색·자격 비교는 미연결이다. 나이·소득·거주 조건 충족이나 지급액을 확정하지 않는다.
- 맞춤 입력은 현재 메모리에 유지되고, 보관함·글자 크기는 해당 브라우저에 저장된다. 상세 답변을 서버 프로필에 저장하거나 정책 자격 판정에 사용한다고 표시하지 않는다.
- 사용자 로그인은 카카오·네이버·구글만 대상으로 하며 현재 버튼은 준비 상태다. 인증 대기 시스템은 추가하지 않는다. 관리자 로그인은 별도 계약이다.
- 공개 커뮤니티는 분류·검색 입력·작성 안내 UI다. 게시글·댓글 저장과 실제 상세 내역은 연결 전이다. 관리자 커뮤니티 시안을 구성한 것을 공개 커뮤니티 백엔드 완료로 보지 않는다.
- 지도에서 운영시간·연락처·정원·예약 등의 정보를 API가 제공하지 않으면 생성하지 않는다. 외부 SDK/API 오류는 빈 검색 결과와 구분해야 한다.

## 검증 기록과 재현

2026-09-08~09 UI 작업에서 ESLint·TypeScript·Webpack 프로덕션 빌드 및 공개 브라우저 회귀 검사를 수행했다. 320/390/768/1280px 배치, 메뉴·모달 초점, 지도 합성 응답, 조건 입력·답변 보존 등을 확인했다. 수정별 상세 결과는 [과거 QA 기록](../archive/ui-qa-history-20260909.md), 교육·지역 선택의 추가 확인 여부는 각 기준 문서에 남긴다. 이 문서 정리 작업에서 제품 테스트를 다시 실행한 것은 아니다.

```bash
npm run build -- --webpack
node --experimental-strip-types src/features/policy/public-data.test.ts
UI_TEST_ORIGIN=http://127.0.0.1:3010 node scripts/ui/check-browser.mjs
```

브라우저 검사는 로컬 Next 서버와 Chromium 디버깅 포트 9225가 먼저 실행되어야 한다. `UI_TEST_DEBUG`로 디버깅 주소, `UI_TEST_SCREENSHOTS`로 캡처 디렉터리를 지정할 수 있다. 스크립트는 지도 외부 서비스를 합성 데이터로 대체하므로 실제 Naver 서비스 연결 성공을 증명하지 않는다. 교육 추가 후 공개 화면 전체 시각 검수는 [다음 작업](../next-steps.md)에 남겨 두었다.

지도 아이콘은 Google Material Symbols Outlined의 원본 SVG이며 [라이선스](../../public/licenses/material-design-icons.txt)를 유지한다. 시안의 가상 후기·정책 금액·운영 건수·수혜 확정 문구는 실제 데이터로 복사하지 않는다.
