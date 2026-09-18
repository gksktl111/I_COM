import assert from "node:assert/strict";
import test from "node:test";
import module from "node:module";
import type { RecommendationSource } from "./recommendation-sources.ts";
const { registerHooks } = module as unknown as {
  registerHooks(hooks: {
    resolve(
      specifier: string,
      context: unknown,
      next: (s: string, c: unknown) => unknown,
    ): unknown;
  }): { deregister(): void };
};
const hooks = registerHooks({
  resolve(s, c, next) {
    return s === "server-only"
      ? { url: "data:text/javascript,export {};", shortCircuit: true }
      : next(s, c);
  },
});
const {
  createReviewedCatalogLoader,
  educationRecommendationDraft,
  recommendationDraftDigest,
} = await import("./released-catalog.ts");
hooks.deregister();
const now = () => new Date("2026-09-11T00:00:00Z");
function draft() {
  const d = structuredClone(educationRecommendationDraft);
  const id = d.catalog.policies[0].id;
  // Simulated decision ONLY for testing loader behavior. Production registry stays empty.
  d.decisions = [
    {
      policyId: id,
      draftDigest: recommendationDraftDigest(d, id),
      reviewer: "TEST ONLY",
      evidenceRef: "test:decision",
      reviewedAt: "2026-09-10T00:00:00Z",
      validUntil: "2026-09-12T00:00:00Z",
      publication: "APPROVED",
      rules: "APPROVED",
      questions: "APPROVED",
    },
  ];
  return d;
}
function source(d = draft()): RecommendationSource {
  const id = d.catalog.policies[0].id;
  return {
    source: structuredClone(d.sourceVersions[id]),
    policy: {
      id,
      name: "TEST ONLY",
      summary: null,
      provider_name: null,
      purpose_text: null,
      target_text: null,
      criteria_text: null,
      benefit_text: null,
      application_method_text: null,
      application_period_text: null,
      required_documents_text: null,
      reception_text: null,
      contact_text: null,
      source_url: null,
      application_url: null,
      updated_at: null,
    },
  };
}
test("unreviewed real drafts never query or publish; matching reviewed version retains unresolved scope", async () => {
  const empty = await createReviewedCatalogLoader(
    educationRecommendationDraft,
    async () => {
      throw new Error("unexpected read");
    },
    now,
  )();
  assert.equal(empty.catalog.policies.length, 0);
  assert.deepEqual(empty.reviewedCategories, []);
  const d = draft();
  const out = await createReviewedCatalogLoader(
    d,
    async () => ({ items: [source(d)], nextOffset: null }),
    now,
  )();
  assert.equal(out.catalog.policies[0].release, "HUMAN");
  assert.equal(out.catalog.policies[0].completePaths, false);
  assert(out.catalog.policies[0].rules.every((r) => r.review === "HUMAN"));
  assert(
    out.catalog.policies[0].paths.every(
      (p) => !p.complete && p.availability === "UNKNOWN",
    ),
  );
  assert.equal(d.catalog.policies[0].release, "HIDDEN");
  assert.deepEqual(out.reviewedCategories, ["education"]);
});
test("all source bindings invalidate release, including a normalized-only change", async () => {
  const d = draft();
  const good = await createReviewedCatalogLoader(
    d,
    async () => ({ items: [source(d)], nextOffset: null }),
    now,
  )();
  for (const key of [
    "snapshotId",
    "normalizerVersion",
    "displayHash",
    "normalizedFingerprint",
  ] as const) {
    const changed = source(d);
    changed.source[key] += "changed";
    const out = await createReviewedCatalogLoader(
      d,
      async () => ({ items: [changed], nextOffset: null }),
      now,
    )();
    assert.equal(out.catalog.policies.length, 0, key);
    assert.deepEqual(out.reviewedCategories, ["education"]);
    assert.deepEqual(out.withheldByCategory, { education: 1 });
    assert.notEqual(out.catalog.version, good.catalog.version);
  }
});
test("expired decisions keep category switched; source read errors propagate", async () => {
  const d = draft();
  const out = await createReviewedCatalogLoader(
    d,
    async () => {
      throw new Error("unexpected read");
    },
    () => new Date("2026-09-12T00:00:00Z"),
  )();
  assert.deepEqual(out.reviewedCategories, ["education"]);
  assert.equal(out.catalog.policies.length, 0);
  assert.deepEqual(out.withheldByCategory, { education: 1 });
  await assert.rejects(
    createReviewedCatalogLoader(
      d,
      async () => {
        throw new Error("unavailable");
      },
      now,
    )(),
    /unavailable/,
  );
});
test("changing reviewed draft questions or rules invalidates decision; loader snapshots trusted input", async () => {
  const d = draft();
  d.catalog.questions[0].prompt += "changed";
  assert.throws(
    () => createReviewedCatalogLoader(d),
    /invalid-recommendation-review/,
  );
  const valid = draft(),
    current = source(valid);
  const read = createReviewedCatalogLoader(
    valid,
    async () => ({ items: [current], nextOffset: null }),
    now,
  );
  valid.catalog.policies[0].title = "tampered";
  valid.decisions = [];
  assert.notEqual((await read()).catalog.policies[0].title, "tampered");
});

