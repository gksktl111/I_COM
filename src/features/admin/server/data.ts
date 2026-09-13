import "server-only";
import { requireAdmin } from "./auth";
import { INTERESTS } from "../../policy/public/types.ts";
import { POLICY_RELEVANCE_CATEGORIES } from "../../policy/server/relevance.ts";
import { createRepository } from "../../policy/server/repository.ts";

// 현재 여섯 태그와 이전 평가 이력의 분야를 모두 조회할 수 있게 한다.
export const POLICY_CATEGORY_FILTERS = [...new Set([...INTERESTS, ...Object.values(POLICY_RELEVANCE_CATEGORIES)])];

export type AdminUser = {
  id: string;
  /** Masked at the server boundary; full email and metadata never leave this module. */
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
};
export type AdminCatalogStatus = "ACTIVE" | "REVIEW" | "EXCLUDED";
export type AdminPolicy = {
  catalog_status: AdminCatalogStatus;
  id: string;
  external_id: string;
  provider: string;
  updated_at: string | null;
  name: string | null;
  provider_name: string | null;
  summary: string | null;
  purpose_text: string | null;
  target_text: string | null;
  criteria_text: string | null;
  benefit_text: string | null;
  application_method_text: string | null;
  application_period_text: string | null;
  source_url: string | null;
  relevance: AdminRelevance | null;
  relevance_assessed_at: string | null;
};
export type AdminRelevance = {
  version: "policy-relevance-1" | "policy-relevance-2" | "policy-relevance-3" | "policy-relevance-review-1" | "policy-relevance-review-2" | "policy-relevance-review-3" | "policy-relevance-review-4" | "policy-relevance-review-5";
  status: "RELATED" | "UNRELATED" | "REVIEW";
  categories: string[];
  evidence: { field: string; excerpt: string; rule: string }[];
  reason: string;
  truncated: boolean;
};
export type AdminPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  hasNext: boolean;
};
export type AdminRelevanceOverview = {
  total: number;
  related: number;
  unrelated: number;
  review: number;
  unassessed: number;
};

const PAGE_SIZE = 30;
const CATALOG_STATUSES = new Set(["ACTIVE", "REVIEW", "EXCLUDED"]);
const PROVIDERS = new Set(["GOV24", "BOKJIRO_CENTRAL", "BOKJIRO_LOCAL"]);
const DISPLAY_FIELDS = [
  "name",
  "provider_name",
  "summary",
  "purpose_text",
  "target_text",
  "criteria_text",
  "benefit_text",
  "application_method_text",
  "application_period_text",
  "source_url",
] as const;

function validPage(page: number): number {
  if (!Number.isInteger(page) || page < 1 || page > 10_000)
    throw new Error("invalid-admin-page");
  return page;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("admin-response-invalid");
  return value as Record<string, unknown>;
}

function nullableText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("admin-response-invalid");
  return value;
}

function requiredText(value: unknown): string {
  const result = nullableText(value);
  if (!result) throw new Error("admin-response-invalid");
  return result;
}

function relevanceProjection(value: unknown): AdminRelevance | null {
  if (value == null) return null;
  const row = record(value);
  if (
    !["policy-relevance-1", "policy-relevance-2", "policy-relevance-3", "policy-relevance-review-1", "policy-relevance-review-2", "policy-relevance-review-3", "policy-relevance-review-4", "policy-relevance-review-5"].includes(
      String(row.version),
    ) ||
    !["RELATED", "UNRELATED", "REVIEW"].includes(String(row.status)) ||
    !Array.isArray(row.categories) ||
    !Array.isArray(row.evidence)
  )
    throw new Error("admin-response-invalid");
  let truncated = row.categories.length > 20 || row.evidence.length > 40;
  const boundedText = (value: unknown, limit: number): string => {
    const text = requiredText(value);
    if (text.length > limit) truncated = true;
    return text.slice(0, limit);
  };
  return {
    version: row.version as AdminRelevance["version"],
    status: row.status as AdminRelevance["status"],
    categories: row.categories
      .map((category) => boundedText(category, 80))
      .slice(0, 20),
    evidence: row.evidence
      .map((value) => {
        const item = record(value);
        return {
          field: boundedText(item.field, 120),
          excerpt: boundedText(item.excerpt, 1000),
          rule: boundedText(item.rule, 120),
        };
      })
      .slice(0, 40),
    reason: boundedText(row.reason, 2000),
    truncated,
  };
}

