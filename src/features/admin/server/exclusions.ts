import "server-only";
import { requireAdmin } from "./auth";
import { createRepository } from "../../policy/server/repository.ts";

export type AdminExclusion = {
  run_id: string;
  external_id: string;
  provider: "GOV24" | "BOKJIRO_CENTRAL" | "BOKJIRO_LOCAL";
  phase: "LIST" | "DETAIL";
  updated_at: string;
  reason: string;
  evidence: { field: string; excerpt: string; rule: string }[];
  truncated: boolean;
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("admin-response-invalid");
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value)
    throw new Error("admin-response-invalid");
  return value;
}

/** Recent exclusion audit only; raw source payloads never leave this boundary. */
export async function recentExclusions(): Promise<AdminExclusion[]> {
  await requireAdmin();
  const repository = createRepository(
    (input, init) => fetch(input, { ...init, cache: "no-store" }),
    "policy_admin_report",
  );
  const response = record(
    await repository.command("exclusions", { limit: 30 }),
  );
  if (!Array.isArray(response.items) || response.items.length > 30)
    throw new Error("admin-response-invalid");
  return response.items.map((value) => {
    const row = record(value),
      relevance = record(row.scope_relevance);
    if (
      !["GOV24", "BOKJIRO_CENTRAL", "BOKJIRO_LOCAL"].includes(
        String(row.provider),
      ) ||
      !["LIST", "DETAIL"].includes(String(row.scope_phase)) ||
      !["policy-relevance-1", "policy-relevance-2", "policy-relevance-3"].includes(
        String(relevance.version),
      ) ||
      relevance.status !== "UNRELATED" ||
      !Array.isArray(relevance.evidence)
    )
      throw new Error("admin-response-invalid");
    let truncated = relevance.evidence.length > 40;
    const bounded = (value: unknown, max: number) => {
      const result = text(value);
      if (result.length > max) truncated = true;
      return result.slice(0, max);
    };
    const reason = bounded(relevance.reason, 2000);
    const evidence = relevance.evidence
      .map((value) => {
        const item = record(value);
        return {
          field: bounded(item.field, 120),
          excerpt: bounded(item.excerpt, 1000),
          rule: bounded(item.rule, 120),
        };
      })
      .slice(0, 40);
    return {
      run_id: text(row.run_id),
      external_id: bounded(row.external_id, 200),
      provider: row.provider as AdminExclusion["provider"],
      phase: row.scope_phase as AdminExclusion["phase"],
      updated_at: text(row.updated_at),
      reason,
      evidence,
      truncated,
    };
  });
}
