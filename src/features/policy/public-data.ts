import "server-only";
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
    select: "source_id,normalized,updated_at",
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
  const items: PublicPolicy[] = rows.flatMap((row) => {
    const display = row?.normalized?.display;
    if (
      typeof row?.source_id !== "string" ||
      !display ||
      typeof display.name !== "string" ||
      !display.name.trim()
    )
      return [];
    // Only public display text crosses the server boundary; never snapshots or assessment metadata.
    return [
      {
        id: row.source_id,
        name: display.name,
        ...Object.fromEntries(
          fields.map((field) => [
            field,
            typeof display[field] === "string" ? display[field] : null,
          ]),
        ),
        source_url: safePolicyUrl(display.source_url),
        application_url: safePolicyUrl(display.application_url),
        updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
      } as PublicPolicy,
    ];
  });
  return {
    items,
    nextOffset: !id && rows.length === 1000 ? offset + rows.length : null,
  };
}
