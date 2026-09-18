import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareReviewPlan } from "./labeling-plan.ts";
const normalized = {
  normalizerVersion: "normalizer-1",
  displayHash: "hash-1",
  display: { name: "아동 보육료" },
};
const bundle = {
  reviewRun: "first-review",
  items: [
    {
      sourceId: "source",
      snapshotId: "snapshot",
      normalized,
      reviewer: "reviewer",
      reason: "checked",
      assessment: { version: "taxonomy-2/rules-1", status: "VERIFIED" },
    },
  ],
};
const active = [
  { source_id: "source", applied_snapshot_id: "snapshot", normalized },
];
const labels = [
  {
    source_id: "source",
    observation_id: 1,
    review_id: null,
    snapshot_id: "snapshot",
    normalizer_version: "normalizer-1",
    display_hash: "hash-1",
    evaluator_version: "taxonomy-2/rules-1",
  },
];
test("review plan rejects source and taxonomy changes instead of rebinding old reviews", () => {
  assert.throws(
    () =>
      prepareReviewPlan(bundle, "hash", active, [
        { ...labels[0], evaluator_version: "taxonomy-3/rules-1" },
      ]),
    /stale-review-source/,
  );
  assert.throws(
    () =>
      prepareReviewPlan(bundle, "hash", active, [
        { ...labels[0], snapshot_id: "new-snapshot" },
      ]),
    /stale-review-source/,
  );
  assert.throws(
    () =>
      prepareReviewPlan(bundle, "hash", active, [
        { ...labels[0], normalizer_version: "new-normalizer" },
      ]),
    /stale-review-source/,
  );
  assert.throws(
    () =>
      prepareReviewPlan(
        bundle,
        "hash",
        [
          {
            ...active[0],
            normalized: { ...normalized, display: { name: "changed" } },
          },
        ],
        labels,
      ),
    /stale-review-source/,
  );
});
test("retry preserves the initial expected review revision and rejects changed input", () => {
  const plan = prepareReviewPlan(bundle, "hash", active, labels);
  const retry = prepareReviewPlan(
    bundle,
    "hash",
    active,
    [{ ...labels[0], review_id: 42 }],
    plan,
  );
  assert.equal(retry.entries.source.expectedReviewId, null);
  assert.throws(
    () => prepareReviewPlan(bundle, "different-bundle", active, labels, plan),
    /review-plan-conflict/,
  );
  assert.throws(
    () =>
      prepareReviewPlan(
        bundle,
        "hash",
        active,
        [{ ...labels[0], observation_id: 2 }],
        plan,
      ),
    /stale-review-plan/,
  );
});