test("v2 policy digest ignores unrelated catalog edits but binds related questions, transitive prerequisites and source", () => {
  const d = draft();
  const id = d.catalog.policies[0].id;
  const root = structuredClone(
    d.catalog.questions.find((q) =>
      d.catalog.policies[0].rules.some(
        (r) => JSON.stringify(r.fact) === JSON.stringify(q.fact),
      ),
    )!,
  );
  assert.ok(root);
  const prerequisite: typeof root = {
    ...structuredClone(root),
    id: "review-prerequisite",
    fact: { ...root.fact, attribute: "review.prerequisite" },
    prerequisites: [],
  };
  const ancestor = {
    ...structuredClone(prerequisite),
    id: "review-ancestor",
    fact: { ...root.fact, attribute: "review.ancestor" },
  };
  prerequisite.prerequisites = [
    { questionId: ancestor.id, equals: ancestor.options[0].value },
  ];
  root.prerequisites = [
    { questionId: prerequisite.id, equals: prerequisite.options[0].value },
  ];
  d.catalog.questions = [
    ...d.catalog.questions.filter((q) => q.id !== root.id),
    root,
    prerequisite,
    ancestor,
  ];
  const digest = recommendationDraftDigest(d, id);
  const unrelated = structuredClone(d);
  unrelated.catalog.version += "new unrelated draft";
  unrelated.catalog.policies[1].title += "unrelated edit";
  unrelated.catalog.policies.push({
    ...structuredClone(unrelated.catalog.policies[1]),
    id: "another-unrelated-policy",
  });
  unrelated.catalog.questions.push({
    ...structuredClone(ancestor),
    id: "unrelated-question",
    fact: { ...ancestor.fact, attribute: "unrelated.fact" },
  });
  unrelated.catalog.questions.reverse();
  assert.equal(recommendationDraftDigest(unrelated, id), digest);
  for (const changedId of [root.id, prerequisite.id, ancestor.id]) {
    const changed = structuredClone(d);
    changed.catalog.questions.find((q) => q.id === changedId)!.prompt +=
      " changed";
    assert.notEqual(recommendationDraftDigest(changed, id), digest);
  }
  const changedSource = structuredClone(d);
  changedSource.sourceVersions[id].snapshotId += "changed";
  assert.notEqual(recommendationDraftDigest(changedSource, id), digest);
  const missing = structuredClone(d);
  missing.catalog.questions = missing.catalog.questions.filter(
    (q) => q.id !== ancestor.id,
  );
  assert.throws(
    () => recommendationDraftDigest(missing, id),
    /missing-review-prerequisite/,
  );
  const cyclic = structuredClone(d);
  cyclic.catalog.questions.find((q) => q.id === ancestor.id)!.prerequisites = [
    { questionId: root.id, equals: root.options[0].value },
  ];
  assert.throws(
    () => recommendationDraftDigest(cyclic, id),
    /invalid-review-question-cycle/,
  );
});

test("reviewed source loading traverses a 2173-row inventory once and validates sources after all pages", async () => {
  const d = draft();
  const rows = Array.from({ length: 2173 }, (_, i) => {
    const row = source(d);
    row.policy.id = `inventory-${i}`;
    return row;
  });
  rows[2172] = source(d);
  const calls: number[] = [];
  const result = await createReviewedCatalogLoader(
    d,
    async ({ offset = 0, id } = {}) => {
      assert.equal(id, undefined);
      calls.push(offset);
      return {
        items: rows.slice(offset, offset + 1000),
        nextOffset: offset + 1000 < rows.length ? offset + 1000 : null,
      };
    },
    now,
  )();
  assert.deepEqual(calls, [0, 1000, 2000]);
  assert.equal(result.catalog.policies.length, 1);
});

test("duplicate rows, repeated or skipped cursors, empty intermediate pages and late read errors fail closed", async () => {
  const d = draft();
  for (const nextOffset of [0, 2, -1, NaN, 100001])
    await assert.rejects(
      createReviewedCatalogLoader(
        d,
        async () => ({ items: [source(d)], nextOffset }),
        now,
      )(),
      /incomplete-reviewed-source-pages/,
    );
  await assert.rejects(
    createReviewedCatalogLoader(
      d,
      async () => ({ items: [], nextOffset: 1 }),
      now,
    )(),
    /incomplete-reviewed-source-pages/,
  );
  await assert.rejects(
    createReviewedCatalogLoader(
      d,
      async ({ offset = 0 } = {}) => ({
        items: [source(d)],
        nextOffset: offset === 0 ? 1 : null,
      }),
      now,
    )(),
    /duplicate-reviewed-source/,
  );
  await assert.rejects(
    createReviewedCatalogLoader(
      d,
      async ({ offset = 0 } = {}) => {
        if (offset) throw Error("late-source-error");
        return { items: [source(d)], nextOffset: 1 };
      },
      now,
    )(),
    /late-source-error/,
  );
});
