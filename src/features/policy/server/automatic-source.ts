import { BokjiClient } from "./bokjiro.ts";
import type { BokjiProvider, BokjiRaw } from "./bokjiro.ts";
import { completePages } from "./collect.ts";
import {
  ProbeClient,
  envelopeAnomalies,
  validateRequest,
} from "./gov24/probe.ts";
import type { Capture, Row } from "./gov24/probe.ts";
import type { RawBundle } from "./normalize.ts";

export type Provider = "GOV24" | BokjiProvider;
export type SourceConfig = {
  provider: Provider;
  filters: Record<string, string>;
  perPage: number;
};
export type SourcePage = {
  page: number;
  total: number;
  sourceTotal: number | null;
  rows: Row[];
  ids: string[];
  capturedAt: string;
  xml: string | null;
  evidence: unknown[];
};
export type Raw = RawBundle | BokjiRaw;

function count(value: unknown): number {
  if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value))
    value = Number(value);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error("invalid-count");
  return value;
}

export function createAutomaticSource(
  config: SourceConfig,
  key: string,
  budget: number,
  beforeRequest: () => Promise<void>,
  fetcher: typeof fetch = fetch,
) {
  const { provider, perPage } = config;
  if (
    !["GOV24", "BOKJIRO_CENTRAL", "BOKJIRO_LOCAL"].includes(provider) ||
    !Number.isInteger(perPage) ||
    perPage < 1 ||
    perPage > 100 ||
    !config.filters ||
    typeof config.filters !== "object" ||
    Array.isArray(config.filters)
  )
    throw new Error("invalid-source-config");
  const filters = { ...config.filters };
  if (provider === "GOV24") validateRequest("serviceList", 1, perPage, filters);
  else {
    const allowed =
      provider === "BOKJIRO_CENTRAL"
        ? ["srchKeyCode", "searchWrd"]
        : ["srchKeyCode", "searchWrd", "ctpvNm", "sggNm"];
    if (
      Object.entries(filters).some(
        ([k, v]) =>
          !allowed.includes(k) ||
          typeof v !== "string" ||
          !v.trim() ||
          v.length > 500,
      )
    )
      throw new Error("invalid-source-filter");
    if (provider === "BOKJIRO_CENTRAL") filters.srchKeyCode ??= "003";
    if (
      filters.srchKeyCode &&
      !["001", "002", "003"].includes(filters.srchKeyCode)
    )
      throw new Error("invalid-search-code");
  }
  let reservationError: unknown;
  let stopped = false;
  let calls = 0;
  const guardedFetch: typeof fetch = async (url, init) => {
    if (stopped) throw new Error("source-request-stopped");
    try {
      await beforeRequest();
    } catch (error) {
      stopped = true;
      reservationError = error;
      // Plain Error is deliberately not a retryable transport/timeout error.
      throw new Error("source-reservation-failed");
    }
    calls++;
    return fetcher(url, init);
  };
  const govEvidence: Capture[] = [];
  const bokjiEvidence: unknown[] = [];
  const gov =
    provider === "GOV24"
      ? new ProbeClient(
          key,
          budget,
          async (c) => {
            govEvidence.push(c);
          },
          guardedFetch,
        )
      : null;
  const bokji =
    provider !== "GOV24"
      ? new BokjiClient(
          key,
          provider,
          budget,
          async (c) => {
            bokjiEvidence.push(c);
          },
          guardedFetch,
        )
      : null;
  let busy = false;
  const guarded = async <T>(operation: () => Promise<T>): Promise<T> => {
    if (stopped) throw reservationError;
    if (busy) throw new Error("source-operation-in-progress");
    busy = true;
    try {
      return await operation();
    } catch (error) {
      throw stopped ? reservationError : error;
    } finally {
      govEvidence.length = 0;
      bokjiEvidence.length = 0;
      busy = false;
    }
  };
  const fresh = (page: SourcePage) => {
    const at = Date.parse(page.capturedAt);
    if (!Number.isFinite(at) || at > Date.now() || Date.now() - at > 600_000)
      throw new Error("collection-window-exceeded");
  };
  return {
    get calls() {
      return calls;
    },
    page(pageNo: number): Promise<SourcePage> {
      return guarded(async () => {
        if (!Number.isInteger(pageNo) || pageNo < 1 || pageNo > 1000)
          throw new Error("invalid-page");
        let rows: Row[],
          total: number,
          sourceTotal: number | null,
          xml: string | null = null;
        const capturedAt = new Date().toISOString();
        if (gov) {
          rows = await gov.request("serviceList", pageNo, perPage, filters);
          const capture = govEvidence.at(-1)!;
          if (
            capture.status !== 200 ||
            envelopeAnomalies(capture.body, pageNo, perPage).length
          )
            throw new Error("invalid-envelope");
          const body = capture.body as Row;
          total = count(body.matchCount);
          sourceTotal = count(body.totalCount);
          if (total > sourceTotal) throw new Error("invalid-count");
        } else {
          const response = await bokji!.request("list", {
            ...filters,
            pageNo: String(pageNo),
            numOfRows: String(perPage),
            ...(provider === "BOKJIRO_CENTRAL" ? { callTp: "L" } : {}),
          });
          xml = response.xml;
          const data = response.data;
          if (
            count(data.pageNo) !== pageNo ||
            count(data.numOfRows) !== perPage
          )
            throw new Error("invalid-envelope");
          total = count(data.totalCount);
          sourceTotal = null;
          const value = data.servList;
          const values =
            value == null || value === ""
              ? []
              : Array.isArray(value)
                ? value
                : [value];
          if (
            values.some((v) => !v || typeof v !== "object" || Array.isArray(v))
          )
            throw new Error("invalid-list");
          rows = values as Row[];
        }
        if (
          rows.length !==
          Math.min(perPage, Math.max(0, total - (pageNo - 1) * perPage))
        )
          throw new Error("incomplete-page");
        const ids = rows.map(
          (row) => row[provider === "GOV24" ? "서비스ID" : "servId"],
        );
        if (
          ids.some(
            (id) =>
              typeof id !== "string" ||
              !id.trim() ||
              (provider !== "GOV24" && !/^WLF[0-9]+$/.test(id)),
          ) ||
          new Set(ids).size !== ids.length
        )
          throw new Error("invalid-or-duplicate-id");
        return {
          page: pageNo,
          total,
          sourceTotal,
          rows,
          ids: ids as string[],
          capturedAt,
          xml,
          evidence: [...govEvidence, ...bokjiEvidence],
        };
      });
    },
    detail(page: SourcePage, id: string): Promise<Raw> {
      return guarded(async () => {
        fresh(page);
        const idField = provider === "GOV24" ? "서비스ID" : "servId";
        const matches = page.rows.filter((row) => row[idField] === id);
        if (!page.ids.includes(id) || matches.length !== 1)
          throw new Error("id-mismatch");
        const list = matches[0];
        if (gov) {
          const filters = { "cond[서비스ID::EQ]": id };
          const limits = { perPage, maxPages: 20 };
          const detail = await completePages(
            gov,
            govEvidence,
            "serviceDetail",
            filters,
            limits,
          );
          const conditions = await completePages(
            gov,
            govEvidence,
            "supportConditions",
            filters,
            limits,
          );
          if (detail.rows.length !== 1 || conditions.rows.length !== 1)
            throw new Error("unsupported-cardinality");
          if (
            typeof detail.rows[0]["서비스명"] !== "string" ||
            detail.rows[0]["서비스명"] !== list["서비스명"]
          )
            throw new Error("name-mismatch");
          fresh(page);
          return {
            externalId: id,
            apiVersion: "v3",
            list,
            detail: detail.rows,
            conditions: conditions.rows,
            evidence: [...(page.evidence as Capture[]), ...govEvidence],
          };
        }
        const detail = await bokji!.request("detail", {
          servId: id,
          ...(provider === "BOKJIRO_CENTRAL" ? { callTp: "D" } : {}),
        });
        if (detail.data.servId !== id) throw new Error("id-mismatch");
        if (
          typeof detail.data.servNm !== "string" ||
          detail.data.servNm !== list.servNm
        )
          throw new Error("name-mismatch");
        if (page.xml === null) throw new Error("missing-list-xml");
        fresh(page);
        return {
          provider: provider as BokjiProvider,
          apiVersion: "v1",
          externalId: id,
          list,
          detail: [detail.data],
          xml: { list: page.xml, detail: detail.xml },
          evidence: [...page.evidence, ...bokjiEvidence],
        };
      });
    },
  };
}
