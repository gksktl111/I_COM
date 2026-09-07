# 정책 수집 구현 검증 (2026-09-08)

## 실제 API와 정규화

[1단계 표본 검증](./policy-api-validation.md)에서 중앙4·광역2·시군구2의 실제 8개 묶음을 확보했다. 새 `policy:prepare`로 목록 전체 필터 순회·상세·조건·마지막 빈 페이지·ID/건수 검사·정규화를 다시 실행했다.

- 실행: 2026-09-07 18:07:54–57 UTC (KST 2026-09-08 03:07).
- 공식 API 호출 42회, 8개 모두 PREPARED. DB 접근 없음.
- 산출물: `.local/policy-prepared/2026-09-07T18-07-54-774Z-72d3c218-2a82-4fdb-96cb-eb66e22feb0c/`.
- 지원대상/내용/신청 문단, 숫자·단위, 원본 null과 별도 날짜 형식이 정규화 가능함을 확인했다.
- 목록 신청방법은 요약, 상세는 문장이어서 모든 정책에 차이 경고가 있다. 서울형 아이돌봄비 URL은 원문보다 긴 설명 속 URL과 차이를 경고하며 복구하지 않는다. 괄호 닫힘만 뒤따르는 동일 URL은 경고 대상에서 제외했다.

## 코드·로컬 DB

- 실제 fixture 내용을 사용하는 합성 API → 수집 서비스 → 실제 PostgreSQL(PGlite) RPC 통합: 최초8개·재실행 무중복·dry-run 쓰기0·1개 상세 실패 시 나머지7개 반영·저장 원본 재정규화 API호출0 통과.
- SQL: A→B→A 스냅샷 재사용과 전후 이력, 표시 갱신 후 강제 오류 전체 롤백, 임대 경합/만료/구 세대 거부, 성공 항목 보존 재개, 출처/스냅샷 불일치 거부, anon/authenticated 접근 거부, 실패/중단 원본 이력 보존 검증.
- 정규화: HTML 파서·엔티티·문단/목록, 잘못된 타입, 정상 빈 값, 원본/표시/조건 해시 구분, 날짜 역전 보류.
- HTTP: 비밀 제거·크기/타임아웃/예산 제한·인증/429 중단·일시 네트워크 재시도·긴 Retry-After 보류.

합성 API pagination과 인위적으로 바꾼 데이터는 실제 정책의 변경 관찰로 취급하지 않는다. PGlite는 단일 연결이므로 별도 DB 연결 간 경합을 검증했다는 의미가 아니다.

## 원격 개발 DB 검증

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

## 현재 완료 범위와 운영 잔여

수동 API→수집→정제→원본/표시 DB 반영, 반복·dry-run·서버 전용 권한·원격 중복 실행·저장 원본 재처리까지 검증했다. `npm run policy:test` 7개 파일과 타입·린트 검증을 통과했고, 원격 버전으로 마이그레이션 파일명을 맞춘 뒤 DB/통합 2개 테스트 파일을 다시 통과했다.

전체 Next.js 빌드는 기존 globals.css 처리 중 Turbopack 포트 바인딩 `Operation not permitted`로 실패한 상태다. 소스가 바뀌지 않은 환경 오류를 반복 실행하지 않았으며 전체 빌드 성공으로 표시하지 않는다.

배포 주소·플랫폼·요금제·실행 한도·계정 일일 API 예산은 미확정이다. 자동 수집 HTTP 진입점과 스케줄은 아직 등록하지 않았다. 실제12시간 간격2회 수집 성공도 남아 있으므로 전체 계획의 완료로 표시하지 않는다. [실행·복구 안내](./policy-sync-runbook.md)를 따른다.
