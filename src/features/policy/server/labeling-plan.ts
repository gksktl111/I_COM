import { isDeepStrictEqual } from "node:util";
export type ReviewItem = {
  sourceId: string;
  snapshotId: string;
  normalized: Record<string, unknown>;
  reviewer: string;
  reason: string;
  assessment: { version: string; [key: string]: unknown };
};
export type ReviewBundle = { reviewRun: string; items: ReviewItem[] };
export type ReviewPlan = {
  bundleHash: string;
  reviewRun: string;
  entries: Record<
    string,
    { observationId: number; expectedReviewId: number | null }
  >;
};
export function prepareReviewPlan(
  bundle: ReviewBundle,
  bundleHash: string,
  active: Array<{
    source_id: string;
    applied_snapshot_id: string;
    normalized: Record<string, unknown>;
  }>,
  labels: Array<{
    source_id: string;
    observation_id: number;
    review_id: number | null;
    snapshot_id: string;
    normalizer_version: string;
    display_hash: string;
    evaluator_version: string;
  }>,
  existing?: ReviewPlan,
): ReviewPlan {
  if (
    existing &&
    (existing.bundleHash !== bundleHash ||
      existing.reviewRun !== bundle.reviewRun)
  )
    throw Error("review-plan-conflict");
  const policies = new Map(active.map((p) => [p.source_id, p]));
  const current = new Map(labels.map((p) => [p.source_id, p]));
  const entries: ReviewPlan["entries"] = {};
  for (const item of bundle.items) {
    if (entries[item.sourceId]) throw Error("duplicate-review-source");
    const policy = policies.get(item.sourceId),
      label = current.get(item.sourceId);
    if (
      !policy ||
      !label ||
      policy.applied_snapshot_id !== item.snapshotId ||
      !isDeepStrictEqual(policy.normalized, item.normalized) ||
      label.snapshot_id !== item.snapshotId ||
      label.normalizer_version !== item.normalized.normalizerVersion ||
      label.display_hash !== item.normalized.displayHash ||
      label.evaluator_version !== item.assessment.version
    )
      throw Error("stale-review-source");
    const previous = existing?.entries[item.sourceId];
    if (
      existing &&
      (!previous || previous.observationId !== label.observation_id)
    )
      throw Error("stale-review-plan");
    // Freeze the first expected revision. A retry cannot silently adopt another reviewer's change.
    entries[item.sourceId] = previous ?? {
      observationId: label.observation_id,
      expectedReviewId: label.review_id,
    };
  }
  return existing ?? { bundleHash, reviewRun: bundle.reviewRun, entries };
}
