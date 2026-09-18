# Supabase 정책 DB 보존·용량 정리

무료 티어의 500MB 제한을 넘지 않도록 자동 수집 이력을 정리한다. 현재 정책 본체, 라벨·관련성 관찰 이력, 출처별 최신 자동 실행 1건은 보존한다. 삭제와 물리 공간 회수는 별도 단계로 실행한다.

## 고정된 정리 범위

- 보존: `GOV24`, `BOKJIRO_CENTRAL`, `BOKJIRO_LOCAL`의 최신 자동 실행 각 1건, 정책 5,895건과 모든 라벨·관련성 관찰 이력
- 삭제: 이전 자동 실행 8건과 그 실행에만 속한 수집 항목 11,440건, 페이지 237건, 품질 관찰 6,310건, 작업 8건
- 스냅샷: 정책·라벨·관련성 관찰·보존 실행에서 참조하지 않는 1,213건만 삭제
- 비대상: 선택 수집 실행, 정책 본체, 사용자 데이터, Auth, Storage

대상 ID·digest·실행 요약은 [고정 계획](../../fixtures/policy-retention/automatic-history-cleanup-20260918.json)에 보존한다. 실행 SQL은 외래키 순서대로 삭제하며 모든 수와 정책 상태가 정확히 일치하지 않으면 트랜잭션 전체를 중단한다.

2026-09-18 실행 결과는 [용량 정리 기록](../records/database-retention-20260918.md)에 보존했다. 이 계획은 이미 적용된 일회성 계획이므로 다음 정리에서는 현재 상태로 새 계획 파일과 digest를 만들어야 한다.

## 실행 절차

1. v4 마이그레이션과 정책 상태 `ACTIVE 4,414 / REVIEW 79 / EXCLUDED 1,402`를 확인한다.
2. 읽기 전용 preflight를 실행한다.

   ```bash
   node --env-file=.env.local --experimental-strip-types scripts/policy/database-retention.ts
   ```

3. 출력의 `matches`가 `true`일 때만 고정 digest를 명시해 삭제한다.

   ```bash
   node --env-file=.env.local --experimental-strip-types scripts/policy/database-retention.ts \
     --apply \
     --confirm-digest c4d59ee728fb5ececc62e924f529eaebeada2953e2addc15acdfb7b2b365bda4
   ```

4. 삭제 직후 정책 건수와 남은 자동 실행 3건을 재조회한다.
5. 삭제만으로 DB 파일 크기는 줄지 않으므로 짧은 유지보수 시간에 큰 테이블부터 `VACUUM (FULL, ANALYZE)`를 실행한다. 이 명령은 대상 테이블을 잠그므로 정책 수집을 실행하지 않는 동안 수행한다.
6. DB 크기가 450MB 미만인지 확인한다. 목표에 못 미치면 새 삭제 범위를 임의로 넓히지 않고 테이블별 크기를 다시 분석한다.

Supabase의 [Database Size 안내](https://supabase.com/docs/guides/platform/database-size)에 따라 삭제 후 물리 공간 회수가 별도임을 전제로 한다. 테이블 크기 확인은 [Database Reports 안내](https://supabase.com/docs/guides/platform/database-reports)를 기준으로 한다.

## 실패와 복구

- preflight 불일치, 잠금 참조, 행 수 불일치, 정책 상태 변경 중 하나라도 발생하면 삭제 SQL은 실행하지 않는다.
- 삭제 SQL은 한 트랜잭션이며 커밋 전 오류는 전부 롤백된다.
- 커밋 후에는 원문 행을 DB에서 복구하지 않는다. 대신 계획 JSON에 실행별 상태·요약을 남기고, 정책·관찰 이력이 참조하는 스냅샷은 삭제 대상에서 제외한다.
- `VACUUM FULL` 실패는 삭제 결과를 되돌리지 않지만 물리 용량이 회수되지 않을 수 있다. 이 경우 일반 쿼리와 정책 건수를 먼저 확인한 뒤 테이블별로 재시도한다.
