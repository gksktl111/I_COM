import "server-only";
import { requireAdmin } from "./auth";
import { createPolicyQualityReader } from "@/features/policy/server/admin-quality";
import type { ReportFilters } from "@/features/policy/server/admin-quality";

export async function policyOverview() {
  await requireAdmin();
  const reader = createPolicyQualityReader();
  const [overview, central, local, gov24] = await Promise.all([
    reader.overview(),
    reader.overview("BOKJIRO_CENTRAL"),
    reader.overview("BOKJIRO_LOCAL"),
    reader.overview("GOV24"),
  ]);
  return {
    ...overview,
    sources: [
      { name: "복지로 중앙", count: central.policies },
      { name: "복지로 지자체", count: local.policies },
      { name: "Gov24", count: gov24.policies },
    ],
  };
}
export async function collectionRuns(filters: ReportFilters = {}) {
  await requireAdmin();
  return createPolicyQualityReader().runs(filters);
}
export async function qualityRows(filters: ReportFilters = {}) {
  await requireAdmin();
  return createPolicyQualityReader().quality(filters);
}
