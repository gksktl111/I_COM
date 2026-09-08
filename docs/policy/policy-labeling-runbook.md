# 정책 라벨링 실행 안내

기준일: 2026-09-08 · 평가 버전: `interest-taxonomy-2/rules-1`

**현재 상태: 사용자 승인 후 원격 개발 DB 마이그레이션·1,000건 라벨 및 검수 저장·실제 동작 검증 완료.** `20260908120844` 마이그레이션을 적용했고, 전체 검수 묶음 재실행 후에도 제안 1,000건·검수 1,000건·현재 라벨 1,000건·누락 0건이다. 자동 승인 심사로 처음 보류됐으나 사용자 승인 후 적용했다.

이번 작업은 활성 정책 후보의 6개 분야 라벨을 자동 제안하고 원문 검수 이력을 저장하는 기능이다. 기존 7개 관련성 평가, 원본·정제 데이터, 공개 승인 상태를 변경하지 않는다. 공개 UI 검색은 기존 키워드 조회를 유지한다. `VERIFIED` 라벨도 신청 자격 충족이나 공개 승인을 뜻하지 않는다.

## 1. 구현 범위

구현 파일은 [마이그레이션](../../supabase/migrations/20260908120844_policy_interest_labeling.sql), [실행 CLI](../../scripts/policy/label.ts), [검수 계획 검증](../../src/features/policy/server/labeling-plan.ts)이다. 분야·경계는 [라벨링 기준](./policy-labeling-standard.md)을 따른다.

| 객체 | 역할 |
| --- | --- |
| `policy_label_observations` | 원본 스냅샷·정제 버전·표시 해시·전체 정제값 해시·평가 버전에 묶인 자동 제안 이력 |
| `policy_label_reviews` | 제안에 연결된 원문 검수 결과, 이전 검수 ID, 재실행 키, 검수자·종류·사유·시각 |
| `policy_current_labels` | 현재 `ACTIVE` 정책과 모든 유효성 값이 일치하는 제안 및 최신 검수 결과 |
| `policy_assign_labels` / `policy_label_backfill` | 단일 정책 또는 최대 100건씩 기존 활성 후보의 자동 제안 생성 |
| `policy_review_labels` | 원본·버전·검수 충돌·정확 인용을 검사한 후 검수 이력 추가 |
| `policy_label_on_activation` | 정책 INSERT 또는 관련성·정제값·적용 스냅샷 UPDATE 시 `RELATED` 정책에 자동 제안 생성 |

자동화는 DB 트리거에 연결되므로 적용 후 활성화·원본 갱신에 별도 예약 작업이 필요하지 않다. 마이그레이션 이전 활성 후보에는 명시적 backfill이 필요하다. 현재 원격 개발 DB에 적용되어 동작한다.

규칙은 현재 33개, 명명된 세부 유형은 27개다. 규칙은 지원내용과 대상·제목 근거를 연결해 `PROPOSED`, `NEEDS_REVIEW`, `OUT_OF_TAXONOMY` 중 하나를 만든다. 자동 규칙만으로 `VERIFIED`를 만들지 않는다. 규칙의 초안 건수는 최종 검수 결과와 별개이며 현재 원본·규칙으로 다시 집계한다.

## 2. 저장과 검수 계약

`assessment`에는 `version`, `status`, `categories`, `labels`, `targets`, `reason`이 들어간다. 각 `labels[]`는 `category`, `subcategory`, 지원 경로 설명인 `path`, 원문 `evidence[]`를 갖는다. 자동 제안에는 적용 `rule`도 포함한다. `categories`는 라벨에 나타난 분야와 일치해야 한다.

검수 결과는 `VERIFIED`, `NEEDS_REVIEW`, `OUT_OF_TAXONOMY`, `OUT_OF_SCOPE`를 허용한다. `VERIFIED`에는 하나 이상의 라벨이 필요하고, 사전 밖·범위 밖 결과에는 라벨을 두지 않는다. 각 라벨에 `benefit_text` 근거가 반드시 필요하다. 인용은 현재 정제 표시값의 정확한 부분문자열이어야 하며 DB는 `name`, `target_text`, `benefit_text`, `purpose_text`, `criteria_text`만 허용한다. 이번 전수 검수는 제목·대상·지원내용을 직접 읽어 기록했다.

`review_kind`는 `HUMAN` 또는 `AI_ASSISTED`를 저장할 수 있다. 현재 CLI는 항상 `AI_ASSISTED`로 기록한다. 이번 결과를 인간 검수로 표시하지 않는다. 인용 일치는 원문 연결을 보증하는 검사이며 의미 판단의 정확도 보증은 아니다.

