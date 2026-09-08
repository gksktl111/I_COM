"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, requireAdmin } from "@/features/admin/server/auth";
import { authRequest } from "@/features/admin/server/auth-core";
import {
  AccountError,
  registerAdminAccount,
  updateAdminPassword,
} from "@/features/admin/server/accounts";

export type AccountActionState = { error?: string; success?: string };
export async function createAdminAccount(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  await requireAdmin();
  try {
    await registerAdminAccount(form);
  } catch (error) {
    return {
      error:
        error instanceof AccountError
          ? error.message
          : "계정을 등록하지 못했습니다. 다시 시도해주세요.",
    };
  }
  revalidatePath("/admin/accounts");
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return {
    success:
      "관리자 계정을 등록했습니다. 입력한 이메일과 비밀번호로 바로 로그인할 수 있습니다.",
  };
}
export async function changeAdminPassword(
  _previous: AccountActionState,
  form: FormData,
): Promise<AccountActionState> {
  await requireAdmin();
  let ownAccount = false;
  try {
    ({ ownAccount } = await updateAdminPassword(form));
  } catch (error) {
    return {
      error:
        error instanceof AccountError
          ? error.message
          : "비밀번호를 변경하지 못했습니다. 다시 시도해주세요.",
    };
  }
  revalidatePath("/admin/accounts");
  if (ownAccount) {
    const jar = await cookies();
    const token = jar.get(ADMIN_COOKIE)?.value;
    if (token) {
      try {
        await authRequest("logout?scope=local", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        /* Local cookie still cleared. */
      }
    }
    jar.set(ADMIN_COOKIE, "", {
      path: "/admin",
      maxAge: 0,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });
    redirect("/admin/login?updated=password");
  }
  return {
    success:
      "새 비밀번호를 저장했습니다. 다음 로그인부터 새 비밀번호를 사용하세요.",
  };
}
