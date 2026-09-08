import { AdminLoginForm } from "@/features/admin/components/AdminLoginForm";
import { loginAdmin } from "./actions";

export const metadata = {
  title: "관리자 로그인 · 아이콤",
  robots: { index: false, follow: false },
};
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const { error, updated } = await searchParams;
  return (
    <AdminLoginForm
      action={loginAdmin}
      message={
        updated === "password"
          ? "비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요."
          : undefined
      }
      error={
        error
          ? "로그인할 수 없습니다. 관리자 계정과 비밀번호를 확인해주세요."
          : undefined
      }
    />
  );
}
