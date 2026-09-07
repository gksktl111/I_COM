# Gov24 수동 탐색 도구

1단계의 표본 관찰 도구다. DB 쓰기는 수행하지 않으며 실제 응답 계약·정규화·수집 파이프라인은 표본 검증 후 구현한다. Node.js 24 이상에서 실행한다. 추가 npm 의존성은 없다.

## 준비와 후보 탐색

`.env.example`의 변수 이름을 참고하여 기존 `.env.local`에 `GOV24_API_KEY`를 추가한다. 기존 지도 API 설정을 덮어쓰지 않는다. 키는 공공데이터포털에서 해당 API 활용 승인된 키여야 한다. 실제 키를 명령 인자나 대화에 넣지 않는다.

```bash
npm run policy:probe -- search --keyword 양육 --per-page 5 --budget 1
npm run policy:probe -- search --keyword 출산 --agency 서울 --page 1 --per-page 5 --budget 1
```

`--page`를 바꿔 제한된 페이지를 탐색한다. 각 명령의 호출 예산에는 재시도도 포함된다. 계정 일일 한도와 초기화 시각은 별도로 확인해야 한다. 네트워크 제한 환경에서는 외부 API 접근이 가능한 실행 환경이 필요하다.

목록 응답은 `.local/policy-probe/<실행 디렉터리>/`에 보관된다. 각 실행의 요약과 원본을 검토하여 5~10개(목표 8개)를 선정한다. 서비스명·요약·지원대상·기관을 함께 읽고 선정 이유를 기록한다.

## 표본 수집

로컬 `selection.json`은 다음 형식으로 작성한다. 아래 한 행은 형식 설명이며 실제 표본이 아니다. `listRecord`에는 검색 산출물의 해당 목록 객체 전체를 복사한다.

```json
{
  "samples": [
    {
      "id": "실제 서비스ID",
      "reason": "원문을 검토한 선정 이유",
      "listRecord": { "서비스ID": "실제 서비스ID", "서비스명": "실제 서비스명" },
      "provenance": {
        "artifact": ".local/policy-probe/실행디렉터리/request-001.json",
        "rowIndex": 0
      }
    }
  ]
}
```

```bash
npm run policy:probe -- collect --samples .local/policy-probe/selection.json --per-page 5 --max-pages 3 --budget 40
```

서로 다른 ID 5~10개를 넣어야 한다. 저장된 검색 행과 입력의 일치를 확인한다. 상세·지원조건은 페이지별 전체 배열과 조회 메타데이터를 보존한다. 0건·복수·다른 ID·중복·건수 편차는 관찰 대상이며 정상 반영으로 해석하지 않는다. 예산·페이지 제한으로 수집하지 못한 범위가 있으면 전체 완료로 표시하지 않는다.

같은 표본을 시차를 두고 다시 조회하고, 같은 필터에서 작은 페이지와 다음/마지막 페이지를 비교한다. 실제 결과를 [실응답 검증 보고서](./policy-api-validation.md)와 [조건 코드 관찰표](./policy-code-observations.md)에 반영한다. 완전성·필수 식별 계약을 결정할 근거가 부족하면 2단계 진입을 보류한다.

## 비밀 보호와 테스트

고정된 공식 API 주소로만 요청하고 인증 오류는 반복하지 않는다. 로컬 산출물은 Git에서 제외한다. 보관 자료를 실응답 fixture로 승격하기 전에 인증값 유출 여부와 내용을 검토한다.

```bash
npm run policy:test
npm run build
```

합성 응답으로 호출 예산·실패·ID 연결·비밀 제거 등을 검증한다. 테스트 통과가 인증 성공이나 실제 데이터 계약 검증을 뜻하지 않는다.
