import Link from "next/link";
import { requireAdmin } from "@/features/admin/server/auth";
import { PageHeading, Panel, EmptyState } from "@/features/admin/components";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdmin();
  const reports = (await searchParams).tab === "reports";
  return (
    <>
      <PageHeading
        title="커뮤니티 / 신고"
        description="게시글과 신고 처리 현황을 관리합니다."
      />
      <nav className="admin-tabs">
        <Link
          aria-current={!reports ? "page" : undefined}
          href="/admin/community"
        >
          게시글 관리
        </Link>
        <Link
          aria-current={reports ? "page" : undefined}
          href="/admin/community?tab=reports"
        >
          신고 관리
        </Link>
      </nav>
      <Panel
        title={reports ? "신고 처리 목록" : "게시글 목록"}
        action={<span className="admin-badge">연동 준비 중</span>}
      >
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {(reports
                  ? [
                      "신고 대상",
                      "신고 사유",
                      "접수 시각",
                      "처리 상태",
                      "담당자",
                    ]
                  : [
                      "게시글 제목",
                      "게시판",
                      "작성자",
                      "작성 시각",
                      "공개 상태",
                    ]
                ).map((name) => (
                  <th key={name}>{name}</th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
        <EmptyState
          title={
            reports
              ? "신고 접수 기능 연결을 준비하고 있습니다"
              : "커뮤니티 저장 기능 연결을 준비하고 있습니다"
          }
          description="현재 사용자 커뮤니티는 화면 단계입니다. 실제 저장·신고 기능이 연결되면 이곳에서 조회하고 처리할 수 있습니다."
        />
      </Panel>
    </>
  );
}
