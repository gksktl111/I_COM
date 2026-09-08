# 복지로 수집·저장 결과와 재개 안내

기준일: 2026-09-08 · **중앙 2개·서울 중구 2개 개발 DB 저장 및 v2 재처리 완료**

최신 자동 범위 확장과 품질 저장 결과는 [자동 수집·품질 운영 계약](./policy-automatic-quality.md)을 참조한다. 아래 4개 표본·12개 레코드 건수는 최초 구현 시점의 기록이며 현재 전체 건수가 아니다.

## 현재 결과

| 출처 | 정책 |
| --- | --- |
| BOKJIRO_CENTRAL | WLF00000024 아이돌봄서비스, WLF00000030 육아종합지원서비스 제공 |
| BOKJIRO_LOCAL | WLF00002249 장애인가정 출산지원금 지급, WLF00002340 출산양육지원금 지급 |

Gov24 8개를 포함해 출처별 정책 레코드·스냅샷은 각각 12개다. 같은 정책의 다른 출처가 있을 수 있으므로 고유 정책 12개로 집계하지 않는다. Gov24 현재 정책 8개의 전체 행 지문은 변경 전후 동일하다. 원본·표시·실행 이력은 기존 정책 테이블에 저장되며 provider로 구분한다.

[실제 저장 검증](../fixtures/bokjiro/stored-validation.json)에 적용 스냅샷·정제 표시값·실행 ID·건수·잠금 해제 상태를 기록했다.

- 중앙 최초 저장: `a5782f79-c074-4cfd-acb8-044b67332585`, SUCCESS 2, API 4회.
- 지자체 최초 저장: `219061b9-5912-46a0-b022-eb4800e192bd`, SUCCESS 2, API 4회.
- 중앙 재처리: `1b10f1ab-ec84-482e-b74f-e7d6be098683`, SUCCESS 2, API 0회.
- 지자체 재처리: `cc8e1894-2a54-47ab-8718-6b32fa65107a`, SUCCESS 2, API 0회.
- 재처리는 원본·표시·조건 해시 모두 무변경이며 스냅샷 중복 증가 없음.
- 실제 저장 전 두 출처 dry-run은 각각 SUCCESS 2, API 4회. dry-run 6개 테이블 불변은 로컬 PGlite 통합 검증으로 확인했다.

원격 마이그레이션 **`20260907192856_policy_multiple_providers.sql`은 적용 완료**다. 이전 파일명은 CLI 생성 시점이었으며 원격 이력 버전에 맞춰 변경했다. 재적용하지 않는다.

## 구현 범위

- 엄격한 XML 부분집합 파서: 반복 요소·문자열·빈 태그·CDATA 보존, 잘못된 중첩·DTD·알 수 없는 엔티티 거부. 범용 XML 전체를 지원하는 파서는 아니다. 원문 XML은 함께 보관한다.
- HTTPS 고정 호스트, 리다이렉트 금지, 요청당 20초·2MiB 제한, 수동 호출 예산 최대 100. 인증·할당량 오류 후 추가 HTTP 요청을 차단한다. 초기 구현은 자동 재시도하지 않는다.
- 중앙 목록의 `srchKeyCode=003`과 양육 검색, 지자체 서울 중구 목록을 끝의 빈 페이지까지 검증한다. 목록 전체 필터가 완전해야 선정 ID의 상세를 반영한다.
- 표시 필드·원문 분류·추가 목록·날짜·출처·해시를 보존한다. 요약을 정책 목적으로, 시행 기간을 신청 기간으로 바꾸지 않는다. 미제공 신청기한·필수서류·신청 URL은 null로 남긴다.
- 모든 RPC에 provider를 전달한다. 생략한 기존 Gov24 호출은 계속 GOV24로 동작한다. 실행·잠금·원본 ID를 출처별로 검증하며 다른 출처의 실행 재개·쓰기·원본 교체를 거부한다.
- 재개 시 성공 항목을 건너뛰고 실패·미완료 항목을 다시 수집한다. 저장 원본 재처리는 API를 호출하지 않는다.
- 지역·소득·연령 등 실제 신청 자격 규칙은 자동 생성·공개하지 않는다.

## 실행

키는 `.env.local`의 BOKJIRO_CENTRAL_API_KEY, BOKJIRO_LOCAL_API_KEY를 사용한다. 두 API 인증 성공을 실제 확인했다. 선정 범위는 [bokjiro-selection.json](../../scripts/policy/bokjiro-selection.json)이다.

