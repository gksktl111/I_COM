import Link from "next/link";
import { ShieldCheck, UserPlus } from "lucide-react";
import { EmptyState, PageHeading, Panel } from "@/features/admin/components";
import { CreateAdminAccountForm } from "@/features/admin/components/AdminAccountForms";
import { AdminPasswordDialog } from "@/features/admin/components/AdminPasswordDialog";
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
        action={
          <a className="admin-button" href="#new-admin-account">
            <UserPlus size={15} aria-hidden="true" />
            관리자 추가
          </a>
        }
      />
      <div className="admin-grid-main admin-account-layout items-start">
        <Panel
          title="관리자 계정 목록"
          description="전체 계정의 현재 페이지에 포함된 관리자입니다."
          action={
            <span className="admin-badge admin-badge-neutral">
              현재 페이지 {result.items.length}명
            </span>
          }
        >
          {result.items.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">관리자</th>
                    <th scope="col">계정 활동 (KST)</th>
                    <th scope="col">비밀번호 관리</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((account) => (
                    <tr key={account.id}>
                      <td className="admin-table-title">
                        <div className="flex items-start gap-3">
                          <span className="admin-avatar" aria-hidden="true">
                            <ShieldCheck size={17} />
                          </span>
                          <div className="min-w-0">
                            <p className="m-0 font-semibold break-all">
                              {account.email ?? "이메일 없음"}
                            </p>
                            {account.id === currentAdmin.id && (
                              <span className="admin-badge mt-1">
                                현재 계정
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="m-0">
                          로그인 {dateTime(account.last_sign_in_at)}
                        </p>
                        <p className="admin-muted m-0 mt-1 text-xs">
                          등록 {dateTime(account.created_at)}
                        </p>
                      </td>
                      <td>
                        <AdminPasswordDialog
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
        <div id="new-admin-account" className="min-w-0 scroll-mt-6">
          <Panel
            title="새 관리자 등록"
            description="등록한 이메일과 비밀번호로 바로 로그인할 수 있습니다."
          >
            <CreateAdminAccountForm />
          </Panel>
        </div>
      </div>
    </>
  );
}
