import { randomUUID } from "node:crypto";
import { collectSelection, validateSelection } from "./collect.ts";
import type { CollectionOptions, Selection } from "./collect.ts";
import { ProbeClient, decodeKey } from "./gov24/probe.ts";
import type { Capture } from "./gov24/probe.ts";
import { normalizeBundle, compareNormalized } from "./normalize.ts";
import type { RawBundle, NormalizedBundle } from "./normalize.ts";
import type { PolicyRepository, CurrentPolicy } from "./repository.ts";

export type SyncOptions = CollectionOptions & {
  selected: Selection[];
  budget: number;
  key?: string;
  dryRun: boolean;
  resumeRunId?: string;
  trigger: "manual" | "scheduled" | "reprocess";
  repository: PolicyRepository;
  fetcher?: typeof fetch;
  capture?: (capture: Capture) => Promise<void>;
};
export type SyncItemResult = {
  id: string;
  status: "SUCCESS" | "FAILED";
  error?: string;
  changes?: ReturnType<typeof compareNormalized>;
  warnings?: string[];
};

export function modificationHold(
  current: NormalizedBundle | null,
  next: NormalizedBundle,
): string | null {
  for (const endpoint of ["list", "detail"] as const) {
    const newer = next.modified[endpoint],
      older = current?.modified[endpoint];
    if (
      newer.status !== "valid" ||
      (older && (older.status !== "valid" || older.format !== newer.format))
    )
      return "unverified-modification-time";
    if (
      older &&
      typeof older.raw === "string" &&
      typeof newer.raw === "string" &&
      newer.raw < older.raw
    )
      return "modification-time-regressed";
  }
  return null;
}

export async function syncPolicies(options: SyncOptions) {
  const { repository, selected, dryRun } = options;
  validateSelection(selected);
  if (options.trigger !== "reprocess" && !options.key?.trim())
    throw new Error("missing-gov24-api-key");
  if (options.key) decodeKey(options.key);
  if (
    !Number.isInteger(options.budget) ||
    options.budget < 1 ||
    options.budget > 200 ||
    !Number.isInteger(options.perPage) ||
    options.perPage < 1 ||
    options.perPage > 100 ||
    !Number.isInteger(options.maxPages) ||
    options.maxPages < 1 ||
    options.maxPages > 20
  )
    throw new Error("invalid-collection-limits");
  let runId: string = randomUUID();
  let generation = 0;
  let completedIds: string[] = [];
  if (!dryRun) {
    const start = await repository.command<{
      runId: string;
      generation: number;
      status: string;
      completedIds: string[];
    }>("start", {
      runId,
      trigger: options.trigger,
      scope: selected,
      resumeRunId: options.resumeRunId ?? null,
    });
    runId = start.runId;
    generation = start.generation;
    if (start.status === "SKIPPED")
      return { runId, status: "SKIPPED", dryRun, calls: 0, items: [] };
    completedIds = start.completedIds;
  }
  const fence = { runId, generation };
  const heartbeat = async () => {
    if (!dryRun) await repository.command("heartbeat", fence);
  };
  const captures: Capture[] = [],
    items: SyncItemResult[] = [];
  const client =
    options.trigger === "reprocess"
      ? null
      : new ProbeClient(
          options.key ?? "",
          options.budget,
          async (c) => {
            captures.push(c);
            await options.capture?.(c);
          },
          async (url, init) => {
            await heartbeat();
            return (options.fetcher ?? fetch)(url, init);
          },
        );
  const fail = async (
    selection: Selection,
    errorCode: string,
    evidence: Capture[],
  ) => {
    if (!dryRun)
      await repository.command("fail", {
        ...fence,
        externalId: selection.id,
        errorCode,
        evidence,
      });
    items.push({ id: selection.id, status: "FAILED", error: errorCode });
  };
  const consume = async (
    selection: Selection,
    bundle: RawBundle | null,
    error: string | null,
  ) => {
    if (completedIds.includes(selection.id)) return;
    await heartbeat();
    if (!bundle) {
      await fail(selection, error ?? "collection-failed", captures);
      return;
    }
    let normalized: NormalizedBundle;
    try {
      normalized = normalizeBundle(bundle);
    } catch {
      await fail(selection, "normalization-failed", bundle.evidence);
      return;
    }
    const current = await repository.command<CurrentPolicy | null>("current", {
      externalId: selection.id,
    });
    let snapshotId: string | undefined;
    try {
      if (!dryRun) {
        const saved = await repository.command<{ snapshotId: string }>(
          "snapshot",
          {
            ...fence,
            externalId: selection.id,
            raw: bundle,
            rawHash: normalized.rawHash,
            hashVersion: normalized.hashVersion,
            evidence: bundle.evidence,
          },
        );
        snapshotId = saved.snapshotId;
      }
    } catch {
      await fail(selection, "snapshot-save-failed", bundle.evidence);
      return;
    }
    const hold = modificationHold(current?.normalized ?? null, normalized);
    if (hold) {
      await fail(selection, hold, bundle.evidence);
      return;
    }
    const changes = compareNormalized(current?.normalized ?? null, normalized);
    try {
      if (!dryRun)
        await repository.command("apply", {
          ...fence,
          externalId: selection.id,
          snapshotId,
          normalized,
          changes,
        });
    } catch {
      await fail(selection, "policy-apply-failed", bundle.evidence);
      return;
    }
    items.push({
      id: selection.id,
      status: "SUCCESS",
      changes,
      warnings: normalized.warnings,
    });
  };
  let runError: string | null = null;
  try {
    if (options.trigger === "reprocess") {
      for (const selection of selected) {
        if (completedIds.includes(selection.id)) continue;
        const current = await repository.command<CurrentPolicy | null>(
          "current",
          { externalId: selection.id },
        );
        await consume(
          selection,
          current?.raw ?? null,
          "stored-snapshot-not-found",
        );
      }
    } else {
      // Keep the full validated selection for scope, but remove completed IDs from HTTP work.
      const pending = selected.filter((s) => !completedIds.includes(s.id));
      if (pending.length) {
        await collectSelection(
          client!,
          captures,
          selected,
          options,
          consume,
          new Set(completedIds),
        );
      }
    }
  } catch {
    runError = "run-interrupted-see-items";
  }
  const calls = client?.calls ?? 0;
  const success = items.filter((i) => i.status === "SUCCESS").length;
  if (!dryRun) {
    // If lease ownership was lost, this rejects and leaves recovery to a new owner.
    const finish = await repository.command<{
      status: string;
      success: number;
      failed: number;
      pending: number;
    }>("finish", { ...fence, calls, errorCode: runError });
    return { runId, dryRun, calls, ...finish, items };
  }
  const status =
    !runError && success === selected.length
      ? "SUCCESS"
      : success
        ? "PARTIAL"
        : "FAILED";
  return { dryRun, status, calls, items, error: runError };
}
