import Link from "next/link";
import { EmptyState, PageHeading, Panel } from "@/features/admin/components";
import {
  ChangeAdminPasswordForm,
  CreateAdminAccountForm,
} from "@/features/admin/components/AdminAccountForms";
import { dateTime } from "@/features/admin/format";
import { listAdminAccounts } from "@/features/admin/server/accounts";
import { requireAdmin } from "@/features/admin/server/auth";

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const currentAdmin = await requireAdmin();
  const params = await searchParams;
  const page = Math.floor(
    Math.min(10000, Math.max(1, Number(params.page) || 1)),
  );
  const result = await listAdminAccounts(page);

  return (
    <>
      <PageHeading
        title="관리자 계정 관리"
        description="관리자 계정을 등록하고 계정별 비밀번호를 변경합니다."
      />
      <div className="grid gap-6">
        <Panel
          title="관리자 계정 추가"
          description="이메일과 비밀번호를 등록하면 설정 링크 없이 바로 로그인할 수 있습니다."
        >
          <CreateAdminAccountForm />
        </Panel>
        <Panel
          title="등록 관리자"
          description="전체 계정을 페이지별로 조회하여 관리자 계정만 표시합니다."
          action={
            <span className="admin-badge">전체 계정 {result.page}페이지</span>
          }
        >
          {result.items.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">이메일</th>
                    <th scope="col">이메일 확인</th>
                    <th scope="col">등록일 (KST)</th>
                    <th scope="col">최근 로그인 (KST)</th>
                    <th scope="col">비밀번호 관리</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((account) => (
                    <tr key={account.id}>
                      <td>
                        {account.email ?? "이메일 없음"}
                        {account.id === currentAdmin.id && (
                          <span className="admin-badge ml-2">현재 계정</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`admin-badge${account.confirmed ? "" : "admin-badge-warning"}`}
                        >
                          {account.confirmed ? "확인 완료" : "미확인"}
                        </span>
                      </td>
                      <td>{dateTime(account.created_at)}</td>
                      <td>{dateTime(account.last_sign_in_at)}</td>
                      <td>
                        <ChangeAdminPasswordForm
                          targetId={account.id}
                          email={account.email ?? "이메일 없음"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="이 페이지에 관리자 계정이 없습니다"
              description="다른 페이지를 확인하거나 새 관리자 계정을 등록해 주세요."
            />
          )}
          <nav className="admin-pagination" aria-label="관리자 계정 페이지">
            {result.page > 1 && (
              <Link href={`?page=${result.page - 1}`}>← 이전</Link>
            )}
            <span aria-current="page">{result.page}페이지</span>
            {result.hasNext && (
              <Link href={`?page=${result.page + 1}`}>다음 →</Link>
            )}
          </nav>
        </Panel>
      </div>
    </>
  );
}
