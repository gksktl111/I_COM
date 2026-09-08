"use server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/features/admin/server/auth";
import { runAutomatic } from "@/features/policy/server/automatic";
import { createRepository } from "@/features/policy/server/repository";
import type { Provider } from "@/features/policy/server/automatic-source";

export async function collectPolicies(form: FormData) {
  await requireAdmin();
  const provider = String(form.get("provider") ?? "") as Provider;
  const keys: Record<Provider, string> = {
    GOV24: "GOV24_API_KEY",
    BOKJIRO_CENTRAL: "BOKJIRO_CENTRAL_API_KEY",
    BOKJIRO_LOCAL: "BOKJIRO_LOCAL_API_KEY",
  };
  if (
    !Object.hasOwn(keys, provider) ||
    process.env.POLICY_SYNC_ENABLED !== "true"
  )
    redirect("/admin/collection?error=disabled");
  const key = process.env[keys[provider]];
  if (!key) redirect("/admin/collection?error=key");
  const resume = String(form.get("runId") ?? "");
  if (resume && !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(resume))
    redirect("/admin/collection?error=input");
  const keyword = String(form.get("keyword") ?? "").trim();
  if (keyword.length > 100 || /[\x00-\x1f]/.test(keyword))
    redirect("/admin/collection?error=input");
  const filters: Record<string, string> = keyword
    ? provider === "GOV24"
      ? { "cond[서비스명::LIKE]": keyword }
      : { searchWrd: keyword }
    : {};
  let id = resume;
  try {
    const repository = createRepository();
    let config = { filters, perPage: 10, maxPages: 1000, dailyLimit: 100 };
    if (resume)
      config = (
        await repository.command<{ job: { config: typeof config } }>(
          "auto_state",
          { provider, runId: resume },
        )
      ).job.config;
    const result = await runAutomatic({
      provider,
      filters: config.filters,
      key,
      repository,
      perPage: config.perPage,
      maxPages: config.maxPages,
      dailyLimit: config.dailyLimit,
      callBudget: 10,
      maxItems: 5,
      resumeRunId: resume || undefined,
      onStarted: async (runId) => {
        id = runId;
      },
    });
    id = result.runId;
  } catch {
    redirect(`/admin/collection?error=execution${id ? `&run=${id}` : ""}`);
  }
  redirect(`/admin/collection?run=${id}&updated=1`);
}