async function request(
  path: string,
  params: URLSearchParams,
  countOnly = false,
): Promise<unknown> {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key || !process.env.SUPABASE_URL)
    throw new Error("missing-supabase-environment");
  let base: URL;
  try {
    base = new URL(process.env.SUPABASE_URL);
  } catch {
    throw new Error("invalid-supabase-url");
  }
  if (
    base.protocol !== "https:" ||
    !base.hostname.endsWith(".supabase.co") ||
    base.username ||
    base.password ||
    base.port
  )
    throw new Error("invalid-supabase-url");
  const url = new URL(path, base);
  url.search = params.toString();
  let response: Response;
  try {
    response = await fetch(url, {
      method: countOnly ? "HEAD" : "GET",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      // Supabase secret keys are gateway API keys, not JWT bearer tokens.
      headers: { apikey: key, Accept: "application/json", ...(countOnly ? { Prefer: "count=exact" } : {}) },
    });
  } catch {
    throw new Error("admin-transport-failed");
  }
  if (!response.ok) throw new Error(`admin-http-${response.status}`);
  if (countOnly) {
    const total = response.headers.get("content-range")?.split("/")[1];
    if (!total || !/^\d+$/.test(total) || !Number.isSafeInteger(Number(total)))
      throw new Error("admin-response-invalid");
    return Number(total);
  }
  try {
    return await response.json();
  } catch {
    throw new Error("admin-response-invalid");
  }
}

/** A minimal Auth admin projection. Pagination never exposes upstream links. */
export async function listUsers(page = 1): Promise<AdminPage<AdminUser>> {
  await requireAdmin();
  validPage(page);
  const data = record(
    await request(
      "/auth/v1/admin/users",
      new URLSearchParams({
        page: String(page),
        per_page: String(PAGE_SIZE),
      }),
    ),
  );
  if (!Array.isArray(data.users) || data.users.length > PAGE_SIZE)
    throw new Error("admin-response-invalid");
  const items = data.users.map((value): AdminUser => {
    const row = record(value);
    const email = nullableText(row.email);
    const at = email?.lastIndexOf("@") ?? -1;
    return {
      id: requiredText(row.id),
      email:
        email && at > 0
          ? `${email.slice(0, 1)}***@${email.slice(at + 1)}`
          : null,
      created_at: nullableText(row.created_at),
      last_sign_in_at: nullableText(row.last_sign_in_at),
      banned_until: nullableText(row.banned_until),
    };
  });
  return {
    items,
    page,
    pageSize: PAGE_SIZE,
    hasNext: page < 10_000 && items.length === PAGE_SIZE,
  };
}

/** Catalog status counts are separate from technical quality review counts. */
export async function catalogOverview() {
  await requireAdmin();
  const count = async (status: "ACTIVE" | "REVIEW", provider?: string) =>
    (await request("/rest/v1/policies", new URLSearchParams({
      select: provider ? "source_id,policy_sources!inner(provider)" : "source_id",
      catalog_status: `eq.${status}`,
      ...(provider ? { "policy_sources.provider": `eq.${provider}` } : {}),
    }), true)) as number;
  const [active, review, central, local, gov24] = await Promise.all([
    count("ACTIVE"), count("REVIEW"),
    count("ACTIVE", "BOKJIRO_CENTRAL"),
    count("ACTIVE", "BOKJIRO_LOCAL"), count("ACTIVE", "GOV24"),
  ]);
  return { active, review, sources: [
    { name: "복지로 중앙", count: central },
    { name: "복지로 지자체", count: local },
    { name: "Gov24", count: gov24 },
  ] };
}

/** Global counts; filters on the policy list do not change this summary. */
export async function relevanceOverview(): Promise<AdminRelevanceOverview> {
  await requireAdmin();
  const repository = createRepository(
    (input, init) => fetch(input, { ...init, cache: "no-store" }),
    "policy_admin_report",
  );
  const row = record(await repository.command("relevance_overview", {}));
  const count = (key: keyof AdminRelevanceOverview): number => {
    const value = row[key];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
      throw new Error("admin-response-invalid");
    return value;
  };
  return {
    total: count("total"),
    related: count("related"),
    unrelated: count("unrelated"),
    review: count("review"),
    unassessed: count("unassessed"),
  };
}

