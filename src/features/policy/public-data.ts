import "server-only";
import { RECOMMENDATION_FIELDS } from "./recommendation/intake.ts";
import { provisionalClassificationFingerprint } from "./server/provisional-classification.ts";
import { safePolicyUrl, type PublicPolicy } from "./public/types.ts";

const fields = [
  "summary",
  "provider_name",
  "purpose_text",
  "target_text",
  "criteria_text",
  "benefit_text",
  "application_method_text",
  "application_period_text",
  "required_documents_text",
  "reception_text",
  "contact_text",
] as const;
/** Public display projection only; callers keep all source metadata server-side. */
export function projectPublicPolicy(input: unknown): PublicPolicy | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  const normalized = row.normalized;
  if (!normalized || typeof normalized !== "object") return null;
  const display = (normalized as Record<string, unknown>).display;
  if (!display || typeof display !== "object") return null;
  const values = display as Record<string, unknown>;
  if (
    typeof row.source_id !== "string" ||
    typeof values.name !== "string" ||
    !values.name.trim()
  )
    return null;
  const policy: PublicPolicy = {
    id: row.source_id,
    name: values.name,
    ...Object.fromEntries(
      fields.map((field) => [
        field,
        typeof values[field] === "string" ? values[field] : null,
      ]),
    ),
    source_url: safePolicyUrl(values.source_url),
    application_url: safePolicyUrl(values.application_url),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  } as PublicPolicy;
  const relevance = row.relevance;
  if (relevance && typeof relevance === "object" && !Array.isArray(relevance)) {
    const review = relevance as Record<string, unknown>;
    const categories = review.categories;
    if (review.version === "policy-relevance-review-5" && review.status === "RELATED" &&
        Array.isArray(categories) && categories.length > 0 &&
        new Set(categories).size === categories.length &&
        categories.every((label) => RECOMMENDATION_FIELDS.some((field) => field.label === label))) {
      // 공개 탐색용 분야만 전달하고 검수 이력과 미확인 자격 조건은 서버에 남긴다.
      policy.reviewedScope = {
        categories: categories.map((label) => RECOMMENDATION_FIELDS.find((field) => field.label === label)!.id),
        fingerprint: provisionalClassificationFingerprint(policy),
      };
    }
  }
  return policy;
}

export async function readPublicPolicies({
  id,
  offset = 0,
}: { id?: string; offset?: number } = {}): Promise<{
  items: PublicPolicy[];
  nextOffset: number | null;
}> {
  if (
    (id !== undefined &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )) ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 100000
  )
    throw new Error("invalid-policy-filter");
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
    throw new Error("policy-data-unavailable");
  const url = new URL("/rest/v1/policy_active_candidates", base);
  url.search = new URLSearchParams({
    select: "source_id,normalized,updated_at,relevance",
    order: "source_id.asc",
    limit: id ? "1" : "1000",
    offset: String(offset),
    ...(id ? { source_id: `eq.${id}` } : {}),
  }).toString();
  const response = await fetch(url, {
    headers: { apikey: key, Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("policy-data-unavailable");
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error("policy-data-unavailable");
  const items = rows.flatMap((row) => {
    const policy = projectPublicPolicy(row);
    return policy ? [policy] : [];
  });
  return {
    items,
    nextOffset: !id && rows.length === 1000 ? offset + rows.length : null,
  };
}
