import { requireAdmin } from "@/features/admin/server/auth";
import { AdminShell } from "@/features/admin/components/AdminShell";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "아이콤 관리자",
  robots: { index: false, follow: false },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();
  return <AdminShell email={admin.email}>{children}</AdminShell>;
}