정책의 현재 스냅샷, 정제 버전, 표시 해시, **전체 `normalized` JSON의 해시**, 평가 버전이 모두 일치해야 현재 라벨이 유효하다. 전체 정제값 해시는 DB 내부 `md5(normalized::text)` 비교에 사용하며 인증용 값이 아니다. 조건 원문 등 표시 해시 외 값이 바뀌어도 옛 검수가 현재 라벨로 재사용되지 않는다. 과거 이력은 보존하며 `STALE` 행을 덮어쓰는 방식 대신 현재 뷰에서 제외한다.

두 테이블은 RLS를 켜고 `anon`·`authenticated` 접근을 차단한다. `service_role`에는 조회·추가만 부여하며 수정·삭제 권한은 부여하지 않는다. 뷰·RPC도 서버 전용이며 함수는 `SECURITY INVOKER`다. 운영은 검수 RPC로 새 이력을 추가하고 기존 이력을 수정하지 않는다.

## 3. 실행 순서

환경 파일 `.env.local`에 서버용 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`를 설정한다. 키를 문서·로그·브라우저에 넣지 않는다. 쓰기에는 `POLICY_SYNC_ENABLED=true`도 필요하다. URL은 자격증명·추가 포트 없는 HTTPS `*.supabase.co` 주소만 허용한다.

1. 원격 스키마 변경 승인 후 `20260908120844_policy_interest_labeling.sql`의 적용 이력과 객체를 확인한다. 현재 개발 DB에는 적용 완료했으므로 재적용하지 않는다.
2. 기존 활성 후보에 자동 제안을 생성한다. 같은 입력·평가 버전의 제안은 중복 생성하지 않는다.
3. 현재 스냅샷과 전체 정제값에 묶인 검수 bundle을 준비하고, 미리보기로 원본·계획 일치를 확인한다.
4. 검수를 저장하고 전체 활성 후보의 현재 라벨 누락과 결과 건수를 대조한다.

```bash
# 읽기 보고서: DB 쓰기 없음, 로컬 보고서 작성
npm run policy:label

# 기존 ACTIVE 후보의 자동 제안 backfill 후 보고서
POLICY_SYNC_ENABLED=true npm run policy:label -- --apply

# 검수 bundle의 원본·버전·계획 일치 검사: 검수 저장 없음
npm run policy:label -- --reviews .local/policy-labeling/review-bundle.json

