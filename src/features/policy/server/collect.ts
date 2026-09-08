import { ProbeClient, envelopeAnomalies, rowsOf } from "./gov24/probe.ts";
import type { Capture, Endpoint, Row } from "./gov24/probe.ts";
import type { RawBundle } from "./normalize.ts";

export type Selection = {
  id: string;
  reason: string;
  filters: Record<string, string>;
};
export type CollectionOptions = { perPage: number; maxPages: number };
export class CollectionError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

/** A terminal empty page is necessary, but never sufficient, for completion. */
export async function completePages(
  client: ProbeClient,
  captures: Capture[],
  endpoint: Endpoint,
  filters: Record<string, string>,
  options: CollectionOptions,
): Promise<{ rows: Row[]; evidence: Capture[] }> {
  if (
    !Number.isInteger(options.maxPages) ||
    options.maxPages < 1 ||
    options.maxPages > 20 ||
    !Number.isInteger(options.perPage) ||
    options.perPage < 1 ||
    options.perPage > 100
  )
    throw new CollectionError("invalid-page-options");
  const rows: Row[] = [],
    evidence: Capture[] = [];
  const ids = new Set<string>();
  let expected: number | undefined, total: number | undefined;
  for (let page = 1; page <= options.maxPages; page++) {
    const before = captures.length;
    const part = await client.request(endpoint, page, options.perPage, filters);
    const attempts = captures.slice(before);
    evidence.push(...attempts);
    const capture = attempts.at(-1);
    if (
      !capture ||
      capture.status !== 200 ||
      envelopeAnomalies(capture.body, page, options.perPage).length
    )
      throw new CollectionError("invalid-envelope");
    const body = capture.body as Row;
    if (
      !rowsOf(body) ||
      part.length > options.perPage ||
      Number(body.matchCount) > Number(body.totalCount)
    )
      throw new CollectionError("invalid-count");
    if (expected === undefined) {
      expected = Number(body.matchCount);
      total = Number(body.totalCount);
    }
    if (body.matchCount !== expected || body.totalCount !== total)
      throw new CollectionError("count-changed-during-pagination");
    for (const row of part) {
      const id = row["서비스ID"];
      if (typeof id !== "string" || !id.trim() || ids.has(id))
        throw new CollectionError("invalid-or-duplicate-id");
      if (endpoint !== "serviceList" && id !== filters["cond[서비스ID::EQ]"])
        throw new CollectionError("id-mismatch");
      ids.add(id);
      rows.push(row);
    }
    if (rows.length > expected) throw new CollectionError("count-overflow");
    if (part.length === 0) {
      if (rows.length !== expected)
        throw new CollectionError("premature-empty-page");
      return { rows, evidence };
    }
  }
  throw new CollectionError("page-limit");
}

export function validateSelection(input: unknown): Selection[] {
  if (!Array.isArray(input) || input.length < 5 || input.length > 10)
    throw new CollectionError("select-5-to-10-policies");
  const ids = new Set<string>();
  for (const s of input) {
    if (
      !s ||
      typeof s.id !== "string" ||
      !s.id.trim() ||
      ids.has(s.id) ||
      typeof s.reason !== "string" ||
      !s.reason.trim() ||
      !s.filters ||
      Array.isArray(s.filters) ||
      typeof s.filters !== "object" ||
      typeof s.filters["cond[서비스명::LIKE]"] !== "string"
    )
      throw new CollectionError("invalid-selection");
    ids.add(s.id);
  }
  return input as Selection[];
}

export async function collectSelection(
  client: ProbeClient,
  captures: Capture[],
  selected: Selection[],
  options: CollectionOptions,
  consume: (
    selection: Selection,
    bundle: RawBundle | null,
    error: string | null,
  ) => Promise<void>,
  completedIds: Set<string> = new Set(),
) {
  validateSelection(selected);
  const groups = new Map<string, Selection[]>();
  for (const s of selected) {
    if (completedIds.has(s.id)) continue;
    const key = JSON.stringify(
      Object.entries(s.filters).sort(([a], [b]) => a.localeCompare(b)),
    );
    groups.set(key, [...(groups.get(key) ?? []), s]);
  }
  for (const group of groups.values()) {
    let listing: Awaited<ReturnType<typeof completePages>>;
    try {
      listing = await completePages(
        client,
        captures,
        "serviceList",
        group[0].filters,
        options,
      );
    } catch (error) {
      for (const selection of group)
        await consume(
          selection,
          null,
          error instanceof CollectionError ? error.code : "list-request-failed",
        );
      if (client.blocked || client.calls >= client.budget)
        throw new CollectionError("run-stopped");
      continue;
    }
    for (const selection of group) {
      let bundle: RawBundle;
      try {
        const list = listing.rows.find(
          (row) => row["서비스ID"] === selection.id,
        );
        if (!list) throw new CollectionError("selected-id-not-found");
        const filters = { "cond[서비스ID::EQ]": selection.id };
        const detail = await completePages(
          client,
          captures,
          "serviceDetail",
          filters,
          options,
        );
        const conditions = await completePages(
          client,
          captures,
          "supportConditions",
          filters,
          options,
        );
        if (detail.rows.length !== 1 || conditions.rows.length !== 1)
          throw new CollectionError("unsupported-cardinality");
        const evidence = [
          ...listing.evidence,
          ...detail.evidence,
          ...conditions.evidence,
        ];
        const times = evidence.map((e) => Date.parse(e.at));
        if (
          times.some((t) => !Number.isFinite(t)) ||
          Math.max(...times) - Math.min(...times) > 600_000
        )
          throw new CollectionError("collection-window-exceeded");
        bundle = {
          externalId: selection.id,
          apiVersion: "v3",
          list,
          detail: detail.rows,
          conditions: conditions.rows,
          evidence,
        };
      } catch (error) {
        await consume(
          selection,
          null,
          error instanceof CollectionError
            ? error.code
            : "policy-request-failed",
        );
        if (client.blocked || client.calls >= client.budget)
          throw new CollectionError("run-stopped");
        continue;
      }
      // Persistence failures must propagate, never be mistaken for upstream errors.
      await consume(selection, bundle, null);
    }
  }
}
