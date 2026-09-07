# Gov24 지원조건 코드 관찰

상태: 공식 설명만 확인. 인증된 실제 응답의 관찰값은 아직 없음.

출처: [공식 Swagger](https://infuser.odcloud.kr/api/stages/44436/api-docs?1684891964110), 확인일 2026-09-08. 설명은 코드 이름의 공식 설명이며 값의 의미·자격 판정 규칙을 보장하지 않는다.

모든 코드는 원본 JSON 타입과 값을 보존한다. 미관찰 값은 UNKNOWN이며 빈 값도 비해당·조건 없음으로 해석하지 않는다. 연령 주체·단위·경계·기준일은 미확인이다.

| 코드 | 공식 설명 | 명세 타입 | 실제 값·타입 | 관찰 정책·수집시각 | 의미 상태 |
| --- | --- | --- | --- | --- | --- |
| JA0101 | 남성 | string | 미관찰 | 없음 | UNKNOWN |
| JA0102 | 여성 | string | 미관찰 | 없음 | UNKNOWN |
| JA0110 | 대상연령(시작) | integer | 미관찰 | 없음 | UNKNOWN |
| JA0111 | 대상연령(종료) | integer | 미관찰 | 없음 | UNKNOWN |
| JA0201 | 중위소득 0~50% | string | 미관찰 | 없음 | UNKNOWN |
| JA0202 | 중위소득 51~75% | string | 미관찰 | 없음 | UNKNOWN |
| JA0203 | 중위소득 76~100% | string | 미관찰 | 없음 | UNKNOWN |
| JA0204 | 중위소득 101~200% | string | 미관찰 | 없음 | UNKNOWN |
| JA0205 | 중위소득 200% 초과 | string | 미관찰 | 없음 | UNKNOWN |
| JA0301 | 예비부모/난임 | string | 미관찰 | 없음 | UNKNOWN |
| JA0302 | 임산부 | string | 미관찰 | 없음 | UNKNOWN |
| JA0303 | 출산/입양 | string | 미관찰 | 없음 | UNKNOWN |
| JA0313 | 농업인 | string | 미관찰 | 없음 | UNKNOWN |
| JA0314 | 어업인 | string | 미관찰 | 없음 | UNKNOWN |
| JA0315 | 축산업인 | string | 미관찰 | 없음 | UNKNOWN |
| JA0316 | 임업인 | string | 미관찰 | 없음 | UNKNOWN |
| JA0317 | 초등학생 | string | 미관찰 | 없음 | UNKNOWN |
| JA0318 | 중학생 | string | 미관찰 | 없음 | UNKNOWN |
| JA0319 | 고등학생 | string | 미관찰 | 없음 | UNKNOWN |
| JA0320 | 대학생/대학원생 | string | 미관찰 | 없음 | UNKNOWN |
| JA0322 | 해당사항없음 | string | 미관찰 | 없음 | UNKNOWN |
| JA0326 | 근로자/직장인 | string | 미관찰 | 없음 | UNKNOWN |
| JA0327 | 구직자/실업자 | string | 미관찰 | 없음 | UNKNOWN |
| JA0401 | 다문화가족 | string | 미관찰 | 없음 | UNKNOWN |
| JA0402 | 북한이탈주민 | string | 미관찰 | 없음 | UNKNOWN |
| JA0403 | 한부모가정/조손가정 | string | 미관찰 | 없음 | UNKNOWN |
| JA0404 | 1인가구 | string | 미관찰 | 없음 | UNKNOWN |
| JA0410 | 해당사항없음 | string | 미관찰 | 없음 | UNKNOWN |
| JA0411 | 다자녀가구 | string | 미관찰 | 없음 | UNKNOWN |
| JA0412 | 무주택세대 | string | 미관찰 | 없음 | UNKNOWN |
| JA0413 | 신규전입 | string | 미관찰 | 없음 | UNKNOWN |
| JA0414 | 확대가족 | string | 미관찰 | 없음 | UNKNOWN |
| JA1101 | 예비창업자 | string | 미관찰 | 없음 | UNKNOWN |
| JA1102 | 영업중 | string | 미관찰 | 없음 | UNKNOWN |
| JA1103 | 생계곤란/폐업예정자 | string | 미관찰 | 없음 | UNKNOWN |
| JA1201 | 음식적업 | string | 미관찰 | 없음 | UNKNOWN |
| JA1202 | 제조업 | string | 미관찰 | 없음 | UNKNOWN |
| JA1299 | 기타업종 | string | 미관찰 | 없음 | UNKNOWN |
| JA2101 | 중소기업 | string | 미관찰 | 없음 | UNKNOWN |
| JA2102 | 사회복지시설 | string | 미관찰 | 없음 | UNKNOWN |
| JA2103 | 기관/단체 | string | 미관찰 | 없음 | UNKNOWN |
| JA2201 | 제조업 | string | 미관찰 | 없음 | UNKNOWN |
| JA2202 | 농업,임업 및 어업 | string | 미관찰 | 없음 | UNKNOWN |
| JA2203 | 정보통신업 | string | 미관찰 | 없음 | UNKNOWN |
| JA2299 | 기타업종 | string | 미관찰 | 없음 | UNKNOWN |
| JA0328 | 장애인 | string | 미관찰 | 없음 | UNKNOWN |
| JA0329 | 국가보훈대상자 | string | 미관찰 | 없음 | UNKNOWN |
| JA0330 | 질병/질환자 | string | 미관찰 | 없음 | UNKNOWN |

실제 표본 확보 후 값별 정책 ID·수집시각·fixture 경로를 추가한다. 새로운 코드도 제거하지 않고 관찰 목록에 추가한다. 합성 테스트 결과를 이 표의 실관찰로 사용하지 않는다.
