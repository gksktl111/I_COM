# Supabase 정책 DB 용량 정리 — 2026-09-18

## 결과

Supabase 무료 티어의 500MB 제한을 넘은 정책 DB를 **585MB(613,018,771바이트)에서 368MB(385,977,491바이트)**로 줄였다. 목표인 450MiB 미만을 충족했으며 약 132MiB의 무료 티어 여유를 확보했다.

정리 전후 정책 상태는 동일하다.

| 상태 | 정리 전 | 정리 후 |
| --- | ---: | ---: |
| ACTIVE | 4,414 | 4,414 |
| REVIEW | 79 | 79 |
| EXCLUDED | 1,402 | 1,402 |

`policy-relevance-review-6` 관찰 이력 1,406건도 유지했고, 신규 수집 v4 마이그레이션 등록 상태를 다시 확인했다.

## 삭제 범위

출처별 최신 자동 수집 실행 1건씩, 전체 3건은 보존했다. 이전 자동 실행 8건은 실행 요약을 저장소에 먼저 보존한 뒤 전용 데이터만 외래키 순서로 삭제했다.

| 대상 | 삭제 건수 |
| --- | ---: |
| 자동 실행 | 8 |
| 수집 항목 | 11,440 |
| 자동 페이지 | 237 |
| 품질 관찰 | 6,310 |
| 자동 작업 | 8 |
| 미참조 스냅샷 | 1,213 |

라벨·관련성 관찰, 현재 정책, 선택 수집 실행 또는 보존 자동 실행이 참조하는 스냅샷은 삭제하지 않았다. 대상 실행 digest `c4d59ee728fb5ececc62e924f529eaebeada2953e2addc15acdfb7b2b365bda4`와 스냅샷 digest `bb95e4243a214ce3fb47a80584aff82093a95d34bbaaf2a070d3dd9b0db065fb`가 일치할 때만 트랜잭션을 실행했다.

## 물리 공간 회수

삭제 후에도 DB 파일은 585MB로 유지됐기 때문에 수집이 중단된 유지보수 시간에 아래 테이블을 순차적으로 `VACUUM (FULL, ANALYZE)` 처리했다.

- `policy_sync_items`: 236MB → 69MB
- `policy_source_snapshots`: 249MB → 227MB
- `policy_auto_pages`: 20MB → 약 7.8MB
- `policy_quality_observations`: 17MB → 약 2.9MB

최종 핵심 행 수는 수집 항목 9,546건, 스냅샷 8,853건, 자동 페이지 190건, 품질 관찰 1,273건이다. 정리 계획·실행 요약·최종 수치는 [고정 계획 JSON](../../fixtures/policy-retention/automatic-history-cleanup-20260918.json)에 함께 보존했다.

## 보존된 자동 실행

- `BOKJIRO_CENTRAL`: `9216ed5b-2b00-474b-a9b5-f646d85cc414`
- `BOKJIRO_LOCAL`: `430461c2-e846-43d6-ac8d-2e98962aa361`
- `GOV24`: `6d2476ea-95c0-4875-8e26-b774f55561ef`

이 세 실행은 모두 현재 재개 가능한 최신 PARTIAL 실행이다. 다음 정리는 이 기록의 ID를 재사용하지 않고 새 preflight와 새 계획 digest를 생성해야 한다.