# 준비한 검수 결과 저장
POLICY_SYNC_ENABLED=true npm run policy:label -- --reviews .local/policy-labeling/review-bundle.json --apply
```

`--reviews --apply`는 backfill을 함께 실행하지 않는다. 해당 원본의 현재 자동 제안이 먼저 있어야 한다. 읽기 보고서도 `policy_current_labels`를 사용하므로 마이그레이션이 없는 원격 DB에서는 실행할 수 없다.

bundle은 `{ reviewRun, items }` 형식이다. 각 item은 `sourceId`, `snapshotId`, 전체 `normalized`, `reviewer`, `reason`, `assessment`를 포함한다. 검수자가 기록한 부분 결과 배열을 그대로 CLI에 넣지 않는다. 현재 준비한 bundle은 `.local/policy-labeling/review-bundle.json`이며 원격 적용 시점에 원본 유효성을 다시 검사한다.

CLI는 활성 후보와 현재 라벨을 500건씩 조회한다. 기본 보고서는 `.local/policy-labeling/report.json`이며 `--output`으로 파일 경로를 바꿀 수 있다. 보고서에는 전체 활성 수, 현재 라벨 수, 상태·분야별 수, 누락 ID와 라벨이 들어간다. 디렉터리·새 파일은 각각 `0700`·`0600`으로 생성한다. `applied`는 CLI의 `--apply` 여부이며 원격 마이그레이션 적용이나 인간 검수 완료를 뜻하지 않는다.

## 4. 재실행과 충돌 처리

첫 검수 쓰기 전에 CLI는 프로젝트 호스트와 `reviewRun`으로 구분한 `.local/policy-labeling/plan-<hash>.json`을 배타적으로 생성한다. 이 계획은 bundle 바이트 해시, 제안 ID, **처음 읽은 이전 검수 ID**를 고정한다. 재실행이 다른 검수자의 새 결과를 자동으로 기준 삼아 덮어쓰지 않는다.

각 검수는 `<reviewRun>:<sourceId>`를 재실행 키로 사용한다. 이미 같은 내용으로 저장했다면 기존 검수 ID를 반환한다. 같은 키로 다른 내용·검수자·사유를 보내면 거절한다. 정책 단위로 잠그고 이전 검수 ID를 검사하므로 새로운 검수가 먼저 저장된 경우 충돌한다. CLI 전체는 한 트랜잭션이 아니므로 중도 실패 전 일부 항목은 저장될 수 있다. 같은 bundle·계획을 보존한 채 재실행하면 완료 항목을 중복 저장하지 않는다.

| 오류·상황 | 처리 |
| --- | --- |
| `writes-disabled` | 승인된 쓰기 환경의 `POLICY_SYNC_ENABLED` 설정 확인 |
| `invalid-database-environment`, `database-http-*` | 대상 프로젝트·서버 키·마이그레이션·RPC 접근 상태 확인. 키나 응답 원문을 공개하지 않음 |
| `stale-review-source`, `stale-review-plan`, DB `STALE_LABEL_REVIEW` | 원본·정제값·평가 버전 변경 또는 현재 제안 부재 확인 후 영향 경로 재검수 |
| `review-plan-conflict`, DB `LABEL_REVIEW_KEY_CONFLICT` | 같은 실행 키의 bundle 변경 여부 확인. 기존 계획을 삭제해 충돌을 우회하지 않음 |
| DB `LABEL_REVIEW_CONFLICT` | 다른 검수 변경과 대조·조정 후 새 검수 실행을 준비 |
| `duplicate-review-source` | bundle 내 중복 정책 ID 제거 후 검수 범위 재확인 |
| `INVALID_LABEL_EVIDENCE`, `INVALID_LABEL_CATEGORY` | 인용·분야·세부 유형을 현재 원문 및 규칙과 대조 |
| `active-policies-missing-labels` | 작성된 보고서의 누락 ID 확인. 실행 중 활성 후보 변경이나 backfill 누락을 조사 |

CLI는 원격 오류 본문 대신 HTTP 상태 오류를 출력한다. DB 예외를 확인할 때도 서버 운영 경로에서 확인한다. 규칙 변경은 평가 버전을 올려 이전 제안·검수의 유효성을 분리해야 한다. 새 버전 backfill과 재검수 없이 이전 결과를 다시 현재 결과로 간주하지 않는다.

## 5. 이번 검수와 검증 결과

활성 후보 1,000건의 제목·대상·지원내용을 전수 AI 보조 검수하고, 실제 1,000건의 원문을 PGlite에 가져와 자동 제안과 검수를 모두 저장했다. 로컬 결과는 다음과 같다.

| 검수 상태 | 정책 수 |
| --- | ---: |
| `VERIFIED` | 850 |
| `NEEDS_REVIEW` | 74 |
| `OUT_OF_TAXONOMY` | 63 |
| `OUT_OF_SCOPE` | 13 |
| 합계 | 1,000 |

집계와 검수 파일의 SHA-256 식별값은 [검증 기록](../fixtures/policy-labeling/validation.json)에 있다. 상세 기록은 `.local/policy-labeling/local-validation.json`에 있다. 로컬 관측 이력 1,000건·검수 1,000건의 저장 결과이며 원격 저장 건수나 공개 정책 수가 아니다.

독립 AI 검수 표본은 기존 긍정 결과 100건과 기타 상태 25건, 총 125건이다. 109건 일치·16건 차이를 확인했고, 공통 경계 보완을 포함한 20건의 조정 결정을 `.local/policy-labeling/adjudications.json`에 남겼다. 표본·독립 결과는 `independent-sample.json`, `independent-review.json`에 보존한다. 이 자료는 기준 보완에 사용했으므로 최종 독립 정확도 평가가 아니다. 인간 검수 완료, 정밀도 95%·재현율 90% 달성을 주장하지 않는다.

직접 실행한 정책 테스트 18개 파일·160건이 실패·취소 없이 통과했다(종료 코드 0). DB 검사 13개와 검수 계획 검사 2개는 이 160건에 포함한다. DB 검사는 트리거·재실행·원본 갱신·검수 충돌·근거·권한을 포함한다. 공개 UI 검사 7건과 직접 TypeScript 검사도 통과했다. 최초 전체 빌드는 샌드박스의 자식 프로세스/Node `EPERM` 오류로 중단됐다. 이후 승인된 실행 환경에서 `npm run build -- --webpack`의 ESLint·TypeScript·프로덕션 빌드를 통과했다. 제품 코드를 바꿔 환경 오류를 우회하지 않았다.

원격에서 같은 1,000건 결과를 확인했다. `service_role`로 원문 갱신·재활성화·새 제안 생성·옛 검수 제외·반복 갱신 중복 방지를 검증했고 임시 정책 변경은 롤백했다. 최초 검증 스크립트는 원문 변경으로 무효화된 관련성에 상태만 덧씌워 실패했으며, 원래 관련성 평가를 보존해 복원하도록 입력을 수정한 뒤 통과했다. 제품 코드는 변경하지 않았다. 보안 advisor의 신규 경고는 없으며 기존 `rls_auto_enable` 함수 접근 2건과 유출 비밀번호 보호 설정 1건은 이번 변경과 별개다.

 공개 검색 연결, 자격 조건 구조화·비교, 별도 품질 평가와 인간 검수는 후속 범위다.