```bash
# 기존값 조회와 정제 비교, DB 쓰기 없음
npm run policy:sync:bokjiro -- --provider central --dry-run
npm run policy:sync:bokjiro -- --provider local --dry-run

# 실제 저장: 환경변수는 이 프로세스에만 적용
POLICY_SYNC_ENABLED=true npm run policy:sync:bokjiro -- --provider central
POLICY_SYNC_ENABLED=true npm run policy:sync:bokjiro -- --provider local

# 저장 원본 재처리, 외부 API 호출 없음
POLICY_SYNC_ENABLED=true npm run policy:sync:bokjiro -- --provider central --reprocess

# 실패·미완료 실행 재개: 같은 출처·trigger 사용
POLICY_SYNC_ENABLED=true npm run policy:sync:bokjiro -- --provider local --resume RUN_UUID
```

기본 예산 40회, 페이지 크기 50, 페이지 상한 10이다. 현재 선택 범위에서 출처당 목록 2회(정상 페이지·빈 페이지)와 상세 2회를 사용했다. CLI는 `.local/policy-sync/bokjiro-*`에 비밀값을 제거한 요청·결과를 저장한다. 원본 XML이 들어간 파일을 새 fixture로 옮길 때도 비밀값 검사가 필요하다.

## 검증과 한계

정책 테스트 10개 파일 통과. 새 SQL 출처 분리 6개 사례, 복지로 서비스 통합 8개 사례가 포함된다. 어댑터는 후속 검토 수정까지 10개 사례 통과했다. 타입 검사 통과, 관련 ESLint 및 전체 lint 통과 기록이 있다. 원격 타입을 재생성했다. 마이그레이션 파일명 변경 후 실제 CLI 실행과 DB 조회도 성공했다.

원격 권한 확인: anon/authenticated는 원본 SELECT·수집 RPC EXECUTE 불가, service_role만 가능. 보안 advisor의 WARN 2개는 기존 `rls_auto_enable` 공통 함수에 관한 것으로 새 정책 함수의 권한 확대는 없다. 전체 빌드의 기존 환경 권한 오류는 해결되었다고 주장하지 않는다.

남은 한계:

- rawHash에는 해당 목록 페이지의 전체 XML도 포함된다. 다른 목록 행·조회수 변화가 해당 정책의 새 원본 스냅샷을 만들 수 있다. 정확히 같은 저장 원본 재처리의 중복 방지는 확인했으며, 의미 기준 중복 제거와는 다르다.
- v1 조건 해시의 대상·선정기준·분류 한정 문제는 v2의 목록·상세 근거 확장으로 보완하고 원격 4개에 반영했다. **해시 일치만으로 규칙 검수 완료를 유지하지 않는다.** 원본 변경·공식 근거의 현행성은 별도로 확인한다.
- 중앙은 기준연도만 있어 동일 연도 내 수정의 선후 관계를 보장하지 않는다. 지자체는 목록·상세 수정일의 달력 형식과 역전을 검사한다. 공식 접수·현행 자격 유효성은 별도 검수다.
- 실패 항목은 원본·표시가 유지되지만, 실행 중단 전에 소비한 호출 수는 finish 성공 여부에 따라 기록이 부족할 수 있다. 포털 호출량이 기준이다.
- 이번 저장은 표본 4개다. 전체 복지로 수집·출처 간 동일 정책 병합·검색 규칙 검수·UI·예약 실행은 미완료다.

## 다음 작업

1. **복지로 구현 커밋 완료:** `8cefec8`에 수집·마이그레이션·fixture·문서를 커밋했다. 현재 `origin/dev`를 fetch해 작업 브랜치에 포함됨을 확인했다. 원격 마이그레이션은 재적용하지 않는다.
2. **4개 표본 적합성 대조 완료:** [검토 결과](./policy-bokjiro-fitness.md)와 [기계 대조](../fixtures/bokjiro/fitness/stored-audit.json)를 참조한다. 커밋 XML과 저장 표시값 56개를 대조했다. 현재 DB와 저장 검증 파일의 표시값·스냅샷·버전 일치는 원본을 내보내지 않는 [boolean 검사](../fixtures/bokjiro/fitness/current-display-validation.json)로 확인했다. 원격 적용 원본 전체 대조와 혼동하지 않는다.
3. **원격 원본 감사·v2 재처리 완료:** 사용자 승인 후 `policy-dev`의 선정 4개를 Git 제외 파일로 읽어 기존 전체 v1 정제 일치와 v2 예상 변경을 확인했다. 출처별 dry-run 후 기존 수집기로 반영했으며 전체 v2 재실행 일치, 원본·표시·적용 스냅샷 불변, 스냅샷 수 유지, Gov24 불변·잠금 해제를 확인했다. [원본/정제 감사](../fixtures/bokjiro/fitness/reprocess-v2-audit.json), [DB 검증](../fixtures/bokjiro/fitness/reprocess-v2-database.json)을 참조한다.
4. **조건 근거 후보·미해결 항목:** 복지로 4개 후보는 검토 문서에 인물·범위·단위·경계·기준일과 연결했다. 중구 장애인 지원금의 경증 금액(100/120만원)과 거주·신청 시점 차이는 공식 근거 검수 전 병합하지 않는다. 검수 완료 비교 규칙은 아직 없다.
5. 공식 근거 검수와 표본 검증을 마친 뒤 수집 범위 확대, 두 단계 검색 입력·비교 기능·UI 연결을 진행한다. 예약 배포는 플랫폼·URL·호출 예산 확인 후 별도 진행한다.

