# 정책 수집 실행 안내

이 문서는 Gov24 실행 안내다. 복지로 중앙·지자체 수집은 [복지로 실행·재개 안내](./policy-bokjiro-runbook.md)를 따른다.

초기 범위는 `scripts/policy/selection.json`의 검증된 8개 ID다. UI·추천·자격 판정과 연결하지 않는다. Node 24, `.env.local`의 `GOV24_API_KEY`, DB 실행에는 `SUPABASE_URL`/`SUPABASE_SECRET_KEY`가 필요하다. 비밀은 서버 환경에만 저장한다.

## 현재 상태와 사전 조건

실제 수집·정규화와 로컬/원격 PostgreSQL 검증을 마쳤다. 사용자가 승인한 개발 프로젝트 `policy-dev` (`visumyadkxleiqtxokqg`)에 `supabase/migrations/20260907181933_policy_ingestion.sql`을 적용했고, 원격 이력과 로컬 파일명이 일치한다. 같은 마이그레이션을 이 프로젝트에 다시 적용하지 않는다. 다른 빈 개발 DB를 준비할 때 검토 후 적용한다.

실제 API→DB 최초/재실행 모두8개 성공, 스냅샷8개 유지, dry-run 전후6개 테이블 무변경, 원격 동시 실행 SUCCESS/SKIPPED와 구세대 거부를 확인했다. [검증 보고서](./policy-sync-validation.md)에 실행 ID·시각·한계를 기록했다. 배포·예약 환경이 미확정이라 자동 실행은 아직 연결하지 않았다.

`SUPABASE_ACCESS_TOKEN`은 로컬 관리 API/마이그레이션용이며 배포되는 수집기에는 필요 없다. 수집기의 데이터 접근에는 `SUPABASE_SECRET_KEY`만 사용한다.

마이그레이션은 새 6개 테이블과 서버 전용 RPC를 생성한다. 기존 동명 객체가 있으면 덮어쓰지 말고 충돌을 확인한다. 수집 데이터는 공개 서비스 설명이지만 원본/로그/쓰기 API는 일반 사용자에게 열지 않는다. 전체 정책 수집으로 범위를 자동 확대하지 않는다.

## 수동 실행

```bash
# 실제 API → 완전성 검사 → 정규화 → 로컬 파일. DB 접근 없음.
npm run policy:prepare

# 원격 스키마 적용 후: 실제 API + 기존 DB 비교, DB 쓰기 없음.
npm run policy:sync -- --dry-run

# 개발 DB 수동 쓰기 실행. 환경변수는 이 프로세스에만 적용.
POLICY_SYNC_ENABLED=true npm run policy:sync

# 성공 항목은 보존하고 실패/중단 항목의 세 API를 새로 수집.
POLICY_SYNC_ENABLED=true npm run policy:sync -- --resume 실행_UUID

# 현재 적용 스냅샷을 API 재호출 없이 재정규화.
npm run policy:sync -- --reprocess --dry-run
POLICY_SYNC_ENABLED=true npm run policy:sync -- --reprocess
```

`--budget` 기본 100(최대 200), `--per-page` 기본 100(최대 100), `--max-pages` 기본 20(최대 20). 요청 재시도도 예산에 포함한다. 현재 8개 표본의 실제 준비 실행은 42회 요청, 약 2.6초였다. 계정 일일 한도·초기화는 아직 확인되지 않았으며 이 수치는 운영 상한이 아니다.

선정 파일을 바꾸려면 `--selection 파일`을 사용하되 5~10개 ID와 실제 검토 이유·지원되는 목록 필터가 필요하다. 재개 시에는 원 실행의 scope를 DB에서 읽는다. 이전 실행이 reprocess였다면 재개 시에도 `--reprocess`를 지정한다. SUCCESS 실행은 재개하지 않고 새로 실행한다.

결과는 `.local/policy-prepared/`, `.local/policy-sync/`에 저장하며 Git 제외 대상이다. PREPARED는 로컬 정제 성공, SUCCESS는 해당 실행 범위의 DB 반영 완료, PARTIAL은 일부 실패, FAILED는 전체/선행 실패, SKIPPED는 다른 유효 실행 존재를 뜻한다. dry-run 결과는 읽기 시점의 참고용이고 이후 실제 반영 결과를 보장하지 않는다.

## 실패·중지·재개

- 인증/권한/429: 자동 반복을 중단한다. 키·계정 한도를 확인하고 다음 수동 실행으로 재개한다.
- 네트워크/5xx: 최대 3회 시도, 짧은 지연과 jitter. Retry-After가 10초를 넘으면 현재 실행에서 기다리지 않고 보류한다.
- 목록 누락·중복·건수 변화·페이지 상한·예산 소진: 미완료로 기록한다. 빠진 정책을 삭제하지 않는다.
- 날짜 역전·형식 미확인: 수집 원본을 저장하고 표시 반영을 보류한다. UTC 시간대를 추정하거나 과거/최신 응답을 섞지 않는다.
- 정책 실패: 기존 표시·적용 스냅샷 유지. 실패/중단 evidence와 snapshotId는 항목의 `attempt_history`에 보존되며 재개해도 지우지 않는다.
- 프로세스 중단: 최대 120초 임대 만료 후 원 실행 ID로 재개한다. 임의로 잠금 행을 삭제하지 않는다. 새 세대가 발급되면 이전 실행은 쓰기 거부된다.
- 중지: `POLICY_SYNC_ENABLED`를 false/빈 값으로 설정해 새 CLI 쓰기 실행을 차단한다. 이미 실행 중인 프로세스는 종료한 뒤 임대 만료를 기다린다.

원격 SQL 관리 연결로 서버만 `policy_sync_command('run', '{"runId":"..."}')`을 호출하여 실행/항목을 확인할 수 있다. 오류 원문 대신 분류 코드·실행 ID·정책 ID로 진단하며 외부 인증 URL/헤더는 로그에 쓰지 않는다. 호출 수는 완료 시 합산되므로 강제 종료 직전 호출은 run.calls에 누락될 수 있다. 로컬 요청 산출물과 항목 evidence로 보완하며 계정 사용량은 포털에서 확인한다.

현재 재정규화 CLI는 **현재 적용된** 스냅샷을 대상으로 한다. 적용되지 않은 격리 원본을 임의로 정상으로 승격하는 명령은 제공하지 않는다. 정상 API 재수집 또는 계약 수정·검증 후 별도 처리한다.

## 검증·예약

```bash
npm run policy:test
npm run lint
npx tsc --noEmit
npm run build
```

PGlite SQL 테스트는 PostgreSQL의 트랜잭션/제약/역할 동작을 검증한다. 별도 프로세스의 실제 DB 경합과 원격 Data API 역할 검증을 대체하지 않는다. 현재 전체 빌드는 기존 globals.css의 Turbopack 포트 바인딩 환경 오류로 완료되지 않았다.

12시간 예약 실행의 배포 대상·요금제·실행 한도·비밀 저장 방식이 미확정이다. `POLICY_SYNC_CRON_SECRET`은 예약 진입점 구현을 위한 예약 변수이며 아직 사용되지 않는다. 스케줄과 HTTP 진입점은 아직 등록/공개하지 않았고, 실제 12시간 간격 2회 성공도 미검증이다.
