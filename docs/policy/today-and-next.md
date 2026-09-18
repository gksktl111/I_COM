# 오늘 한 일 · 내일 할 일

2026-09-18 Goal 1 완료 및 인계 기록

## 현재 상태

- 여섯 화면 태그 기준의 남은 REVIEW 1,406건 전수 판정과 원격 적용을 완료했다.
- 원격 정책 상태는 **ACTIVE 4,414건 · REVIEW 79건 · EXCLUDED 1,402건**이다.
- 신규 수집용 `policy-relevance-4` 구현·회귀 검증·원격 마이그레이션 적용을 완료했다.
- Supabase 정책 DB는 **585MB에서 368MB**로 줄였고 무료 티어 500MB와 내부 목표 450MiB 아래다.

## 오늘 완료한 작업

### 1. 남은 검토 정책 1,406건 전수 판정과 적용

- 저장된 표시 원문을 기준으로 ACTIVATE 963건, EXCLUDE 364건, KEEP_REVIEW 79건을 확정했다.
- `policy-relevance-review-6`에 세 결정을 모두 저장하고, 원문·스냅샷·직전 판정 고정과 이전 검수 버전의 덮어쓰기 방지를 유지했다.
- `20260913162532_policy_six_tag_disposition` 마이그레이션과 고정된 1,406건 계획을 원격 DB에 적용했다.
- 적용 직후 1,406건 전부를 재조회했고, v6 관찰 이력 1,406건과 공개 활성 조회 4,414건을 독립 확인했다.
- 관련 단위·DB 통합 테스트 58건, 변경 파일 ESLint, diff 공백 검사를 통과했다.
- 상세 근거와 결과는 [여섯 태그 전수 판정 검토](records/six-tag-disposition-review-20260914.md)에 보존했다.

### 2. 신규 수집 검수 로직 완료

- 신규 수집용 평가 버전 `policy-relevance-4`와 여섯 태그 분류기를 추가했다.
- 제목만 보고 목록 단계에서 제외하던 흐름을 제거하고, 상세 원문의 `target_text`와 `benefit_text`를 확보한 뒤 판정하도록 바꿨다.
- 실제 대상·지원 내용이 태그에 부합하면 RELATED, 명확한 범위 밖이면 UNRELATED, 원문 부족이나 새 표현이면 REVIEW로 보존하도록 구성했다.
- 세부 자격의 불확실성은 관련성 REVIEW로 확대하지 않고 `conditionChecks`에 남기도록 했다.
- 수집 저장 경로가 v4 판정과 직접 근거를 함께 전달하도록 수정했고, 기존 수동 검수 v5·v6을 자동 판정이 덮어쓰지 못하도록 하는 마이그레이션을 작성했다.
- 신규 UNRELATED는 스냅샷·정규화 원문·직접 근거를 보존하고 정책 본체에는 삽입하지 않으며, 임의의 짧은 부분 인용은 거부한다.
- 제목과 상세 급여가 섞인 경우 상세 급여를 우선하고, 사업체 직접 지원을 개인 생활지원으로 활성화하지 않도록 경계 사례를 보강했다.
- 관련 구현은 [collection-relevance.ts](../../src/features/policy/server/collection-relevance.ts), 원격 적용 마이그레이션은 [20260913173627_policy_collection_relevance_v4.sql](../../supabase/migrations/20260913173627_policy_collection_relevance_v4.sql)이다.
- 정책 테스트 33개 파일, lint, Node 22 기반 Next 프로덕션 빌드를 통과했다. 원격 함수는 `security invoker`, 고정 `search_path`, service role 전용 실행 권한을 재검증했다.

### 3. Supabase DB 보존 정리 완료

삭제 대상을 실행 ID와 digest로 고정하고, 출처별 최신 자동 실행 1건씩 총 3건을 보존했다. 과거 실행 전용 데이터만 트랜잭션으로 삭제한 뒤 네 테이블의 물리 공간을 회수했다.

| 테이블 | 정리 전 | 정리 후 |
| --- | ---: | ---: |
| `policy_source_snapshots` | 249MB | 227MB |
| `policy_sync_items` | 236MB | 69MB |
| `policy_auto_pages` | 20MB | 약 7.8MB |
| `policy_quality_observations` | 17MB | 약 2.9MB |

- 삭제: 자동 실행 8건, 수집 항목 11,440건, 자동 페이지 237건, 품질 관찰 6,310건, 작업 8건, 미참조 스냅샷 1,213건.
- 보존: 정책 5,895건, v6 관찰 1,406건, 모든 라벨·관련성 관찰, 출처별 최신 자동 실행 3건.
- 최종 DB 크기: **385,977,491바이트(368MB)**.
- 상세 결과와 재현 가능한 범위는 [DB 용량 정리 기록](records/database-retention-20260918.md)에 보존했다.

## Goal 1 종료 상태

- 원격 완료: `policy-relevance-review-6` 전수 판정, `policy-relevance-4` 신규 수집 계약, 두 마이그레이션 등록과 검증.
- 원격 완료: 고정된 자동 수집 과거 이력 정리와 네 테이블 물리 공간 회수.
- 검증 완료: 정책 테스트 33개 파일, lint, 프로덕션 빌드, 원격 정책 건수와 함수 권한.
- 남은 원격 작업: 없음. PR은 `dev` 대상으로 만들고 병합하지 않는다.

## 다음 단계로 넘길 사항

- 다음 작업은 Step 2인 사용자 페이지 디자인 개선이다. 시작 전에 `DESIGN.md`를 다시 읽고 admin 페이지는 범위에서 제외한다.
- 기존 Supabase 어드바이저 경고 3건은 이번 Goal 1의 변경에서 생긴 것이 아니다. `rls_auto_enable()` 실행 권한 2건과 유출 비밀번호 보호 비활성 1건은 인증 작업 또는 별도 보안 커밋에서 다룬다.
- 활성 정책은 태그 관련성이 확인된 상태이지 개인별 신청 자격·현재 모집·공개 승인까지 끝난 상태가 아니다.
- 다음 DB 정리에서는 이번 고정 ID를 재사용하지 않고 새 preflight·계획 digest를 만든다.