### 정제 v2 변경 계약

`conditionsHash`는 선택된 정책의 파싱된 목록·상세 전체에서 `inqNum`, `resultCode`, `resultMessage`만 제외한 값을 해시한다. 지원내용·신청방법·시행/기준/수정 시점·법령·서식·미지 신규 필드까지 보수적으로 변경을 감지한다. 해시 변경은 재검수 신호이며 자격이 실제 변경되었다는 판정은 아니다. 원본 변경도 계속 확인하며, 이 해시만으로 검수 완료를 유지하지 않는다.

목록 페이지 전체 XML과 수집 evidence는 조건 해시에서 제외한다. 기존 `rawHash` 계약은 유지하므로 다른 행·조회수 변화가 새 스냅샷을 만들 수 있는 기존 한계는 남는다. 이 변경으로 DB 스키마를 추가하거나 기존 스냅샷을 교체하지 않는다.

```bash
# 오프라인 표본 감사: API·DB·인증키 사용 없음
node --experimental-strip-types scripts/policy/audit-bokjiro.ts \
  docs/fixtures/bokjiro/stored-validation.json /tmp/bokjiro-audit.json

# 승인 후 실행 완료한 v2 재처리 명령 (완료 확인을 위해 반복 실행할 필요 없음)
npm run policy:sync:bokjiro -- --provider central --reprocess --dry-run
npm run policy:sync:bokjiro -- --provider local --reprocess --dry-run
POLICY_SYNC_ENABLED=true npm run policy:sync:bokjiro -- --provider central --reprocess
POLICY_SYNC_ENABLED=true npm run policy:sync:bokjiro -- --provider local --reprocess
```

### 이번 로컬 검증 (2026-09-08)

- `npm run policy:test`: 기존 10개 파일 모두 통과. v2 근거 필드 변화·재실행 안정성·조회수/페이지 XML 분리 회귀 검증 포함.
- `npx tsc --noEmit`, `npm run lint`: 통과.
- 오프라인 감사: 표시 재실행 4/4 일치, 56필드 중 공백 외 차이 3개는 숫자 문자 참조 디코딩으로 설명되며 미설명 차이 0개. 신청기한을 1년에서 2년으로 바꾼 임시 입력은 정확히 1개 차이와 exit 1로 거절했다.
- 이번에는 전체 빌드를 실행하지 않았다. 기존 빌드 환경 제한이나 배포 성공을 해결했다고 보고하지 않는다.
- 원격 재처리: 중앙 `08dbb860-cdac-4172-91eb-90a4d1334f26`, 지역 `0a402082-1e3a-46a4-840f-616ccde0afb5`, 각각 SUCCESS 2·API 0회·실패/미완료 0. DB에서 종료 시각과 잠금 해제 확인.
- 원본 해시·전체 원본·수집 시각·적용 스냅샷·표시 해시는 4/4 유지, 조건 해시·정제 버전만 변경. 전체 v1/v2 정제 재실행 일치 4/4. 스냅샷 총 12개 유지, Gov24 8개 전체 행 지문 불변.
- 첫 샌드박스 dry-run은 DNS `EAI_AGAIN`으로 실패했고 DB 쓰기는 없었다. 네트워크 권한으로 동일 dry-run을 재실행해 통과한 뒤 반영했다.
- 검증 스크립트는 반영 후 지원내용을 훼손한 임시 입력을 거절했다. 새 스크립트 추가 후 TypeScript·해당 ESLint 통과. 제품 코드 입력이 같아 이미 통과한 정책 테스트는 반복하지 않았다.

원격 내보내기는 `.local/policy-sync/fitness/bokjiro-v1-before.json`, `bokjiro-v2-after.json`에 권한 600으로 보관하며 Git에서 제외한다. 공개 근거 파일에는 원본 대신 ID·해시·동등성 결과만 기록했다.

```bash
node --experimental-strip-types scripts/policy/verify-bokjiro-reprocess.ts \
  .local/policy-sync/fitness/bokjiro-v1-before.json \
  .local/policy-sync/fitness/bokjiro-v2-after.json \
  /tmp/bokjiro-v2-verification.json
```
