"use client";

import { useActionState, useState } from "react";
import { KeyRound } from "lucide-react";
import { changeAdminPassword } from "@/app/admin/(protected)/accounts/actions";
import { Dialog } from "@/components/ui/dialog";

function PasswordForm({
  targetId,
  email,
}: {
  targetId: string;
  email: string;
}) {
  const [state, action, pending] = useActionState<
    { error?: string; success?: string },
    FormData
  >(changeAdminPassword, {});

  return (
    <form
      action={action}
      className="grid gap-4"
      aria-label={`${email} 비밀번호 변경`}
      aria-busy={pending}
    >
      <p className="m-0 font-semibold break-all">{email}</p>
      <p className="admin-muted m-0 text-xs">
        본인 계정의 비밀번호를 변경하면 다시 로그인합니다.
      </p>
      <input type="hidden" name="targetId" value={targetId} />
      <label className="admin-field">
        새 비밀번호 (12~256자)
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={256}
          placeholder="12자 이상 입력하세요"
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
          placeholder="비밀번호를 다시 입력하세요"
          required
        />
      </label>
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
      <button
        className="admin-button justify-self-start"
        type="submit"
        disabled={pending}
      >
        {pending ? "변경 중…" : "비밀번호 변경 저장"}
      </button>
    </form>
  );
}

export function AdminPasswordDialog(props: {
  targetId: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="admin-button admin-button-secondary"
        type="button"
        aria-haspopup="dialog"
        aria-label={`${props.email} 비밀번호 변경`}
        onClick={() => setOpen(true)}
      >
        <KeyRound size={14} aria-hidden="true" />
        비밀번호 변경
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="관리자 비밀번호 변경"
      >
        {open && <PasswordForm {...props} />}
      </Dialog>
    </>
  );
}
