"use server";
import { cookies } from "next/headers";
import {
  authRequest,
  verifyAdministrator,
} from "@/features/admin/server/auth-core";

export async function setAdminPassword(
  _previous: { error?: string; success?: boolean },
  form: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const password = String(form.get("password") ?? "");
  if (
    password.length < 12 ||
    password.length > 256 ||
    password !== form.get("confirm")
  )
    return {
      error:
        "12자 이상의 비밀번호를 입력하고, 확인란에도 동일하게 입력해주세요.",
    };
  const jar = await cookies();
  let access = jar.get("icom-admin-setup")?.value;
  try {
    if (!access || !(await verifyAdministrator(access))) {
      const token = String(form.get("token_hash") ?? "");
      if (!/^[A-Za-z0-9_-]{20,256}$/.test(token))
        return { error: "유효한 비밀번호 설정 링크로 접속해주세요." };
      const response = await authRequest("verify", {
        method: "POST",
        body: JSON.stringify({ token_hash: token, type: "invite" }),
      });
      if (!response.ok)
        return {
          error:
            "설정 링크가 만료되었거나 이미 사용되었습니다. 새 링크가 필요합니다.",
        };
      const session = await response.json();
      if (
        typeof session.access_token !== "string" ||
        !(await verifyAdministrator(session.access_token))
      )
        return { error: "관리자 계정으로 확인되지 않았습니다." };
      access = session.access_token;
      const maxAge = Math.min(600, Number(session.expires_in) || 0);
      if (maxAge <= 0) return { error: "설정 링크가 만료되었습니다." };
      jar.set("icom-admin-setup", access!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/admin/setup",
        maxAge,
      });
    }
    const response = await authRequest("user", {
      method: "PUT",
      headers: { Authorization: `Bearer ${access}` },
      body: JSON.stringify({ password }),
    });
    if (!response.ok)
      return {
        error:
          "비밀번호를 저장하지 못했습니다. 다른 강력한 비밀번호로 다시 시도해주세요.",
      };
    jar.set("icom-admin-setup", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/admin/setup",
      maxAge: 0,
    });
    try {
      await authRequest("logout?scope=local", {
        method: "POST",
        headers: { Authorization: `Bearer ${access}` },
      });
    } catch {
      /* Setup cookie was already removed. */
    }
    return { success: true };
  } catch {
    return { error: "연결을 확인한 뒤 다시 시도해주세요." };
  }
}
