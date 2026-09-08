# Official Bokjiro response samples

Captured from the HTTPS data.go.kr gateway on 2026-09-08 (Asia/Seoul).
Each XML file preserves the complete response bytes. Matching request JSON records
contain endpoint, non-secret parameters, HTTP status and UTC capture time.
API keys are omitted; files were scanned for the actual encoded and decoded keys.

The parameter definitions come from the adjacent `central-official-schema.json`
and `local-official-schema.json` downloaded from the official public-data portal.
Central list requests require `srchKeyCode` (`001` title, `002` content,
`003` title and content). The successful sample uses `003` and `searchWrd=양육`.

Selected samples:

| Scope | Service ID | Service name | List source |
| --- | --- | --- | --- |
| CENTRAL | WLF00000024 | 아이돌봄서비스 | central-childcare-list.xml |
| CENTRAL | WLF00000030 | 육아종합지원서비스 제공 | central-childcare-list.xml |
| LOCAL | WLF00002340 | 출산양육지원금 지급 | local-childcare-list-page2.xml |
| LOCAL | WLF00002249 | 장애인가정 출산지원금 지급 | local-list.xml |

The central list is page 1 of a 40-result search. The two local pages cover all
17 results for 서울특별시 중구. All saved responses report `resultCode=0`.
Details are named `<scope>-<service-id>-detail.xml`. XML roots are `wantedList`
and `wantedDtl`; repeated elements such as `applmetList` must remain arrays.
These fixtures are observations at capture time, not an assertion that service
eligibility or amounts remain current.
