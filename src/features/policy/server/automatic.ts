import { randomUUID } from "node:crypto";
import { createAutomaticSource } from "./automatic-source.ts";
import type { Provider, SourcePage, Raw } from "./automatic-source.ts";
import { normalizeBundle } from "./normalize.ts";
import type { NormalizedBundle } from "./normalize.ts";
import { normalizeBokji } from "./bokjiro.ts";
import type { BokjiRaw } from "./bokjiro.ts";
import { modificationHold } from "./sync.ts";
import { evaluatePolicyQuality, failureQuality } from "./quality.ts";
import { evaluateCollectionRelevance } from "./collection-relevance.ts";
import type { PolicyRepository } from "./repository.ts";

type Reason =
  | "CALL_BUDGET"
  | "DAILY_BUDGET"
  | "ITEM_LIMIT"
  | "PAGE_LIMIT"
  | "UPSTREAM_ERROR"
  | "SOURCE_DRIFT";
type Normalized = NormalizedBundle | ReturnType<typeof normalizeBokji>;
type Current = { raw: Raw; normalized: Normalized; snapshotId: string };
type State = {
  run: { status: string; calls: number };
  job: {
    config: unknown;
    next_page: number;
    expected_total: number | null;
    discovery_complete: boolean;
  };
  page: SourcePage | null;
  pendingIds: string[];
};
class Stop extends Error {
  reason: Reason;
  constructor(reason: Reason) {
    super(reason);
    this.reason = reason;
  }
}
class StorageFailure extends Error {
  constructor(cause: unknown) {
    super("automatic-storage-failed", { cause });
  }
}
export type AutomaticOptions = {
  /** Omitted only for backwards-compatible refresh runs. CLI defaults to new-only. */
  mode?: "new-only" | "refresh";
  provider: Provider;
  filters: Record<string, string>;
  perPage: number;
  maxPages: number;
  dailyLimit: number;
  callBudget: number;
  key: string;
  repository: PolicyRepository;
  resumeRunId?: string;
  fetcher?: typeof fetch;
  maxItems?: number;
  sourceFactory?: typeof createAutomaticSource;
  onStarted?: (runId: string) => Promise<void>;
};

// Keep the same calendar/date regression hold as the selected Bokjiro collector.
function bokjiHold(current: BokjiRaw | undefined, next: BokjiRaw): boolean {
  const local = next.provider === "BOKJIRO_LOCAL";
  const valid = (value: unknown): value is string => {
    if (typeof value !== "string") return false;
    if (!local) return /^[1-9][0-9]{3}$/.test(value);
    if (!/^[1-9][0-9]{7}$/.test(value)) return false;
    const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    const time = Date.parse(`${date}T00:00:00Z`);
    return (
      Number.isFinite(time) &&
      new Date(time).toISOString().slice(0, 10) === date
    );
  };
  for (const part of local
    ? (["list", "detail"] as const)
    : (["detail"] as const)) {
    const field = local ? "lastModYmd" : "crtrYr";
    const newer = (part === "list" ? next.list : next.detail[0])[field];
    const older =
      current && (part === "list" ? current.list : current.detail[0])[field];
    if (!valid(newer) || (current && (!valid(older) || newer < older)))
      return true;
  }
  return false;
}

