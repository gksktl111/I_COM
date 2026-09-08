import Link from "next/link";
import { requireAdmin } from "@/features/admin/server/auth";
import { listUsers } from "@/features/admin/server/data";
import { PageHeading, Panel, EmptyState } from "@/features/admin/components";
import { dateTime } from "@/features/admin/format";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.min(10000, Math.max(1, Number(params.page) || 1));
  const result = await listUsers(Math.floor(page));
  const now = new Date().getTime();
  return (
    <>
      <PageHeading
        title="사용자 관리"
        description="가입 계정과 이용 상태를 확인합니다. 개인정보는 필요한 범위만 표시합니다."
      />
      <Panel
        title="등록 사용자"
        action={<span className="admin-badge">{result.page}페이지</span>}
      >
        {result.items.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>사용자 ID</th>
                  <th>이메일</th>
                  <th>가입일 (KST)</th>
                  <th>최근 로그인 (KST)</th>
                  <th>계정 상태</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <details>
                        <summary>{user.id.slice(0, 8)}…</summary>
                        {user.id}
                      </details>
                    </td>
                    <td>{user.email ?? "이메일 없음"}</td>
                    <td>{dateTime(user.created_at)}</td>
                    <td>{dateTime(user.last_sign_in_at)}</td>
                    <td>
                      <span className="admin-badge">
                        {user.banned_until &&
                        Date.parse(user.banned_until) > now
                          ? "이용 제한"
                          : "정상"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="등록된 사용자가 없습니다"
            description="인증 계정이 생성되면 이곳에 표시됩니다."
          />
        )}
        <nav className="admin-pagination" aria-label="사용자 페이지">
          {page > 1 && <Link href={`?page=${page - 1}`}>← 이전</Link>}
          {result.hasNext && <Link href={`?page=${page + 1}`}>다음 →</Link>}
        </nav>
      </Panel>
      <p className="admin-muted">
        이 단계에서는 계정 조회를 제공합니다. 제재·권한 변경은 별도의 처리
        이력과 함께 연결할 예정입니다.
      </p>
    </>
  );
}
