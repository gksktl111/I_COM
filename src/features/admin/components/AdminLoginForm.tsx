"use client";

import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowLeft, Baby, LockKeyhole, ShieldCheck } from "lucide-react";
import "../admin.css";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="admin-button admin-login-submit"
      type="submit"
      disabled={pending}
    >
      {pending ? "로그인 중…" : "관리자 로그인"}
    </button>
  );
}

export function AdminLoginForm({
  action,
  error,
  message,
}: {
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
  message?: string;
}) {
  return (
    <main className="admin-login-page">
      <div className="admin-login-wrap">
        <Link className="admin-brand admin-login-brand" href="/">
          <span className="admin-brand-icon">
            <Baby size={28} aria-hidden="true" />
          </span>
          <span>
            아이콤 <small>ADMIN CONSOLE</small>
          </span>
        </Link>
        <section
          className="admin-login-card"
          aria-labelledby="admin-login-title"
        >
          <span className="admin-login-lock">
            <LockKeyhole size={25} aria-hidden="true" />
          </span>
          <h1 id="admin-login-title">관리자 로그인</h1>
          <p>
            아이콤 운영을 위한 관리자 공간입니다.
            <br />
            등록된 관리자 계정으로 로그인해 주세요.
          </p>
          <form action={action} className="admin-login-form">
            {message && (
              <p className="admin-notice" role="status">
                {message}
              </p>
            )}
            <label htmlFor="admin-email">이메일</label>
            <input
              id="admin-email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="admin@example.com"
              required
            />
            <label htmlFor="admin-password">비밀번호</label>
            <input
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="비밀번호를 입력해 주세요"
              required
            />
            {error && (
              <div className="admin-error" role="alert">
                {error}
              </div>
            )}
            <SubmitButton />
          </form>
          <div className="admin-login-note">
            <ShieldCheck size={16} aria-hidden="true" />
            관리 권한이 있는 계정만 접근할 수 있습니다.
          </div>
        </section>
        <Link className="admin-login-back" href="/">
          <ArrowLeft size={15} aria-hidden="true" />
          아이콤 서비스로 돌아가기
        </Link>
      </div>
    </main>
  );
}
