import { createRepository } from "./repository.ts";
import type { Provider } from "./automatic-source.ts";
import type { QualityAssessment } from "./quality.ts";

export type ReportFilters = {
  provider?: Provider;
  runId?: string;
  limit?: number;
  beforeId?: string;
  beforeStartedAt?: string;
  status?: string;
  code?: string;
};
export type ReportPage<T> = {
  items: T[];
  nextCursor: { beforeId: string; beforeStartedAt?: string } | null;
};
export type QualityRow = {
  id: number;
  run_id: string;
  external_id: string;
  provider: Provider;
  source_id: string | null;
  snapshot_id: string | null;
  assessed_at: string;
  evaluator_version: string;
  status: QualityAssessment["status"] | "NOT_EVALUATED";
  required_count: number;
  present_count: number;
  missing_count: number;
  issues: QualityAssessment["issues"];
  matches_current: boolean;
  ingestion_status: string;
  error_code: string | null;
};
/** Server-only. A future route MUST authorize the administrator before calling this reader. */
export function createPolicyQualityReader(fetcher: typeof fetch = fetch) {
  const repository = createRepository(fetcher, "policy_admin_report");
  return {
    overview: (provider?: Provider) =>
      repository.command<{
        policies: number;
        unassessedCurrent: number;
        comparisonReady: 0;
        quality: Array<{
          status: string;
          count: number;
          required: number;
          present: number;
          missing: number;
        }>;
        dailyUsage: Array<{
          provider: Provider;
          day: string;
          reserved_calls: number;
          configured_limit: number;
        }>;
      }>("overview", provider ? { provider } : {}),
    runs: (filters: ReportFilters = {}) =>
      repository.command<
        ReportPage<{
          id: string;
          provider: Provider;
          status: string;
          summary: Record<string, unknown>;
          calls: number;
          started_at: string;
          finished_at: string | null;
          discovery_complete: boolean | null;
          expected_total: number | null;
          discovered: number | null;
          next_page: number | null;
          stop_reason: string | null;
          lease_active: boolean | null;
        }>
      >("runs", filters),
    quality: (filters: ReportFilters = {}) =>
      repository.command<ReportPage<QualityRow>>("quality", filters),
  };
}