/** Current normalized policy display only; raw snapshots and provenance are excluded. */
export async function listPolicies(
  filters: {
    query?: string;
    provider?: string;
    relevanceStatus?: string;
    catalogStatus?: string;
    category?: string;
    page?: number;
  } = {},
): Promise<AdminPage<AdminPolicy>> {
  await requireAdmin();
  const page = validPage(filters.page ?? 1);
  const query = filters.query?.trim() ?? "";
  if (query.length > 100 || (query && !/^[\p{L}\p{N}\p{M} \-]+$/u.test(query)))
    throw new Error("invalid-admin-query");
  if (filters.provider && !PROVIDERS.has(filters.provider))
    throw new Error("invalid-admin-provider");
  if (
    filters.relevanceStatus &&
    !["RELATED", "UNRELATED", "REVIEW", "UNASSESSED"].includes(
      filters.relevanceStatus,
    )
  )
    throw new Error("invalid-admin-relevance-status");
  const catalogStatus = filters.catalogStatus ?? "ACTIVE";
  if (catalogStatus !== "ALL" && !CATALOG_STATUSES.has(catalogStatus))
    throw new Error("invalid-admin-catalog-status");
  const category = filters.category?.trim() ?? "";
  if (
    category &&
    !POLICY_CATEGORY_FILTERS.some(
      (label) => label === category,
    )
  )
    throw new Error("invalid-admin-category");
  const params = new URLSearchParams({
    select: [
      "source_id",
      "updated_at",
      "relevance",
      "relevance_assessed_at",
      "catalog_status",
      ...DISPLAY_FIELDS.map(
        (field) => `${field}:normalized->display->>${field}`,
      ),
      "policy_sources!inner(provider,external_id)",
    ].join(","),
    order: "updated_at.desc,source_id.asc",
    offset: String((page - 1) * PAGE_SIZE),
    limit: String(PAGE_SIZE + 1),
  });
  if (catalogStatus !== "ALL")
    params.set("catalog_status", `eq.${catalogStatus}`);
  if (query) params.set("normalized->display->>name", `ilike.*${query}*`);
  if (filters.provider)
    params.set("policy_sources.provider", `eq.${filters.provider}`);
  if (filters.relevanceStatus)
    params.set(
      "relevance->>status",
      filters.relevanceStatus === "UNASSESSED"
        ? "is.null"
        : `eq.${filters.relevanceStatus}`,
    );
  if (category)
    params.set("relevance", `cs.${JSON.stringify({ categories: [category] })}`);
  const data = await request("/rest/v1/policies", params);
  if (!Array.isArray(data) || data.length > PAGE_SIZE + 1)
    throw new Error("admin-response-invalid");
  const items = data.slice(0, PAGE_SIZE).map((value): AdminPolicy => {
    const row = record(value),
      source = record(row.policy_sources);
    if (
      typeof row.catalog_status !== "string" ||
      !CATALOG_STATUSES.has(row.catalog_status)
    )
      throw new Error("admin-response-invalid");
    const display = Object.fromEntries(
      DISPLAY_FIELDS.map((field) => [field, nullableText(row[field])]),
    ) as Pick<AdminPolicy, (typeof DISPLAY_FIELDS)[number]>;
    if (display.source_url) {
      try {
        const url = new URL(display.source_url);
        if (
          !["https:", "http:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          display.source_url = null;
      } catch {
        display.source_url = null;
      }
    }
    return {
      ...display,
      catalog_status: row.catalog_status as AdminCatalogStatus,
      id: requiredText(row.source_id),
      external_id: requiredText(source.external_id),
      provider: requiredText(source.provider),
      updated_at: nullableText(row.updated_at),
      relevance: relevanceProjection(row.relevance),
      relevance_assessed_at: nullableText(row.relevance_assessed_at),
    };
  });
  return {
    items,
    page,
    pageSize: PAGE_SIZE,
    hasNext: page < 10_000 && data.length > PAGE_SIZE,
  };
}
