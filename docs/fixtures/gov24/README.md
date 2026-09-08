# Gov24 검증 자료

`official-schema.json`은 공식 Swagger의 필드 타입·설명이며 실응답이 아니다.

`real/`은 2026-09-08 KST에 인증하여 조회한 공개 정책 실응답이다. [manifest](./real/manifest.json)에서 최초/반복 실행 및 로컬 원본 경로를 확인한다. [selection](./real/selection.json)의 provenance 경로는 `real/` 기준이며 원본 검색 응답과 행 번호로 연결된다. `first/`, `repeat/`는 각각 32회 요청, `pagination/`은 목록 페이지 비교 5회와 요약이다.

[필드 통계](./real/field-statistics.json)는 선정된 8개만 집계하며 [조건 관찰](./real/condition-observations.json)은 각 ID·시각별 값을 보존한다. [반복 비교](./real/repeat-comparison.json)와 [검증 보고서](../../policy/policy-api-validation.md)를 함께 읽는다. 숫자·null·CRLF·잘린 URL 등 원본 응답 내용은 수정하지 않았다. 인위적 실패 사례가 아니다.

작성 전 현재 환경의 키·토큰·비밀값과 URL 인코딩 형태에 대한 유출 검사를 통과했다. 인증값은 저장하지 않는다. 이 작은 표본은 전체 서비스의 완전성·자격 의미·수정 전파를 보장하지 않는다.

`fitness/stored-audit.json`은 실제 개발 DB 적용 원본과 표시값의 오프라인 대조 결과다. [데이터 적합성 보고서](../../policy/policy-data-fitness.md)에서 검증 범위와 검색 준비의 한계를 확인한다.
