# 정책 수집·저장 작업 계약

정리일: 2026-09-11. Gov24 수집 계약과 저장 스키마 문서를 통합했다. 구현된 수집·저장 책임을 설명하며, 정책의 공개·추천 자격 승인을 뜻하지 않는다. 운영 설정·자동 수집의 세부 동작은 [자동 수집·품질 계약](collection-runbook.md), 실행·복구는 [수집 안내](collection-runbook.md)를 따른다.

## 식별과 수집 완전성

출처는 `(provider, external_id)`로 식별한다. provider는 GOV24, BOKJIRO_CENTRAL, BOKJIRO_LOCAL을 구분하며 실행·읽기·쓰기·재개·잠금에 일관되게 적용한다. RPC payload.provider를 생략하면 GOV24다. 복지로는 list/detail의 servId와 원문 XML을 검증하며 [복지로 안내](collection-runbook.md)의 출처별 계약을 따른다. 아래 상세 응답 계약은 Gov24에 적용한다.

- `서비스ID`는 공백 제거나 숫자 변환 없이 정확히 비교하는 비어 있지 않은 문자열이다. 선정 목록에 한 번, 상세와 지원조건에 각각 한 번 있어야 한다.
- 매 실행 선정 당시의 목록 검색 조건을 첫 페이지부터 다시 순회한다. 목록 서비스ID 필터를 만들어 쓰지 않는다. 페이지별 HTTP 200, JSON 객체, 정수 건수, 요청 페이지·크기 일치, `currentCount=data.length`, 일관된 `matchCount/totalCount`, 누적 건수와 마지막 빈 페이지를 확인한다. 중복 ID, 건수 변화, 페이지 상한, 호출 예산 소진은 미완료다.
- 상세/조건 0건·복수 건·ID 불일치는 격리한다. 초기 8개 표본에서 정상 조건 0건을 관찰하지 못했으므로 이 계약에서는 허용하지 않는다. 완화하려면 별도 근거와 계약 변경이 필요하다.
- 같은 묶음의 목록·상세·조건만 결합한다. 기능별 조회 시각과 페이지 메타데이터를 보존한다. 첫 목록 조회부터 마지막 조건 조회까지 10분을 넘으면 재수집한다. 10분은 내부 안전 한도이며 제공자의 동시 버전 보장이 아니다.
- 파싱한 JSON 전체를 원본으로 보존한다. 누락/null/빈 문자열/0/false와 새 필드를 유지한다. 실패 원본은 정상 원본과 구분하고 표시 반영에 사용하지 않는다.

