import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdministrator } from "./auth-core";

export const ADMIN_COOKIE = "icom-admin-access";
export async function requireAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const user = token ? await verifyAdministrator(token) : null;
  if (!user) redirect("/admin/login");
  return { id: user.id, email: user.email ?? "관리자" };
}
