"use client";

import { useActionState } from "react";
import {
  changeAdminPassword,
  createAdminAccount,
} from "@/app/admin/(protected)/accounts/actions";

type AccountActionState = { error?: string; success?: string };

function PasswordFields() {
  return (
    <>
      <label className="admin-field">
        새 비밀번호 (12~256자)
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={256}
          required
        />
      </label>
      <label className="admin-field">
        비밀번호 확인
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={256}
          required
        />
      </label>
    </>
  );
}

function ActionMessage({ state }: { state: AccountActionState }) {
  return (
    <>
      {state.error && (
        <p className="admin-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="admin-notice" role="status">
          {state.success}
        </p>
      )}
    </>
  );
}

export function CreateAdminAccountForm() {
  const [state, action, pending] = useActionState<AccountActionState, FormData>(
    createAdminAccount,
    {},
  );

  return (
    <form
      action={action}
      className="grid max-w-lg gap-4"
      aria-label="관리자 계정 추가"
      aria-busy={pending}
    >
      <label className="admin-field">
        이메일
        <input
          name="email"
          type="email"
          autoComplete="username"
          placeholder="admin@example.com"
          maxLength={254}
          required
        />
      </label>
      <PasswordFields />
      <ActionMessage state={state} />
      <button
        className="admin-button justify-self-start"
        type="submit"
        disabled={pending}
      >
        {pending ? "등록 중…" : "관리자 계정 등록"}
      </button>
    </form>
  );
}

export function ChangeAdminPasswordForm({
  targetId,
  email,
}: {
  targetId: string;
  email: string;
}) {
  const [state, action, pending] = useActionState<AccountActionState, FormData>(
    changeAdminPassword,
    {},
  );

  return (
    <details>
      <summary className="cursor-pointer">비밀번호 변경</summary>
      <form
        action={action}
        className="mt-4 grid min-w-56 gap-4"
        aria-label={`${email} 비밀번호 변경`}
        aria-busy={pending}
      >
        <p className="admin-muted">변경할 계정: {email}</p>
        <p className="admin-muted">
          본인 계정의 비밀번호를 변경하면 다시 로그인합니다.
        </p>
        <input type="hidden" name="targetId" value={targetId} />
        <PasswordFields />
        <ActionMessage state={state} />
        <button
          className="admin-button justify-self-start"
          type="submit"
          disabled={pending}
        >
          {pending ? "변경 중…" : "비밀번호 변경 저장"}
        </button>
      </form>
    </details>
  );
}
