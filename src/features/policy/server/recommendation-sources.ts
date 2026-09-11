import "server-only";
import { projectPublicPolicy } from "../public-data.ts";
import type { PublicPolicy } from "../public/types.ts";
import { hashJson } from "./normalize.ts";

/** Internal source identity only; neither source metadata nor raw data is a public policy. */
export type RecommendationSource = {
  policy: PublicPolicy;
  source: {
    snapshotId: string;
    normalizerVersion: string;
    displayHash: string;
    /** SHA-256 of sorted complete normalized JSON, not PostgreSQL's normalized MD5. */
    normalizedFingerprint: string;
  };
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digest = /^[a-f0-9]{64}$/;
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function unavailable(): never {
  throw new Error("recommendation-data-unavailable");
}

/** One ACTIVE-row read binds display and full normalized fingerprint without a label join. */
export async function readRecommendationSourcePage({
  id,
  offset = 0,
}: { id?: string; offset?: number } = {}): Promise<{
  items: RecommendationSource[];
  nextOffset: number | null;
}> {
  if (
    (id !== undefined && !uuid.test(id)) ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 100000
  )
    throw new Error("invalid-policy-filter");

  try {
    const key = process.env.SUPABASE_SECRET_KEY;
    const base = new URL(
      process.env.SUPABASE_URL ?? "https://unconfigured.invalid",
    );
    if (
      !key ||
      base.protocol !== "https:" ||
      !base.hostname.endsWith(".supabase.co") ||
      base.username ||
      base.password ||
      base.port
    )
      unavailable();
    const limit = id ? 1 : 1000;
    const url = new URL("/rest/v1/policy_active_candidates", base);
    url.search = new URLSearchParams({
      select: "source_id,applied_snapshot_id,normalized,updated_at",
      order: "source_id.asc",
      limit: String(limit),
      offset: String(offset),
      ...(id ? { source_id: `eq.${id}` } : {}),
    }).toString();
    const response = await fetch(url, {
      headers: { apikey: key, Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
    if (!response.ok) unavailable();
    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length > limit) unavailable();
    const seen = new Set<string>();
    const items = rows.map((row: unknown): RecommendationSource => {
      if (!record(row) || !record(row.normalized)) unavailable();
      const normalized = row.normalized;
      if (
        typeof row.source_id !== "string" ||
        !uuid.test(row.source_id) ||
        (id !== undefined &&
          row.source_id.toLowerCase() !== id.toLowerCase()) ||
        seen.has(row.source_id.toLowerCase()) ||
        typeof row.applied_snapshot_id !== "string" ||
        !uuid.test(row.applied_snapshot_id) ||
        typeof normalized.normalizerVersion !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/.test(
          normalized.normalizerVersion,
        ) ||
        typeof normalized.displayHash !== "string" ||
        !digest.test(normalized.displayHash) ||
        !record(normalized.display)
      )
        unavailable();
      const policy = projectPublicPolicy(row);
      if (!policy) unavailable();
      seen.add(row.source_id.toLowerCase());
      return {
        policy,
        source: {
          snapshotId: row.applied_snapshot_id,
          normalizerVersion: normalized.normalizerVersion,
          displayHash: normalized.displayHash,
          normalizedFingerprint: hashJson(normalized),
        },
      };
    });
    return {
      items,
      nextOffset: !id && rows.length === limit ? offset + rows.length : null,
    };
  } catch {
    // Network errors, invalid JSON and malformed rows must not leak private response data.
    return unavailable();
  }
}