이 기준은 [8개 실제 표본 검증](../records/gov24-validation.md#policy-api-validation)에 근거한 보수적 내부 계약이며 제공자 전체 데이터의 보장이 아니다.

## 표시 필드와 정제

내부 텍스트는 `string | null`, 필수 이름은 비어 있지 않은 `string`이다. 원본은 문자열·null·누락만 허용하며 숫자·객체를 문자열로 강제 변환하지 않는다. 빈 문자열·공백은 null로 정리하되 원래 빈 값 종류를 보존한다. 같은 묶음에서도 자동 fallback은 하지 않는다.

| 내부 필드 | 원본 endpoint / 필드 | 처리 |
| --- | --- | --- |
| name | serviceDetail / 서비스명 | 필수. 목록 이름과 불일치하면 격리 |
| summary | serviceList / 서비스목적요약 | 상세 목적과 별도 보관 |
| purpose_text | serviceDetail / 서비스목적 | nullable |
| target_text | serviceDetail / 지원대상 | 자격 해석 없음 |
| criteria_text | serviceDetail / 선정기준 | 자격 해석 없음 |
| benefit_text | serviceDetail / 지원내용 | 금액·단위·부정문 보존 |
| application_method_text | serviceDetail / 신청방법 | 표시 문장 |
| application_period_text | serviceDetail / 신청기한 | 기간·접수 상태 추정 없음 |
| required_documents_text | serviceDetail / 구비서류 | 표시 문장 |
| provider_name | serviceDetail / 소관기관명 | 적용 지역 추정 없음 |
| reception_text | serviceDetail / 접수기관명 | null을 과거 값으로 복원하지 않음 |
| contact_text | serviceDetail / 문의처 | 원문 구분자 보존 |
| source_url | serviceList / 상세조회URL | 아래 URL 규칙 |
| application_url | serviceDetail / 온라인신청사이트URL | 아래 URL 규칙 |

HTML은 실제 파서로 처리한다. script/style을 제거하고 문단·목록·br 경계를 줄바꿈으로 보존하며 엔티티를 해제한다. CRLF/CR은 LF로 통일하고 앞뒤 공백과 과도한 빈 줄을 정리한다. 숫자·단위·목록 번호와 HTML이 아닌 `<`, `>` 비교 표현은 재작성하지 않는다. 원본 JSON은 수정하지 않는다.

URL은 원문과 `empty/valid/invalid` 상태를 별도 보관한다. 사용자정보·공백이 없는 단일 절대 http/https URL만 링크 값으로 허용한다. 복수 URL 중 하나를 임의 선택하거나 잘린 URL을 복구하지 않는다. `valid`는 문법 상태이며 공식성·접속·신청 가능성은 별도 검수다. 서울형 아이돌봄비처럼 URL 필드와 설명 속 URL 길이가 다르면 경고로 남긴다.

각 필드의 `field_sources`에는 endpoint·원본 필드·빈 값 종류·`fallback=false`를 기록하고 적용 스냅샷 FK로 원본에 연결한다. 목록/상세 지원내용·신청방법의 요약/상세 차이는 경고로 남기며 위 표가 지정한 상세 필드를 사용한다.

## 날짜·조건·해시

목록 `수정일시`는 14자리 달력 문자열, 상세는 `YYYY-MM-DD`로 관찰됐다. 원문과 형식/달력 검증 상태를 각각 저장하며 시간대를 추정해 UTC로 바꾸지 않는다. 동일 endpoint의 유효한 동일 형식 값이 이전 반영본보다 작으면 원본 저장 후 표시 반영을 보류한다. 형식 미확인·변경도 자동 최신 판정을 보류한다. 목록/상세는 날짜 정밀도로만 차이를 관찰하고 서로 덮어쓰지 않는다.

지원조건의 Y/null과 정수 연령은 원본 코드다. Boolean 변환, 대상·단위 추정, 자격 규칙 생성을 하지 않는다. 신규 코드·값은 원본 보존과 UNKNOWN 경고 대상으로 두며 구조·ID 검증은 계속한다.

SHA-256 입력은 객체 키를 재귀 정렬하고 배열 순서를 보존한다. 원본 해시는 apiVersion·externalId·목록 행·상세 배열·조건 배열·완전 상태를 포함하고 조회 시각·실행 ID·페이지 건수·재시도 횟수는 제외한다. 표시 해시는 실제 표시 값만 포함하며 조건 해시는 별도다. 해시·정규화 버전을 저장한다.

현재 반영본과 비교해 무변경/원본만 변경/표시 변경/조건 변경을 구분한다. A→B→A는 기존 A 스냅샷을 재사용하되 현재 B와의 전후 반영 이력을 남긴다. 저장 원본 재정규화는 API 없이 같은 정규화 함수를 사용한다.

## 저장 구조와 권한

초기 `20260907181933_policy_ingestion.sql`에 다중 출처 `20260907192856_policy_multiple_providers.sql`, 자동 품질 `20260908053334_policy_automatic_quality.sql`이 확장 적용됐다. 초기 GOV24 단일 제약을 현재 제약으로 읽지 않는다.

| public 테이블 | 키·저장 책임 |
| --- | --- |
| policy_sources | UUID PK, provider·external_id text, UNIQUE(provider,external_id), 관찰/성공 timestamptz |
| policy_source_snapshots | UUID PK, source_id FK, raw_hash·hash_version text, raw jsonb, 최초 captured_at timestamptz, UNIQUE(source_id,hash_version,raw_hash), UNIQUE(source_id,id) |
| policies | source_id UUID PK/FK, applied_snapshot_id UUID, normalized jsonb(표시·출처·해시·버전), updated_at timestamptz. 복합 FK(source_id,applied_snapshot_id)로 스냅샷 소유 출처 일치 |
| policy_sync_runs | UUID PK, provider, trigger(manual/scheduled/reprocess), scope jsonb(선정 필터), status, 시작/종료 시각, calls, summary, collection_mode |
| policy_sync_items | (run_id,external_id) PK, PENDING/SUCCESS/FAILED, attempts, snapshot_id·before_snapshot_id, changes, error_code, evidence, attempt_history, updated_at |
| policy_sync_locks | 출처별 name PK, owner UUID nullable, generation bigint, expires_at timestamptz. 획득마다 세대 증가 |

스냅샷 raw에는 최초 evidence를 포함한 RawBundle 전체를 보존한다. evidence는 해시에서 제외하므로 같은 원본을 재사용하되 실행 항목에 이번 조회 evidence를 별도로 기록한다. attempt_history는 실패·중단 원본과 시각·오류를 보존한다. FK 조회·검증 인덱스를 유지하고 외부 정책 삭제나 CASCADE 정리 API는 만들지 않는다.

모든 RPC는 public의 `SECURITY INVOKER`, 고정 search_path이며 service_role만 EXECUTE 가능하다. 모든 테이블에 RLS를 활성화하고 anon/authenticated/PUBLIC의 데이터·쓰기·함수 권한을 철회한다. service_role에는 필요한 SELECT/INSERT/UPDATE만 부여한다. 함수별 기본 PUBLIC EXECUTE도 명시적으로 철회한다.

## RPC·임대·오류 계약

서버 내부에서 `policy_sync_command(p_action text,p_payload jsonb)` 입력을 구성하며 DB가 제약과 실행 범위를 재검사한다. 아래 payload에 출처 계약을 함께 적용한다.

| action | payload와 동작 |
| --- | --- |
| start | `{runId,trigger,scope,resumeRunId?}`. 출처 잠금을 FOR UPDATE로 획득. 유효 소유자가 있으면 별도 SKIPPED 실행. 재개는 이전 범위·완료 항목과 동일 runId를 유지하고 새 세대 발급. `{runId,generation,status,completedIds}` 반환 |
| heartbeat | `{runId,generation}`. 소유자·세대·만료·RUNNING 검증 후 TTL 연장 |
| snapshot | `{runId,generation,externalId,raw,rawHash,hashVersion,evidence}`. scope 내 ID만 허용. 스냅샷 중복 방지와 항목 시도·근거 저장. `{snapshotId}` 반환 |
| apply | `{runId,generation,externalId,snapshotId,normalized,changes}`. 현재 표시 잠금과 before 포인터 확보, 스냅샷 소유 검증. 표시·근거 FK·버전·SUCCESS·전후 스냅샷·변경 필드·성공 시각을 단일 트랜잭션 반영. 날짜 역전은 서버에서 먼저 차단. `{status:'SUCCESS'}` 반환 |
| fail | `{runId,generation,externalId,errorCode,evidence}`. 항목을 FAILED로 갱신하고 기존 표시·적용 포인터 유지 |
| finish | `{runId,generation,calls,errorCode?}`. 항목 집계로 SUCCESS/PARTIAL/FAILED 결정, 잠금 해제. 미완료는 성공 아님. `{status,success,failed,pending}` 반환 |
| current | `{externalId}`. 서버 읽기 전용 `{snapshotId,raw,normalized}` 또는 null |
| run | `{runId}`. 서버 읽기 전용 실행·항목 확인 |

임대 TTL은 120초다. 모든 쓰기는 같은 출처 잠금 행을 FOR UPDATE로 잠그고 소유자·세대·유효기간·RUNNING을 다시 검증한다. 종료된 실행의 늦은 쓰기는 거부한다. HTTP 중 DB 트랜잭션을 유지하지 않고 API 요청 전에 heartbeat한다. 중단 후 임대가 만료되면 동일 실행을 재개하고 SUCCESS는 건너뛴다. 나머지는 세 API를 새로 수집하며 미완료 원본과 새 응답을 섞지 않는다.

정책 하나가 반영 단위다. 원본 저장 후 표시·근거 FK·변경 이력·완료를 원자적으로 커밋한다. API·정규화·DB 오류 시 그 정책의 기존 표시를 유지하며 누락 정책을 삭제하지 않는다. dry-run은 읽기·조회·정규화만 수행하고 current/run 외 RPC, 잠금·실행 기록 쓰기를 하지 않는다.

Gov24 수집의 제한 재시도는 네트워크/5xx만 허용하며 호출 예산에 포함한다. 인증·권한·429는 실행을 멈추고 다음 수동 실행으로 보류한다. 자동 수집의 출처별 예산·정지·재개 조건은 운영 계약을 따른다. 과거 미확인 계정 한도나 예약 실행을 현재 완료 상태로 간주하지 않는다.

## 자동 수집 확장의 저장 경계

- `policy_auto_jobs`: 설정·다음 페이지·기대/발견 건수·전체 탐색 완료·정지 사유.
- `policy_auto_pages`: 실행/페이지 원본 목록·ID·캡처 시각. 페이지 저장과 동적 항목 생성은 원자적이다.
- `policy_api_daily_usage`: 출처/UTC 일별 보수적 호출 예약량·설정 상한.
- `policy_quality_observations`: 항목별 누적 품질 관찰, 스냅샷·평가 버전·상태·필수값 통계·구조화 이슈.
- 자동 탐색 전 빈 scope는 허용하지만 기존 선택 수집의 비어 있지 않은 scope 제약은 유지한다.
- RPC wrapper는 `policy_sync_command_v2`의 잠금·원본·반영 로직을 재사용한다. apply/fail과 품질 관찰은 같은 트랜잭션이며 자동 finish에는 전체 탐색 완료와 미완료 항목 0이 필요하다.
- `policy_admin_report`는 overview/runs/quality와 커서 페이지를 제공하고 raw·XML·normalized는 반환하지 않는다. 새 테이블도 RLS·service_role 한정 접근과 FK·실행/출처/상태·커서·이슈 인덱스를 유지한다.

검증 근거는 [수집 검증 기록](../records/gov24-validation.md#policy-sync-validation)에 있다. PGlite의 단일 연결 SQL 검증, 실제 다중 요청 경합, Data API 권한, 실제 예약 실행은 서로 다른 증거다. 과거 통과를 변경 후 검증이나 현재 운영 완료로 대체하지 않는다.
