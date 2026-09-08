import { evaluatePolicyQuality, failureQuality } from "./quality.ts";
import { randomUUID } from "node:crypto";
import { BokjiClient, normalizeBokji } from "./bokjiro.ts";
import type { BokjiProvider, BokjiRaw } from "./bokjiro.ts";
import type { PolicyRepository } from "./repository.ts";

type Row = Record<string, unknown>;
export type BokjiSelection = {
  id: string;
  reason: string;
  filters: Record<string, string>;
};
type Current = {
  snapshotId: string;
  raw: BokjiRaw;
  normalized: ReturnType<typeof normalizeBokji>;
};
export function validateBokjiSelection(value: unknown): BokjiSelection[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10)
    throw new Error("invalid-selection");
  const ids = new Set<string>();
  for (const item of value) {
    if (
      !item ||
      typeof item.id !== "string" ||
      !/^WLF[0-9]+$/.test(item.id) ||
      ids.has(item.id) ||
      typeof item.reason !== "string" ||
      !item.reason.trim() ||
      !item.filters ||
      Array.isArray(item.filters) ||
      typeof item.filters !== "object" ||
      Object.values(item.filters).some((v) => typeof v !== "string") ||
      Object.keys(item.filters).some(
        (k) => !["searchWrd", "srchKeyCode", "ctpvNm", "sggNm"].includes(k),
      )
    )
      throw new Error("invalid-selection");
    ids.add(item.id);
  }
  return value;
}
function count(value: unknown): number {
  if (
    typeof value !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(value) ||
    !Number.isSafeInteger(Number(value))
  )
    throw new Error("invalid-count");
  return Number(value);
}
function rows(value: unknown): Row[] {
  if (value == null || value === "") return [];
  const result = Array.isArray(value) ? value : [value];
  if (result.some((x) => !x || typeof x !== "object" || Array.isArray(x)))
    throw new Error("invalid-list");
  return result as Row[];
}
function modificationHold(
  current: BokjiRaw | undefined,
  next: BokjiRaw,
): boolean {
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
    const newer = (part === "list" ? next.list : next.detail[0])[
      local ? "lastModYmd" : "crtrYr"
    ];
    const older =
      current &&
      (part === "list" ? current.list : current.detail[0])[
        local ? "lastModYmd" : "crtrYr"
      ];
    if (!valid(newer) || (current && (!valid(older) || newer < older)))
      return true;
  }
  return false;
}
export async function syncBokjiro(options: {
  provider: BokjiProvider;
  selected: BokjiSelection[];
  key?: string;
  repository: PolicyRepository;
  dryRun: boolean;
  trigger: "manual" | "reprocess";
  resumeRunId?: string;
  budget?: number;
  perPage?: number;
  maxPages?: number;
  fetcher?: typeof fetch;
  capture?: ConstructorParameters<typeof BokjiClient>[3];
}) {
  const selected = validateBokjiSelection(options.selected);
  const perPage = options.perPage ?? 50,
    maxPages = options.maxPages ?? 10;
  if (
    !Number.isInteger(perPage) ||
    perPage < 1 ||
    perPage > 100 ||
    !Number.isInteger(maxPages) ||
    maxPages < 1 ||
    maxPages > 20
  )
    throw new Error("invalid-limits");
  const provider = options.provider,
    dry = options.dryRun;
  if (!["BOKJIRO_CENTRAL", "BOKJIRO_LOCAL"].includes(provider))
    throw new Error("invalid-provider");
  const evidence: unknown[] = [];
  let fence:
    | { provider: BokjiProvider; runId: string; generation: number }
    | undefined;
  const command = <T>(action: string, payload: Row = {}) =>
    options.repository.command<T>(action, { provider, ...payload });
  const heartbeat = async () => {
    if (fence) await command("heartbeat", fence);
  };
  const client =
    options.trigger === "reprocess"
      ? null
      : new BokjiClient(
          options.key ?? "",
          provider,
          options.budget ?? 40,
          async (capture) => {
            evidence.push(capture);
            await options.capture?.(capture);
          },
          async (url, init) => {
            await heartbeat();
            return (options.fetcher ?? fetch)(url, init);
          },
        );
  let completedIds: string[] = [];
  if (!dry) {
    const lease = await command<{
      runId: string;
      generation: number;
      status: string;
      completedIds: string[];
    }>("start", {
      runId: randomUUID(),
      trigger: options.trigger,
      scope: selected,
      resumeRunId: options.resumeRunId ?? null,
    });
    if (lease.status === "SKIPPED")
      return { provider, ...lease, calls: 0, items: [] };
    fence = { provider, runId: lease.runId, generation: lease.generation };
    completedIds = lease.completedIds;
  }
  const pending = selected.filter((s) => !completedIds.includes(s.id));
  const items: { id: string; status: string; error?: string; changes?: Row }[] =
    [];
  let runError: string | null = null;
  const fail = async (id: string, error: string) => {
    if (!dry)
      await command("fail", {
        ...fence,
        externalId: id,
        errorCode: error,
        evidence,
        quality: failureQuality(error),
      });
    items.push({ id, status: "FAILED", error });
  };
  try {
    const discovered = new Map<string, { row: Row; xml: string; at: number }>();
    if (client) {
      const groups = new Map<string, BokjiSelection[]>();
      for (const s of pending) {
        const key = JSON.stringify(Object.entries(s.filters).sort());
        groups.set(key, [...(groups.get(key) ?? []), s]);
      }
      for (const group of groups.values()) {
        let total: number | undefined,
          seen = 0,
          terminal = false;
        const ids = new Set<string>(),
          started = Date.now();
        for (let page = 1; page <= maxPages; page++) {
          const response = await client.request("list", {
            ...group[0].filters,
            pageNo: String(page),
            numOfRows: String(perPage),
            ...(provider === "BOKJIRO_CENTRAL" ? { callTp: "L" } : {}),
          });
          const data = response.data,
            batch = rows(data.servList),
            expected = count(data.totalCount);
          if (
            count(data.pageNo) !== page ||
            count(data.numOfRows) !== perPage ||
            batch.length > perPage ||
            (total !== undefined && total !== expected)
          )
            throw new Error("incomplete-list");
          total = expected;
          for (const row of batch) {
            if (typeof row.servId !== "string" || ids.has(row.servId))
              throw new Error("duplicate-or-missing-id");
            ids.add(row.servId);
            if (group.some((s) => s.id === row.servId))
              discovered.set(row.servId, {
                row,
                xml: response.xml,
                at: started,
              });
          }
          seen += batch.length;
          if (seen > total || (!batch.length && seen !== total))
            throw new Error("incomplete-list");
          if (!batch.length) {
            terminal = true;
            break;
          }
        }
        if (!terminal) throw new Error("page-limit");
      }
    }
    for (const selection of pending) {
      await heartbeat();
      const current = await command<Current | null>("current", {
        externalId: selection.id,
      });
      let raw: BokjiRaw;
      try {
        if (client) {
          const found = discovered.get(selection.id);
          if (!found) throw new Error("selected-id-not-found");
          const detail = await client.request("detail", {
            servId: selection.id,
            ...(provider === "BOKJIRO_CENTRAL" ? { callTp: "D" } : {}),
          });
          if (Date.now() - found.at > 600000)
            throw new Error("capture-window-exceeded");
          raw = {
            provider,
            apiVersion: "v1",
            externalId: selection.id,
            list: found.row,
            detail: [detail.data],
            xml: { list: found.xml, detail: detail.xml },
            evidence: [...evidence],
          };
        } else {
          if (!current) throw new Error("stored-snapshot-not-found");
          raw = current.raw;
        }
        const normalized = normalizeBokji(raw);
        const changes = {
          rawChanged: current?.normalized.rawHash !== normalized.rawHash,
          displayChanged:
            current?.normalized.displayHash !== normalized.displayHash,
          conditionsChanged:
            current?.normalized.conditionsHash !== normalized.conditionsHash,
        };
        let snapshotId: string | undefined;
        if (!dry)
          snapshotId = (
            await command<{ snapshotId: string }>("snapshot", {
              ...fence,
              externalId: selection.id,
              raw,
              rawHash: normalized.rawHash,
              hashVersion: normalized.hashVersion,
              evidence: raw.evidence,
            })
          ).snapshotId;
        if (modificationHold(current?.raw, raw)) {
          await fail(selection.id, "unverified-or-regressed-source-date");
          continue;
        }
        const quality = evaluatePolicyQuality(
          raw,
          normalized,
          current?.normalized,
        );
        if (quality.status === "ERROR") {
          if (!dry)
            await command("fail", {
              ...fence,
              externalId: selection.id,
              errorCode: "quality-check-failed",
              evidence: raw.evidence,
              quality,
            });
          items.push({
            id: selection.id,
            status: "FAILED",
            error: "quality-check-failed",
          });
          continue;
        }
        if (!dry)
          await command("apply", {
            ...fence,
            externalId: selection.id,
            snapshotId,
            normalized,
            changes,
            quality,
          });
        items.push({ id: selection.id, status: "SUCCESS", changes });
      } catch {
        await fail(selection.id, "collection-normalization-or-storage-failed");
      }
    }
  } catch {
    runError = "run-interrupted-see-artifacts";
  }
  const calls = client?.calls ?? 0;
  if (!dry) {
    const result = await command<Row>("finish", {
      ...fence,
      calls,
      errorCode: runError,
    });
    return {
      provider,
      runId: fence!.runId,
      dryRun: dry,
      calls,
      ...result,
      items,
    };
  }
  const success = items.filter((i) => i.status === "SUCCESS").length;
  return {
    provider,
    dryRun: dry,
    calls,
    status:
      !runError && success === selected.length
        ? "SUCCESS"
        : success
          ? "PARTIAL"
          : "FAILED",
    items,
    error: runError,
  };
}
