import "server-only";
import { requireAdmin } from "@/features/admin/server/auth";

export type AdminNotice = {
  id: string;
  title: string;
  body: string;
  kind: "NOTICE" | "NOTIFICATION";
  status: "DRAFT" | "ARCHIVED";
  author_id: string;
  author_email: string;
  updated_at: string;
};

async function requestNotices(
  query: URLSearchParams,
  init?: RequestInit,
): Promise<AdminNotice[]> {
  const key = process.env.SUPABASE_SECRET_KEY;
  const configuredUrl = process.env.SUPABASE_URL;
  if (!key || !configuredUrl) throw new Error("notices-unavailable");
  const base = new URL(configuredUrl);
  if (
    base.protocol !== "https:" ||
    !base.hostname.endsWith(".supabase.co") ||
    base.username ||
    base.password ||
    base.port
  ) {
    throw new Error("notices-unavailable");
  }
  const url = new URL("/rest/v1/admin_notices", base);
  url.search = query.toString();
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  });
  if (!response.ok) throw new Error("notices-unavailable");
  return response.json();
}

export async function listAdminNotices(): Promise<AdminNotice[]> {
  await requireAdmin();
  return requestNotices(
    new URLSearchParams({
      select: "*",
      order: "updated_at.desc,id.asc",
      limit: "100",
    }),
  );
}

export async function saveAdminNotice(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const kind = String(form.get("kind") ?? "");
  const id = String(form.get("id") ?? "");
  if (
    !title ||
    title.length > 120 ||
    !body ||
    body.length > 10000 ||
    !["NOTICE", "NOTIFICATION"].includes(kind)
  ) {
    throw new Error("invalid-notice");
  }
  const payload = {
    title,
    body,
    kind,
    updated_by: admin.id,
    updated_at: new Date().toISOString(),
  };
  if (!id) {
    await requestNotices(new URLSearchParams(), {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        status: "DRAFT",
        author_id: admin.id,
        author_email: admin.email,
      }),
    });
    return;
  }
  const rows = await requestNotices(draftFilter(form), {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (rows.length !== 1) throw new Error("notice-conflict");
}

function draftFilter(form: FormData): URLSearchParams {
  const id = String(form.get("id") ?? "");
  const updated = String(form.get("updated_at") ?? "");
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id,
    ) ||
    !Number.isFinite(Date.parse(updated))
  ) {
    throw new Error("invalid-notice");
  }
  return new URLSearchParams({
    id: `eq.${id}`,
    status: "eq.DRAFT",
    updated_at: `eq.${updated}`,
  });
}

export async function archiveAdminNotice(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const rows = await requestNotices(draftFilter(form), {
    method: "PATCH",
    body: JSON.stringify({
      status: "ARCHIVED",
      updated_by: admin.id,
      updated_at: new Date().toISOString(),
    }),
  });
  if (rows.length !== 1) throw new Error("notice-conflict");
}
