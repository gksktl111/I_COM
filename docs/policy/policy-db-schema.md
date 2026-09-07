# 정책 수집 저장 계약 v1

[실응답 계약](./policy-data-contract.md)에 따른 초기 수집 전용 스키마다. 승인된 policy-dev 개발 DB에 버전20260907181933으로 적용하고 원격 검증했다. UI 공개·추천·자격 규칙 테이블은 포함하지 않는다.

## 테이블

| public 테이블 | 키·타입·역할 |
| --- | --- |
| policy_sources | UUID PK, provider=GOV24, external_id text, UNIQUE(provider,external_id), 관찰/성공 timestamptz |
| policy_source_snapshots | UUID PK, source_id FK, raw_hash text, hash_version text, raw jsonb, 최초 captured_at timestamptz, UNIQUE(source_id,hash_version,raw_hash), UNIQUE(source_id,id) |
| policies | source_id UUID PK/FK, applied_snapshot_id UUID, normalized jsonb(표시·출처·해시·버전), updated_at timestamptz. (source_id,applied_snapshot_id) 복합 FK로 원본 소유 출처 일치 |
| policy_sync_runs | UUID PK, trigger text(manual/scheduled/reprocess), scope jsonb(선정 필터 포함), status text, started_at/finished_at timestamptz, calls integer, summary jsonb |
| policy_sync_items | (run_id,external_id) PK, 상태 PENDING/SUCCESS/FAILED, attempts integer, snapshot_id 및 before_snapshot_id UUID nullable, changes jsonb, error_code text nullable, evidence jsonb, attempt_history jsonb(실패/중단 원본·시각·오류 이력), updated_at timestamptz |
| policy_sync_locks | name text PK(GOV24), owner UUID nullable, generation bigint, expires_at timestamptz. 세대는 획득마다 증가 |

스냅샷 원본은 RawBundle 전체이며 최초 수집 evidence를 포함한다. 해시에는 evidence를 넣지 않아 동일 원본을 재사용한다. 실행 항목에는 이번 evidence를 별도 기록해 재사용 시에도 실제 조회 근거를 잃지 않는다. 외래키의 조회/검증 인덱스를 둔다. 외부 정책을 삭제하거나 CASCADE 정리하는 API는 만들지 않는다.

## RPC 계약

모든 RPC는 public 이름공간의 `SECURITY INVOKER`, 고정 search_path, 서버 service_role만 EXECUTE 가능하다. 모든 테이블 RLS 활성화, anon/authenticated/PUBLIC의 데이터·쓰기·함수 권한은 철회한다. service_role에는 필요한 SELECT/INSERT/UPDATE만 부여한다. 기본 PUBLIC EXECUTE를 각 함수에서 명시적으로 철회한다.

단일 `policy_sync_command(p_action text,p_payload jsonb)` RPC로 아래 작업을 수행한다. 입력은 서버 내부에서만 만들고 DB 제약과 실행 범위를 재확인한다.

- start: {runId,trigger,scope,resumeRunId?}. GOV24 잠금 행을 FOR UPDATE로 획득, 유효 소유자가 있으면 별도 SKIPPED 실행 반환. 재개는 이전 실행의 범위와 완료 항목을 유지하며 동일 runId로 재개하고 새 세대 발급. TTL 120초. {runId,generation,status,completedIds} 반환.
- heartbeat: {runId,generation}. 소유자·세대·만료·RUNNING 검증 후 TTL 연장.
- snapshot: {runId,generation,externalId,raw,rawHash,hashVersion,evidence}. 실행 scope의 ID만 허용. 원본 스냅샷 중복 방지 저장, 항목 시도/근거 저장. {snapshotId} 반환.
- apply: {runId,generation,externalId,snapshotId,normalized,changes}. 현재 표시값을 잠그고 before 포인터 확보. 동일 정책 소유 스냅샷 검증. 표시값·출처 포인터·버전과 항목 SUCCESS·전후 스냅샷·변경 필드·성공시각을 단일 트랜잭션으로 반영. 이전 수정일시 대비 역전은 서버 비교로 먼저 차단한다. {status:'SUCCESS'} 반환.
- fail: {runId,generation,externalId,errorCode,evidence}. FAILED 항목만 갱신, 표시/적용 포인터 유지.
- finish: {runId,generation,calls,errorCode?}. 항목을 집계하여 SUCCESS/PARTIAL/FAILED 결정, 잠금 해제. 미완료는 성공으로 취급하지 않는다. {status,success,failed,pending} 반환.
- current: {externalId}. 서버 읽기 전용 {snapshotId,raw,normalized} 또는 null.
- run: {runId}. 서버 읽기 전용 실행·항목 확인. dry-run은 current/run 외 RPC를 호출하지 않는다.

모든 쓰기는 동일 잠금 행을 FOR UPDATE로 잠그고 소유자·세대·유효기간을 다시 확인한다. 종료된 실행의 뒤늦은 쓰기는 거부한다. HTTP 동안 DB 트랜잭션을 유지하지 않고 API 요청 전 heartbeat를 수행한다. 프로세스 중단은 임대 만료 후 동일 실행 재개, SUCCESS 항목은 건너뛰고 나머지는 세 API를 새로 수집한다. 미완료 원본을 새 응답과 섞지 않는다.

원격 적용·생성 타입·역할별 권한·실제 수집 재실행·동시 실행 결과는 [검증 보고서](./policy-sync-validation.md)에 기록했다. 로컬 PGlite는 PostgreSQL SQL 의미 검증에 사용하되 단일 연결이므로 실제 다중 연결 경합을 검증했다고 주장하지 않는다. Supabase Data API 권한과 네트워크 통합도 별도로 검증한다.