export async function runAutomatic(options: AutomaticOptions) {
  if (
    options.mode !== undefined &&
    !["new-only", "refresh"].includes(options.mode)
  )
    throw new Error("invalid-automatic-mode");
  for (const [value, max] of [
    [options.callBudget, 100],
    [options.perPage, 100],
    [options.maxPages, 1000],
    [options.dailyLimit, 100000],
    [options.maxItems ?? 1, 10000],
  ]) {
    if (!Number.isInteger(value) || value < 1 || value > max)
      throw new Error("invalid-automatic-limits");
  }
  const { provider } = options;
  let calls = 0,
    processed = 0;
  const command = async <T>(
    action: string,
    payload: Record<string, unknown> = {},
  ): Promise<T> => {
    try {
      return await options.repository.command<T>(action, {
        ...payload,
        provider,
      });
    } catch (error) {
      throw new StorageFailure(error);
    }
  };
  const beforeRequest = async () => {
    if (calls >= options.callBudget) throw new Stop("CALL_BUDGET");
    const reservation = await command<{ allowed: boolean }>(
      "auto_reserve",
      fence,
    );
    if (!reservation.allowed) throw new Stop("DAILY_BUDGET");
    calls++;
  };
  // Construct first so invalid provider/filter/key input cannot acquire a lease.
  const source = (options.sourceFactory ?? createAutomaticSource)(
    { provider, filters: options.filters, perPage: options.perPage },
    options.key,
    options.callBudget,
    beforeRequest,
    options.fetcher,
  );
  const start = await command<{
    runId: string;
    generation: number;
    status: string;
  }>("auto_start", {
    runId: randomUUID(),
    config: {
      filters: options.filters,
      perPage: options.perPage,
      maxPages: options.maxPages,
      dailyLimit: options.dailyLimit,
      ...(options.mode === undefined ? {} : { mode: options.mode }),
    },
    resumeRunId: options.resumeRunId ?? null,
  });
  const runId = start.runId;
  if (start.status === "SKIPPED")
    return { runId, status: "SKIPPED", calls, processed };
  const fence = { runId, generation: start.generation };
  await options.onStarted?.(runId);
  const freshPages = new Map<number, SourcePage>();
  const fetchPage = async (number: number) => {
    if (calls >= options.callBudget) throw new Stop("CALL_BUDGET");
    try {
      return await source.page(number);
    } catch (error) {
      if (error instanceof Stop || error instanceof StorageFailure) throw error;
      throw new Stop(
        calls >= options.callBudget ? "CALL_BUDGET" : "UPSTREAM_ERROR",
      );
    }
  };
  try {
    for (;;) {
      const state = await command<State>("auto_state", fence);
      if (!state.page && state.job.discovery_complete) {
        const result = await command<{ status: string }>("finish", {
          ...fence,
          calls: 0,
        });
        return { runId, status: result.status, calls, processed };
      }
      if (options.maxItems !== undefined && processed >= options.maxItems)
        throw new Stop("ITEM_LIMIT");
      if (!state.page) {
        if (state.job.next_page > options.maxPages)
          throw new Stop("PAGE_LIMIT");
        const page = await fetchPage(state.job.next_page);
        if (
          state.job.expected_total !== null &&
          page.total !== state.job.expected_total
        )
          throw new Stop("SOURCE_DRIFT");
        await command("auto_page", { ...fence, page });
        freshPages.set(page.page, page);
        continue;
      }
      let page = freshPages.get(state.page.page) ?? state.page;
      let failed = false;
      for (const id of state.pendingIds) {
        if (options.maxItems !== undefined && processed >= options.maxItems)
          throw new Stop("ITEM_LIMIT");
        const age = Date.now() - Date.parse(page.capturedAt);
        if (
          !freshPages.has(page.page) ||
          !Number.isFinite(age) ||
          age < 0 ||
          age > 600000
        ) {
          const refreshed = await fetchPage(page.page);
          if (
            refreshed.total !== page.total ||
            refreshed.sourceTotal !== page.sourceTotal ||
            JSON.stringify(refreshed.ids) !== JSON.stringify(page.ids)
          )
            throw new Stop("SOURCE_DRIFT");
          await command("auto_refresh", { ...fence, page: refreshed });
          page = refreshed;
          freshPages.set(page.page, page);
        }
        await command("heartbeat", fence);
        const current = await command<Current | null>("current", {
          externalId: id,
        });
        if (current && options.mode === "new-only") {
          await command("auto_skip_existing", {
            ...fence,
            externalId: id,
            page: page.page,
          });
          processed++;
          continue;
        }
        let raw: Raw, normalized: Normalized;
        if (calls >= options.callBudget) throw new Stop("CALL_BUDGET");
        try {
          raw = await source.detail(page, id);
          normalized =
            raw.apiVersion === "v3"
              ? normalizeBundle(raw)
              : normalizeBokji(raw);
        } catch (error) {
          if (error instanceof Stop || error instanceof StorageFailure)
            throw error;
          if (calls >= options.callBudget) throw new Stop("CALL_BUDGET");
          const code = "COLLECTION_OR_NORMALIZATION_FAILED";
          await command("fail", {
            ...fence,
            externalId: id,
            errorCode: code,
            evidence: page.evidence,
            quality: failureQuality(code),
          });
          processed++;
          failed = true;
          continue;
        }
        const quality = evaluatePolicyQuality(
          raw,
          normalized,
          current?.normalized,
        );
        const saved = await command<{ snapshotId: string }>("snapshot", {
          ...fence,
          externalId: id,
          raw,
          rawHash: normalized.rawHash,
          hashVersion: normalized.hashVersion,
          evidence: raw.evidence,
        });
        if (quality.status === "ERROR") {
          await command("fail", {
            ...fence,
            externalId: id,
            errorCode: "QUALITY_ASSESSMENT_FAILED",
            normalized,
            evidence: raw.evidence,
            quality,
          });
          processed++;
          failed = true;
          continue;
        }
        const hold =
          raw.apiVersion === "v3"
            ? modificationHold(
                (current?.normalized as NormalizedBundle) ?? null,
                normalized as NormalizedBundle,
              )
            : bokjiHold(current?.raw as BokjiRaw | undefined, raw)
              ? "unverified-or-regressed-source-date"
              : null;
        if (hold) {
          await command("fail", {
            ...fence,
            externalId: id,
            errorCode: hold,
            evidence: raw.evidence,
            quality: failureQuality(hold),
          });
          failed = true;
        } else {
          const relevance = evaluateCollectionRelevance(normalized.display);
          if (!current && relevance.status === "UNRELATED") {
            await command("auto_exclude", {
              ...fence,
              externalId: id,
              relevance,
              phase: "DETAIL",
              snapshotId: saved.snapshotId,
              normalized,
            });
            processed++;
            continue;
          }
          await command("apply", {
            ...fence,
            externalId: id,
            snapshotId: saved.snapshotId,
            normalized,
            quality,
            relevance,
            changes: {
              rawChanged: current?.normalized.rawHash !== normalized.rawHash,
              displayChanged:
                current?.normalized.displayHash !== normalized.displayHash,
              conditionsChanged:
                current?.normalized.conditionsHash !==
                normalized.conditionsHash,
            },
          });
        }
        processed++;
      }
      if (failed) throw new Stop("UPSTREAM_ERROR");
      freshPages.delete(page.page);
    }
  } catch (error) {
    // Storage/lease failures stop immediately; they must never be written as source failures.
    if (!(error instanceof Stop)) throw error;
    await command("auto_pause", { ...fence, reason: error.reason });
    return { runId, status: "PAUSED", reason: error.reason, calls, processed };
  }
}
