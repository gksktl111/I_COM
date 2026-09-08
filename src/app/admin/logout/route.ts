import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/features/admin/server/auth";
import { authRequest } from "@/features/admin/server/auth-core";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return new NextResponse("허용되지 않은 요청입니다.", { status: 403 });
  }
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (token) {
    try {
      await authRequest("logout?scope=local", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      /* Always clear the local session even when the provider is unavailable. */
    }
  }
  const response = NextResponse.redirect(
    new URL("/admin/login", request.url),
    303,
  );
  response.cookies.set(ADMIN_COOKIE, "", {
    path: "/admin",
    maxAge: 0,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
