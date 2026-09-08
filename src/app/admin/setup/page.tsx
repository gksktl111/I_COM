import { AdminPasswordSetup } from "@/features/admin/components/AdminPasswordSetup";
export const metadata = {
  title: "관리자 비밀번호 설정 · 아이콤",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function SetupPage() {
  return <AdminPasswordSetup />;
}
