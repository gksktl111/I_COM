# 아이콤

아동과 양육 가구를 위한 공공 정책 탐색·주변 시설 안내 서비스입니다. 정책 수집과 관리자 운영 화면을 구현했으며, 사용자 소셜 로그인과 커뮤니티 저장 기능은 아직 연결 전입니다.

## 시작하기

```bash
npm ci
npm run dev
```

외부 서비스 키는 로컬 환경변수로 설정합니다. 키·계정 설정 파일을 Git에 넣지 않습니다. 관리자 초기 설정과 서버 환경은 [관리자 운영 문서](docs/admin-console.md), 정책 API 키·수집 절차는 [정책 수집 작업 문서](docs/policy/work/collection-runbook.md)를 참고하세요.

현재 사용 스택은 Next.js 16·React 19·TypeScript·Tailwind CSS 4, Naver Maps, Supabase Auth/DB입니다. 정확한 의존성 버전과 명령은 [package.json](package.json)을 기준으로 합니다.

## 현재 제공 범위

| 영역 | 상태 |
| --- | --- |
| 정책 | 정부24·복지로 수집, 원문·이력 보존, 관련성 평가, 분야 라벨 저장·검수 이력 |
| 공개 탐색 | 정책 목록·상세, 6개 분야 질문과 최대 20개 잠정 추천. 실제 정책의 자격 조건 연결은 후속 |
| 주변 시설 | 지도·분류·마커·시설 상세 UI. 외부 지도/API 연결 필요 |
| 관리자 | 인증·계정 관리, 사용자 검색, 정책·수집·품질 조회, 공지 초안 저장 |
| 사용자 로그인 | 카카오·네이버·구글만 지원할 계획. 현재 버튼 비활성화 |
| 커뮤니티 | 공개·관리자 UI 구현. 게시글·댓글·신고·제재 저장 기능은 미연결 |

## 문서와 다음 작업

- [문서 안내와 현재 결정 사항](docs/README.md)
- [정책 서비스 핵심 현황과 선택 — 사용자용](docs/policy/README.md)
- [다음 작업과 완료 기준](docs/next-steps.md)
- [관리자 운영·화면 기준](docs/admin-console.md)
- [공개 UI·시안 대응](docs/ui/stitch-implementation.md)
- [정책 구현·운영·검증 문서 — 작업자용](docs/policy/work/README.md)

원래의 서비스 구상과 확장 아이디어는 [초기 프로젝트 개요](docs/archive/project-overview-original.md)에 보관했습니다. 해당 문서의 기술 스택·기능 목록은 현재 구현 상태를 뜻하지 않습니다.

## 검증

변경 범위에 맞는 검사를 선택합니다. 문서만 수정할 때는 링크·내용 검토로 확인합니다.

```bash
npm run build -- --webpack
npm run policy:test
node --experimental-strip-types --test src/features/admin/server/*.test.ts
```

UI 검사 방법과 합성 데이터 검증의 범위는 [공개 UI 문서](docs/ui/stitch-implementation.md)와 [관리자 문서](docs/admin-console.md)에 구분해 두었습니다.
