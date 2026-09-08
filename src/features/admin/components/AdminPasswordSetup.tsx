"use client";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { setAdminPassword } from "@/app/admin/setup/actions";
import "../admin.css";
export function AdminPasswordSetup() {
  const [state, action, pending] = useActionState(
    async (previous: { error?: string; success?: boolean }, form: FormData) => {
      // Read at submission time: React can reset uncontrolled form fields, and
      // the fragment must survive refresh/retry until password setup succeeds.
      const hash = new URLSearchParams(window.location.hash.slice(1));
      form.set("token_hash", hash.get("token_hash") ?? "");
      return setAdminPassword(previous, form);
    },
    {},
  );
  useEffect(() => {
    if (state.success) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [state.success]);
  return (
    <main className="admin-login-page">
      <div className="admin-login-wrap">
        <div className="admin-login-card">
          <h1>관리자 비밀번호 설정</h1>
          {state.success ? (
            <>
              <p role="status">
                비밀번호를 설정했습니다. 관리자 이메일과 새 비밀번호로
                로그인해주세요.
              </p>
              <Link
                className="admin-button admin-login-submit"
                href="/admin/login"
              >
                관리자 로그인
              </Link>
            </>
          ) : (
            <>
              <p>
                본인만 아는 12자 이상의 비밀번호를 정해주세요.
                <br />
                비밀번호는 이 화면에서만 입력합니다.
              </p>
              <form action={action} className="admin-login-form">
                <label htmlFor="new-password">새 비밀번호</label>
                <input
                  id="new-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={256}
                />
                <label htmlFor="confirm-password">비밀번호 확인</label>
                <input
                  id="confirm-password"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={256}
                />
                {state.error && (
                  <p className="admin-error" role="alert">
                    {state.error}
                  </p>
                )}
                <button
                  className="admin-button admin-login-submit"
                  disabled={pending}
                >
                  {pending ? "설정 중…" : "비밀번호 설정"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
