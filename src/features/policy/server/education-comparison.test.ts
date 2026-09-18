import assert from "node:assert/strict";
import test from "node:test";
import module from "node:module";
import {
  COMPARISON_TIME,
  createEducationComparisonReport,
  renderEducationComparisonMarkdown,
} from "./education-comparison.ts";
import { educationPreparedCatalog as educationDraftCatalog } from "./catalogs/education-prepared.ts";

const { registerHooks } = module as unknown as {
  registerHooks(hooks: {
    resolve(
      s: string,
      c: unknown,
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
const registry = await import("./released-catalog.ts");
hooks.deregister();
async function report() {
  const publicRelease = await registry.createReviewedCatalogLoader(
    registry.educationRecommendationDraft,
    async () => {
      throw new Error(
        "comparison must not query current sources without review decisions",
      );
    },
    () => new Date(COMPARISON_TIME),
  )();
  return createEducationComparisonReport({
    publicRelease,
    reviewDecisionCount: registry.educationReviewDecisions.length,
  });
}

test("archived comparison is reproducible and keeps all 20 mapping dispositions without manufacturing approval", async () => {
  const before = structuredClone(registry.educationRecommendationDraft);
  const first = await report(),
    second = await report();
  assert.deepEqual(first, second);
  assert.equal(
    renderEducationComparisonMarkdown(first),
    renderEducationComparisonMarkdown(second),
  );
  assert.deepEqual(registry.educationRecommendationDraft, before);
  assert.deepEqual(educationDraftCatalog, before.catalog);
  assert.equal(first.coverage.length, 20);
  assert.equal(new Set(first.coverage.map((item) => item.sampleId)).size, 20);
  assert.equal(
    first.coverage.find((item) => item.sampleId === "E18")?.disposition,
    "OUTSIDE",
  );
  assert.equal(first.evidence.reviewDecisionCount, 0);
  for (const scenario of first.scenarios) {
    assert.equal(scenario.currentPublic.candidateCount, 0);
    assert.equal(scenario.currentPublic.coverage, "AWAITING_REVIEW");
    assert.equal(scenario.actualUserFlow.method, "PROVISIONAL");
    assert.equal(scenario.draftSimulation.notInDraftSampleIds.length, 6);
    assert.deepEqual(scenario.draftSimulation.eligibilityExcludedSampleIds, []);
    assert.ok(
      scenario.draftSimulation.cards.every(
        (card) => card.eligibility === "UNKNOWN",
      ),
    );
  }
  assert.ok(first.limitations.some((line) => line.includes("미검증")));
});

test("scope correction respects residence while removing E18 without changing eligibility approval", async () => {
  const comparison = await report();
  assert.equal(comparison.scenarios.length, 9);
  for (const scenario of comparison.scenarios) {
    assert.equal(scenario.baseline.rankedSampleIds.includes("E03"), false);
    assert.equal(scenario.baseline.rankedSampleIds.includes("E18"), true);
    assert.equal(scenario.actualUserFlow.method, "PROVISIONAL");
    const acceptsGijang =
      !scenario.input.residence?.region ||
      scenario.input.residence.region === "부산광역시";
    assert.equal(
      scenario.actualUserFlow.rankedSampleIds.includes("E03"),
      acceptsGijang,
    );
    assert.equal(
      scenario.actualUserFlow.rankedSampleIds.includes("E18"),
      false,
    );
    assert.deepEqual(
      scenario.actualUserFlow.addedSampleIds,
      acceptsGijang ? ["E03"] : [],
    );
    assert(scenario.actualUserFlow.removedSampleIds.includes("E18"));
    assert.equal(scenario.currentPublic.candidateCount, 0);
  }
});

test("two-child school facts and rule traces remain isolated while historical residence remains unknown", async () => {
  const comparison = await report();
  const scenario = comparison.scenarios.find(
    (s) => s.id === "two-children-different-schools",
  )!;
  const stages = scenario.projectedFacts.answers.filter(
    (a) => a.key.attribute === "education.schoolStage",
  );
  assert.deepEqual(
    stages.map((a) => [
      a.key.subject.id,
      a.state === "PROVIDED" ? a.value : null,
    ]),
    [
      ["child-1", { kind: "CODE", value: "HIGH" }],
      ["child-2", { kind: "CODE", value: "ELEMENTARY" }],
    ],
  );
  const gijang = scenario.draftSimulation.cards.find(
    (card) => card.sampleId === "E03",
  )!;
  assert.deepEqual(
    gijang.subjectRuleEvaluations.map((subject) => [
      subject.subject.id,
      subject.rules.find((r) => r.ruleId === "gijang-high")?.result.value,
    ]),
    [
      ["child-1", "TRUE"],
      ["child-2", "FALSE"],
    ],
  );
  assert.ok(
    gijang.subjectRuleEvaluations.every(
      (subject) =>
        subject.rules.find((r) => r.ruleId === "gijang-residence")?.result
          .value === "UNKNOWN",
    ),
  );
  assert.equal(gijang.tags.length, 2);
  assert.ok(gijang.tags.every((tag) => tag.eligibility === "UNKNOWN"));
});
