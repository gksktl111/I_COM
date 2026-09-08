import "server-only";
import { requireAdmin } from "./auth";
import { authRequest } from "./auth-core";

export type AdminAccount = {
  id: string;
  email: string;
  created_at: string | null;
  last_sign_in_at: string | null;
  confirmed: boolean;
};
export class AccountError extends Error {}
type AccountRecord = {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  app_metadata?: { role?: string };
};

async function request(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await authRequest(path, init);
  } catch {
    throw new AccountError(
      "계정 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.",
    );
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (
      ["email_exists", "user_already_exists"].includes(error.code) ||
      ["email_exists", "user_already_exists"].includes(error.error_code)
    ) {
      throw new AccountError(
        "이미 등록된 이메일입니다. 기존 계정을 확인해주세요.",
      );
    }
    if (error.code === "weak_password" || error.error_code === "weak_password")
      throw new AccountError("더 강력한 비밀번호를 입력해주세요.");
    throw new AccountError(
      "계정 요청을 처리하지 못했습니다. 입력값과 계정 상태를 확인해주세요.",
    );
  }
  try {
    return await response.json();
  } catch {
    throw new AccountError("계정 응답을 확인할 수 없습니다.");
  }
}
function passwordFrom(form: FormData) {
  const password = String(form.get("password") ?? "");
  if (password.length < 12 || password.length > 256)
    throw new AccountError("비밀번호는 12~256자로 입력해주세요.");
  if (password !== form.get("confirm"))
    throw new AccountError("비밀번호 확인이 일치하지 않습니다.");
  return password;
}

export async function listAdminAccounts(
  page = 1,
): Promise<{ items: AdminAccount[]; page: number; hasNext: boolean }> {
  await requireAdmin();
  if (!Number.isInteger(page) || page < 1 || page > 10000)
    throw new AccountError("잘못된 페이지입니다.");
  const data = await request(`admin/users?page=${page}&per_page=50`);
  if (!Array.isArray(data.users) || data.users.length > 50)
    throw new AccountError("계정 응답을 확인할 수 없습니다.");
  return {
    items: (data.users as AccountRecord[])
      .filter((user) => user.app_metadata?.role === "admin")
      .map((user) => ({
        id: user.id,
        email: user.email ?? "이메일 없음",
        created_at: user.created_at ?? null,
        last_sign_in_at: user.last_sign_in_at ?? null,
        confirmed: Boolean(user.email_confirmed_at),
      })),
    page,
    hasNext: page < 10000 && data.users.length === 50,
  };
}

export async function registerAdminAccount(form: FormData): Promise<void> {
  const actor = await requireAdmin();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new AccountError("올바른 이메일 주소를 입력해주세요.");
  const password = passwordFrom(form);
  // The provider enforces email uniqueness. Never fall back to updating an existing user.
  await request("admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: "admin", created_by_admin: actor.id },
    }),
  });
}

export async function updateAdminPassword(
  form: FormData,
): Promise<{ ownAccount: boolean }> {
  const actor = await requireAdmin();
  const id = String(form.get("targetId") ?? "");
  if (!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id))
    throw new AccountError("유효한 관리자 계정을 선택해주세요.");
  const password = passwordFrom(form);
  const target: AccountRecord = await request(`admin/users/${id}`);
  if (target.id !== id || target.app_metadata?.role !== "admin")
    throw new AccountError("관리자 계정만 변경할 수 있습니다.");
  // Do not echo the response or write the password into app metadata, a file, or logs.
  await request(`admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify({ password }),
  });
  return { ownAccount: id === actor.id };
}
