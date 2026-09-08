"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "@/features/admin/server/auth";
import {
  authRequest,
  verifyAdministrator,
} from "@/features/admin/server/auth-core";

export async function loginAdmin(form: FormData) {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  let token: string | undefined;
  let lifetime = 0;
  if (
    email.length <= 254 &&
    email.includes("@") &&
    password.length >= 8 &&
    password.length <= 256
  ) {
    try {
      const response = await authRequest("token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (response.ok) {
        const session = await response.json();
        if (
          typeof session.access_token === "string" &&
          (await verifyAdministrator(session.access_token))
        ) {
          token = session.access_token;
          lifetime = Math.min(3600, Number(session.expires_in) || 0);
        } else if (typeof session.access_token === "string") {
          await authRequest("logout?scope=local", {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        }
      }
    } catch {
      /* Credentials and upstream errors must never be logged or returned. */
    }
  }
  if (!token || lifetime <= 0) redirect("/admin/login?error=credentials");
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: lifetime,
  });
  redirect("/admin");
}
