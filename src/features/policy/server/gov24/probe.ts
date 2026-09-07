export type Endpoint = "serviceList" | "serviceDetail" | "supportConditions";
export type Row = Record<string, unknown>;
export type Capture = {
  endpoint: Endpoint;
  page: number;
  perPage: number;
  filters: Record<string, string>;
  at: string;
  status?: number;
  body?: unknown;
  error?: string;
  attempt: number;
  anomalies?: string[];
};
export function decodeKey(key: string): string {
  try {
    return decodeURIComponent(key);
  } catch {
    throw new Error("Invalid API key encoding");
  }
}
export function redact(value: unknown, key: string): unknown {
  const secrets = [
    key,
    encodeURIComponent(key),
    encodeURIComponent(encodeURIComponent(key)),
  ]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (typeof value === "string") {
    let text = value;
    for (const secret of secrets) text = text.split(secret).join("[REDACTED]");
    return text.replace(
      /(serviceKey|authorization|api[_-]?key)(\s*[=:]\s*)[^\s&"<>]+/gi,
      "$1$2[REDACTED]",
    );
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, key));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        String(redact(k, key)),
        /servicekey|authorization|api[_-]?key/i.test(k)
          ? "[REDACTED]"
          : redact(v, key),
      ]),
    );
  return value;
}
export function rowsOf(body: unknown): Row[] | undefined {
  if (
    !body ||
    typeof body !== "object" ||
    !("data" in body) ||
    !Array.isArray(body.data)
  )
    return undefined;
  return body.data.every((r) => r && typeof r === "object" && !Array.isArray(r))
    ? (body.data as Row[])
    : undefined;
}
export function validateRequest(
  endpoint: Endpoint,
  page: number,
  perPage: number,
  filters: Record<string, string>,
) {
  if (
    !["serviceList", "serviceDetail", "supportConditions"].includes(endpoint) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 1000 ||
    !Number.isInteger(perPage) ||
    perPage < 1 ||
    perPage > 100
  )
    throw new Error("Invalid request options");
  const allowed =
    endpoint === "serviceList"
      ? ["cond[서비스명::LIKE]", "cond[소관기관명::LIKE]"]
      : ["cond[서비스ID::EQ]"];
  if (
    Object.entries(filters).some(
      ([k, v]) =>
        !allowed.includes(k) ||
        typeof v !== "string" ||
        !v.trim() ||
        v.length > 500,
    )
  )
    throw new Error("Invalid request filter");
}
export function envelopeAnomalies(
  body: unknown,
  page: number,
  perPage: number,
): string[] {
  if (!body || typeof body !== "object") return ["missing-envelope"];
  const b = body as Row;
  const issues: string[] = [];
  for (const field of [
    "page",
    "perPage",
    "currentCount",
    "totalCount",
    "matchCount",
  ])
    if (!Number.isInteger(b[field]) || Number(b[field]) < 0)
      issues.push(`invalid-${field}`);
  if (b.page !== page) issues.push("page-mismatch");
  if (b.perPage !== perPage) issues.push("perPage-mismatch");
  if (Array.isArray(b.data) && b.currentCount !== b.data.length)
    issues.push("currentCount-mismatch");
  if (
    ["code", "error", "errors", "message"].some((field) =>
      Object.hasOwn(b, field),
    )
  )
    issues.push("business-envelope-unverified");
  return issues;
}
export class ProbeClient {
  key: string;
  calls = 0;
  blocked = false;
  anomalyCount = 0;
  budget: number;
  capture: (c: Capture) => Promise<void>;
  fetcher: typeof fetch;
  timeoutMs: number;
  maxBytes: number;
  constructor(
    key: string,
    budget: number,
    capture: (c: Capture) => Promise<void>,
    fetcher: typeof fetch = fetch,
    timeoutMs = 15000,
    maxBytes = 2_000_000,
  ) {
    this.budget = budget;
    this.capture = capture;
    this.fetcher = fetcher;
    this.timeoutMs = timeoutMs;
    this.maxBytes = maxBytes;
    this.key = decodeKey(key);
    if (
      !this.key.trim() ||
      !Number.isInteger(budget) ||
      budget < 1 ||
      budget > 200
    )
      throw new Error("Invalid key or budget");
  }
  async request(
    endpoint: Endpoint,
    page: number,
    perPage: number,
    filters: Record<string, string>,
  ): Promise<Row[]> {
    validateRequest(endpoint, page, perPage, filters);
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (this.blocked)
        throw new Error("Run stopped after authentication or quota response");
      if (this.calls >= this.budget)
        throw new Error("Request budget exhausted");
      this.calls++;
      const record: Capture = {
        endpoint,
        page,
        perPage,
        filters,
        at: new Date().toISOString(),
        attempt,
      };
      const url = new URL(`https://api.odcloud.kr/api/gov24/v3/${endpoint}`);
      for (const [k, v] of Object.entries({
        serviceKey: this.key,
        page: String(page),
        perPage: String(perPage),
        ...filters,
      }))
        url.searchParams.set(k, v);
      let retry = false;
      try {
        const response = await this.fetcher(url, {
          redirect: "error",
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        record.status = response.status;
        if ([401, 403, 429].includes(response.status)) this.blocked = true;
        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        if (reader) {
          try {
            while (true) {
              const part = await reader.read();
              if (part.done) break;
              size += part.value.length;
              if (size > this.maxBytes) throw new Error("Response size limit");
              chunks.push(part.value);
            }
          } finally {
            await reader.cancel();
          }
        }
        const raw = Buffer.concat(chunks).toString("utf8");
        try {
          record.body = JSON.parse(raw);
        } catch {
          record.body = raw;
        }
        if (!response.ok) {
          record.error = `HTTP ${response.status}`;
          retry =
            response.status >= 500 && response.status <= 599 && attempt < 3;
        } else if (!rowsOf(record.body))
          record.error = "Unrecognized response envelope";
        else {
          record.anomalies = envelopeAnomalies(record.body, page, perPage);
          this.anomalyCount += record.anomalies.length;
          if (record.anomalies.includes("business-envelope-unverified"))
            record.error = "Unverified business error envelope";
        }
      } catch {
        record.error = "Transport, timeout, redirect, or response size failure";
      }
      await this.capture(redact(record, this.key) as Capture);
      if (!record.error) return rowsOf(redact(record.body, this.key))!;
      if (!retry) throw new Error(record.error);
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
    throw new Error("Retry limit exhausted");
  }
}
export async function collectPages(
  client: ProbeClient,
  endpoint: Endpoint,
  id: string,
  perPage: number,
  maxPages: number,
) {
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20)
    throw new Error("Invalid page cap");
  const startingAnomalies = client.anomalyCount;
  const rows: Row[] = [];
  let termination = "page-cap";
  let error: string | undefined;
  for (let page = 1; page <= maxPages; page++) {
    try {
      const batch = await client.request(endpoint, page, perPage, {
        "cond[서비스ID::EQ]": id,
      });
      rows.push(...batch);
      if (batch.length === 0) {
        termination = "empty-page-observed";
        break;
      }
    } catch (e) {
      termination = "error";
      error = e instanceof Error ? e.message : "Probe failed";
      break;
    }
  }
  const mismatches = rows.filter((r) => r["서비스ID"] !== id);
  const seen = new Set<string>();
  let duplicates = 0;
  for (const row of rows) {
    const value = JSON.stringify(row);
    if (seen.has(value)) duplicates++;
    seen.add(value);
  }
  return {
    rows,
    termination,
    error,
    envelopeAnomalies: client.anomalyCount - startingAnomalies,
    rowCount: rows.length,
    mismatches,
    duplicates,
    quarantined: mismatches.length > 0,
    completeness: "unverified",
    zeroMeaning: "unverified",
  };
}
export function observations(
  rows: Row[],
  declared: Record<string, { type?: string; description?: string }> = {},
) {
  const fields = new Set([
    ...rows.flatMap(Object.keys),
    ...Object.keys(declared),
  ]);
  return Object.fromEntries(
    [...fields].sort().map((field) => {
      const stat = {
        specificationType: declared[field]?.type ?? "unverified",
        officialDescription: declared[field]?.description ?? "unverified",
        missing: 0,
        null: 0,
        empty: 0,
        whitespace: 0,
        maxStringLength: 0,
        types: {} as Record<string, number>,
        examples: [] as unknown[],
      };
      for (const row of rows) {
        if (!Object.hasOwn(row, field)) {
          stat.missing++;
          continue;
        }
        const value = row[field];
        const type =
          value === null
            ? "null"
            : Array.isArray(value)
              ? "array"
              : typeof value;
        stat.types[type] = (stat.types[type] ?? 0) + 1;
        if (value === null) stat.null++;
        if (typeof value === "string") {
          if (!value.length) stat.empty++;
          else if (!value.trim()) stat.whitespace++;
          stat.maxStringLength = Math.max(stat.maxStringLength, value.length);
        }
        if (
          stat.examples.length < 5 &&
          !stat.examples.some(
            (v) => JSON.stringify(v) === JSON.stringify(value),
          )
        )
          stat.examples.push(value);
      }
      return [field, stat];
    }),
  );
}
