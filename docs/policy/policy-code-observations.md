# Gov24 지원조건 코드 관찰

상태: 실제 8개 정책 최초·반복 응답 확인 (2026-09-08 KST). 공식 설명은 [명세 fixture](../fixtures/gov24/official-schema.json)에 근거한다. 값의 의미·자격 규칙은 **UNKNOWN**으로 보존한다.

[모든 코드의 값·JSON 타입·정책 ID·UTC 시각·요청 경로](../fixtures/gov24/real/condition-observations.json)를 기계 판독 가능한 근거로 제공한다. 아래는 최초 8행만 집계한 값 집합이며 반복에서도 동일했다. null은 비해당·조건 없음이 아니다. 연령 주체·단위·경계·기준일을 확정하지 않는다.

| 코드 | 공식 설명 | 명세 타입 | 관찰 값·타입 | 의미 |
| --- | --- | --- | --- | --- |
| JA0101 | 남성 | string | "Y" (string), null (null) | UNKNOWN |
| JA0102 | 여성 | string | "Y" (string) | UNKNOWN |
| JA0110 | 대상연령(시작) | integer | 2 (integer), 0 (integer), 18 (integer) | UNKNOWN |
| JA0111 | 대상연령(종료) | integer | 7 (integer), 17 (integer), 55 (integer), 60 (integer), 44 (integer) | UNKNOWN |
| JA0201 | 중위소득 0~50% | string | "Y" (string) | UNKNOWN |
| JA0202 | 중위소득 51~75% | string | "Y" (string) | UNKNOWN |
| JA0203 | 중위소득 76~100% | string | "Y" (string) | UNKNOWN |
| JA0204 | 중위소득 101~200% | string | "Y" (string) | UNKNOWN |
| JA0205 | 중위소득 200% 초과 | string | "Y" (string), null (null) | UNKNOWN |
| JA0301 | 예비부모/난임 | string | null (null), "Y" (string) | UNKNOWN |
| JA0302 | 임산부 | string | null (null), "Y" (string) | UNKNOWN |
| JA0303 | 출산/입양 | string | null (null), "Y" (string) | UNKNOWN |
| JA0313 | 농업인 | string | null (null), "Y" (string) | UNKNOWN |
| JA0314 | 어업인 | string | null (null), "Y" (string) | UNKNOWN |
| JA0315 | 축산업인 | string | null (null), "Y" (string) | UNKNOWN |
| JA0316 | 임업인 | string | null (null), "Y" (string) | UNKNOWN |
| JA0317 | 초등학생 | string | null (null), "Y" (string) | UNKNOWN |
| JA0318 | 중학생 | string | null (null), "Y" (string) | UNKNOWN |
| JA0319 | 고등학생 | string | null (null), "Y" (string) | UNKNOWN |
| JA0320 | 대학생/대학원생 | string | null (null), "Y" (string) | UNKNOWN |
| JA0322 | 해당사항없음 | string | "Y" (string), null (null) | UNKNOWN |
| JA0326 | 근로자/직장인 | string | null (null), "Y" (string) | UNKNOWN |
| JA0327 | 구직자/실업자 | string | null (null), "Y" (string) | UNKNOWN |
| JA0328 | 장애인 | string | null (null), "Y" (string) | UNKNOWN |
| JA0329 | 국가보훈대상자 | string | null (null), "Y" (string) | UNKNOWN |
| JA0330 | 질병/질환자 | string | null (null), "Y" (string) | UNKNOWN |
| JA0401 | 다문화가족 | string | null (null), "Y" (string) | UNKNOWN |
| JA0402 | 북한이탈주민 | string | null (null), "Y" (string) | UNKNOWN |
| JA0403 | 한부모가정/조손가정 | string | null (null), "Y" (string) | UNKNOWN |
| JA0404 | 1인가구 | string | null (null), "Y" (string) | UNKNOWN |
| JA0410 | 해당사항없음 | string | "Y" (string), null (null) | UNKNOWN |
| JA0411 | 다자녀가구 | string | null (null), "Y" (string) | UNKNOWN |
| JA0412 | 무주택세대 | string | null (null), "Y" (string) | UNKNOWN |
| JA0413 | 신규전입 | string | null (null), "Y" (string) | UNKNOWN |
| JA0414 | 확대가족 | string | null (null), "Y" (string) | UNKNOWN |
| JA1101 | 예비창업자 | string | null (null) | UNKNOWN |
| JA1102 | 영업중 | string | null (null) | UNKNOWN |
| JA1103 | 생계곤란/폐업예정자 | string | null (null) | UNKNOWN |
| JA1201 | 음식적업 | string | null (null) | UNKNOWN |
| JA1202 | 제조업 | string | null (null) | UNKNOWN |
| JA1299 | 기타업종 | string | null (null) | UNKNOWN |
| JA2101 | 중소기업 | string | null (null) | UNKNOWN |
| JA2102 | 사회복지시설 | string | null (null) | UNKNOWN |
| JA2103 | 기관/단체 | string | null (null) | UNKNOWN |
| JA2201 | 제조업 | string | null (null) | UNKNOWN |
| JA2202 | 농업,임업 및 어업 | string | null (null) | UNKNOWN |
| JA2203 | 정보통신업 | string | null (null) | UNKNOWN |
| JA2299 | 기타업종 | string | null (null) | UNKNOWN |
