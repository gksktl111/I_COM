"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/features/admin/server/auth";
import {
  archiveAdminNotice,
  saveAdminNotice,
} from "@/features/admin/server/notices";

export async function saveNoticeAction(form: FormData): Promise<void> {
  await requireAdmin();
  let result = "saved";
  try {
    await saveAdminNotice(form);
  } catch (error) {
    result =
      error instanceof Error && error.message === "invalid-notice"
        ? "invalid"
        : error instanceof Error && error.message === "notice-conflict"
          ? "conflict"
          : "error";
  }
  revalidatePath("/admin/notices");
  redirect(`/admin/notices?result=${result}`);
}

export async function archiveNoticeAction(form: FormData): Promise<void> {
  await requireAdmin();
  let result = "archived";
  try {
    await archiveAdminNotice(form);
  } catch (error) {
    result =
      error instanceof Error && error.message === "notice-conflict"
        ? "conflict"
        : "error";
  }
  revalidatePath("/admin/notices");
  redirect(`/admin/notices?result=${result}`);
}
