import assert from "node:assert/strict";
import { test } from "node:test";
import sourceBundle from "../../../../docs/fixtures/policy-recommendation/education-template-sources-20260911.json" with { type: "json" };
import recipeBundle from "../../../../docs/fixtures/policy-recommendation/education-template-inputs-20260911.json" with { type: "json" };
import {
  prepareEducationCatalog,
  educationPreparedCatalog,
  educationPreparedSourceVersions,
  educationPreparationQueue,
} from "./catalogs/education-prepared.ts";
import {
  educationDraftCatalog,
  educationSourceVersions,
} from "./catalogs/education-2026.ts";
import { evaluateRecommendation } from "../recommendation/engine.ts";
import { evaluatePredicate } from "../recommendation/eligibility.ts";
import { bindFact } from "../recommendation/facts.ts";
import type { Context, Predicate } from "../recommendation/types.ts";

const source = (sampleId: string) =>
  sourceBundle.items.find((item) => item.sampleId === sampleId)!;

test("swapped sample identities cannot attach another policy's disposition or review gaps", () => {
  const sources = structuredClone(sourceBundle.items);
  const first = sources.find((item) => item.sampleId === "E01")!;
  const second = sources.find((item) => item.sampleId === "E02")!;
  first.sampleId = "E02";
  second.sampleId = "E01";
  assert.throws(
    () => prepareEducationCatalog({ sources }),
    /invalid-education-source-bundle/,
  );
});

test("all 20 actual sources become fourteen hidden drafts or six explicit holds", () => {
  const result = prepareEducationCatalog();
  assert.deepEqual(result.catalog, educationPreparedCatalog);
  assert.deepEqual(result.sourceVersions, educationPreparedSourceVersions);
  assert.deepEqual(result.queue, educationPreparationQueue);
  assert.equal(result.queue.length, 20);
  assert.equal(new Set(result.queue.map((q) => q.sampleId)).size, 20);
  assert.equal(result.summary.sourceCount, 20);
  assert.equal(result.summary.preparedDraftCount, 14);
  assert.equal(result.summary.manualCount, 2);
  assert.equal(result.summary.templateCount, 12);
  assert.equal(result.summary.heldCount, 6);
  assert.equal(result.summary.invalidCount, 0);
  assert.deepEqual(
    result.catalog.policies.slice(0, 2),
    educationDraftCatalog.policies,
  );
  assert.deepEqual(
    result.catalog.policies
      .slice(2)
      .map((p) => p.id)
      .sort(),
    recipeBundle.items.map((item) => item.policyId).sort(),
  );
  assert.equal(
    new Set(result.catalog.questions.map((q) => q.id)).size,
    result.catalog.questions.length,
  );
  for (const policy of result.catalog.policies) {
    assert.equal(policy.release, "HIDDEN");
    assert.equal(policy.completePaths, false);
    assert.equal(
      policy.sourceVersion,
      result.sourceVersions[policy.id].normalizedFingerprint,
    );
    for (const rule of policy.rules) {
      assert.equal(rule.review, "UNREVIEWED");
      assert.equal(rule.sourceVersion, policy.sourceVersion);
    }
    for (const path of policy.paths)
      assert.equal(path.complete, path.id.startsWith("gwanak-2026-first-"));
  }
  assert.equal(result.summary.humanReleaseCount, 0);
  assert.equal(result.summary.humanRuleCount, 0);
  assert.equal(result.summary.completePolicyCount, 0);
  assert.equal(result.summary.completePathCount, 3);
  assert.deepEqual(
    evaluateRecommendation(result.catalog, {
      mode: "PUBLIC",
      revision: 0,
      category: "education",
      selectedChildren: ["child-1"],
      householdId: "household-1",
      subjectsComplete: false,
      needs: [],
      answers: [],
      phase: "RESULTS",
      questionCount: 0,
      view: "CURRENT",
      evaluatedAt: "2026-09-11T00:00:00Z",
    }).cards,
    [],
    "prepared drafts never become public cards",
  );
  assert.equal(
    result.queue.find((q) => q.sampleId === "E10")?.holdReason,
    "INSUFFICIENT_EVIDENCE",
  );
  assert.equal(
    result.queue.find((q) => q.sampleId === "E18")?.holdReason,
    "SCOPE_REVIEW",
  );
});

test("fresh source identity binds compiled drafts but never silently rebases the manual drafts", () => {
  const before = JSON.stringify({
    educationDraftCatalog,
    educationSourceVersions,
  });
  const sources = structuredClone(sourceBundle.items);
  const manual = sources.find((s) => s.sampleId === "E03")!;
  const compiled = sources.find((s) => s.sampleId === "E01")!;
  manual.source.normalizedFingerprint = "a".repeat(64);
  compiled.source.normalizedFingerprint = "b".repeat(64);
  const result = prepareEducationCatalog({ sources });
  assert.deepEqual(
    result.sourceVersions[manual.policy.id],
    educationSourceVersions[manual.policy.id],
  );
  assert.equal(
    result.catalog.policies[0].sourceVersion,
    educationDraftCatalog.policies[0].sourceVersion,
  );
  assert.ok(
    result.queue
      .find((q) => q.sampleId === "E03")
      ?.codes.includes("MANUAL_SOURCE_CHANGED_REVIEW_REQUIRED"),
  );
  const policy = result.catalog.policies.find(
    (p) => p.id === compiled.policy.id,
  )!;
  assert.equal(policy.sourceVersion, compiled.source.normalizedFingerprint);
  assert.ok(
    policy.rules.every(
      (rule) => rule.sourceVersion === compiled.source.normalizedFingerprint,
    ),
  );
  assert.deepEqual(result.sourceVersions[compiled.policy.id], compiled.source);
  assert.equal(
    JSON.stringify({ educationDraftCatalog, educationSourceVersions }),
    before,
  );
});

test("a damaged actual quote quarantines its draft while preserving other sources and invalid status", () => {
  const inputs = structuredClone(recipeBundle.items);
  inputs[0].paths[0].conditions[0].evidence[0].quote =
    "이 문장은 실제 정책 원문에 존재하지 않습니다.";
  const result = prepareEducationCatalog({ inputs });
  assert.equal(result.summary.status, "PARTIAL_INVALID");
  assert.equal(result.summary.invalidCount, 1);
  assert.equal(result.summary.policyCount, 13);
  assert.equal(result.queue.length, 20);
  const rejected = result.queue.find((q) => q.sampleId === "E01")!;
  assert.equal(rejected.status, "INVALID");
  assert.ok(rejected.codes.includes("EVIDENCE_NOT_IN_SOURCE"));
  assert.equal(
    result.catalog.policies.some((p) => p.id === source("E01").policy.id),
    false,
  );
  assert.equal(source("E01").policy.id in result.sourceVersions, false);
  assert.deepEqual(
    result.catalog.policies.slice(0, 2),
    educationDraftCatalog.policies,
  );
  assert.equal(result.summary.humanReleaseCount, 0);
});

test("a rejected recipe targeting a manual draft cannot disappear behind the preserved manual row", () => {
  const inputs = structuredClone(recipeBundle.items);
  inputs[0].policyId = source("E03").policy.id;
  inputs[0].sampleId = "E03";
  inputs[0].paths[0].conditions[0].evidence[0].quote =
    "수동 원문에 존재하지 않는 템플릿 인용";
  const result = prepareEducationCatalog({ inputs });
  assert.equal(result.summary.status, "PARTIAL_INVALID");
  assert.equal(result.summary.invalidCount, 1);
  assert.deepEqual(
    result.catalog.policies.slice(0, 2),
    educationDraftCatalog.policies,
  );
  assert.ok(
    result.queue.some((q) => q.sampleId === "E03" && q.status === "INVALID"),
  );
  assert.ok(
    result.queue.some(
      (q) =>
        q.sampleId === "E03" &&
        q.method === "MANUAL" &&
        q.status === "PREPARED_DRAFT",
    ),
  );
});

test("a candidate without a recipe is held as unimplemented, distinct from source evidence ambiguity", () => {
  const result = prepareEducationCatalog({
    inputs: recipeBundle.items.filter((item) => item.sampleId !== "E19"),
  });
  const issue = result.queue.find((q) => q.sampleId === "E19")!;
  assert.equal(issue.status, "HELD");
  assert.equal(issue.holdReason, "NOT_IMPLEMENTED");
  assert.ok(issue.codes.includes("TEMPLATE_NOT_IMPLEMENTED"));
  assert.equal(
    result.queue.find((q) => q.sampleId === "E10")?.holdReason,
    "INSUFFICIENT_EVIDENCE",
  );
});

function numericRule(
  sampleId: string,
  unit: string,
): Extract<Predicate, { operator: "NUMBER_RANGE" }> {
  const policy = educationPreparedCatalog.policies.find(
    (p) => p.id === source(sampleId).policy.id,
  )!;
  const found = policy.rules.find(
    (rule) => rule.operator === "NUMBER_RANGE" && rule.unit === unit,
  );
  assert.ok(
    found && found.operator === "NUMBER_RANGE",
    `${sampleId} has an actual compiled ${unit} rule`,
  );
  return found;
}
function numericContext(
  rule: Extract<Predicate, { operator: "NUMBER_RANGE" }>,
  number: number,
): Context {
  const context: Context = {
    mode: "FIXTURE",
    sourceVersion: rule.sourceVersion,
    beneficiary: { kind: "CHILD", id: "child-1" },
    household: { kind: "HOUSEHOLD", id: "household-1" },
    answers: [],
  };
  context.answers = [
    {
      key: bindFact(rule.fact, context),
      recordedAt: "2026-09-11T00:00:00Z",
      state: "PROVIDED",
      source: "USER_DECLARED",
      value: {
        kind: "NUMBER_RANGE",
        min: number,
        max: number,
        minInclusive: true,
        maxInclusive: true,
        unit: rule.unit,
      },
    },
  ];
  return context;
}

test("actual commute and recognized-income clauses preserve strict and inclusive decimal boundaries", () => {
  const distance = numericRule("E07", "DISTANCE_KM");
  const income = numericRule("E01", "PERCENT_OF_MEDIAN_INCOME");
  assert.match(
    source("E07").policy.target_text!,
    /2킬로미터 이내인 학생은 제외/,
  );
  assert.match(source("E01").policy.target_text!, /100분의 50 이하/);
  for (const [rule, pairs] of [
    [
      distance,
      [
        [2, "FALSE"],
        [2.01, "TRUE"],
      ],
    ],
    [
      income,
      [
        [50, "TRUE"],
        [50.01, "FALSE"],
      ],
    ],
  ] as const) {
    const fixtureRule = {
      ...structuredClone(rule),
      review: "FIXTURE" as const,
    };
    for (const [value, expected] of pairs) {
      const context = numericContext(rule, value);
      assert.equal(evaluatePredicate(fixtureRule, context).value, expected);
      assert.equal(
        evaluatePredicate(rule, context).value,
        "UNKNOWN",
        "actual rules stay unreviewed",
      );
    }
    assert.equal(rule.review, "UNREVIEWED");
  }
});

test("actual third-child clause compares that beneficiary's birth order without approving the draft", () => {
  const rule = numericRule("E12", "BIRTH_ORDER");
  assert.match(source("E12").policy.target_text!, /셋째아 이상 자녀/);
  assert.equal(rule.fact.subject, "BENEFICIARY");
  const fixtureRule = { ...structuredClone(rule), review: "FIXTURE" as const };
  assert.equal(
    evaluatePredicate(fixtureRule, numericContext(rule, 2)).value,
    "FALSE",
  );
  assert.equal(
    evaluatePredicate(fixtureRule, numericContext(rule, 3)).value,
    "TRUE",
  );
  assert.equal(
    evaluatePredicate(rule, numericContext(rule, 3)).value,
    "UNKNOWN",
  );
  assert.equal(rule.review, "UNREVIEWED");
});

test("official follow-up resolves two archived holds without rewriting source data or approval", () => {
  for (const sampleId of ["E05", "E06"]) {
    const row = educationPreparationQueue.find((q) => q.sampleId === sampleId)!;
    assert.equal(row.status, "PREPARED_DRAFT");
    assert.equal(row.disposition, "CANDIDATE");
    assert.equal(row.archivedDisposition, "HOLD");
    const policy = educationPreparedCatalog.policies.find(
      (p) => p.id === row.policyId,
    )!;
    assert.equal(policy.release, "HIDDEN");
    assert.ok(policy.rules.every((r) => r.review === "UNREVIEWED"));
    assert.ok(policy.paths.every((p) => !p.complete));
    assert.ok(
      policy.rules.every((r) =>
        r.evidenceRefs.some((e) => e.includes(":official.")),
      ),
    );
    assert.equal(
      policy.sourceVersion,
      source(sampleId).source.normalizedFingerprint,
    );
  }
  const e05 = educationPreparedCatalog.policies.find(
    (p) => p.id === source("E05").policy.id,
  )!;
  const stage = e05.rules.find(
    (r) => r.fact.attribute === "education.schoolStage",
  );
  assert.ok(stage && stage.operator === "IN_SET");
  assert.ok(stage.expected.includes("ELEMENTARY"));
  const e06 = educationPreparedCatalog.policies.find(
    (p) => p.id === source("E06").policy.id,
  )!;
  assert.equal(
    e06.rules.some((r) => r.fact.attribute === "education.schoolStage"),
    false,
    "school attendance is not a universal requirement for E06",
  );
  const birth = e06.rules.find((r) => r.operator === "DATE_RANGE");
  assert.ok(birth && birth.operator === "DATE_RANGE");
  for (const [year, expected] of [
    [2007, "FALSE"],
    [2008, "TRUE"],
    [2019, "TRUE"],
    [2020, "FALSE"],
  ] as const) {
    const context: Context = {
      mode: "FIXTURE",
      sourceVersion: birth.sourceVersion,
      beneficiary: { kind: "CHILD", id: "child-1" },
      household: { kind: "HOUSEHOLD", id: "household-1" },
      answers: [],
    };
    context.answers.push({
      key: bindFact(birth.fact, context),
      recordedAt: "2026-09-11T00:00:00Z",
      state: "PROVIDED",
      source: "USER_DECLARED",
      value: {
        kind: "DATE_RANGE",
        earliest: `${year}-01-01`,
        latest: `${year}-12-31`,
      },
    });
    assert.equal(
      evaluatePredicate({ ...birth, review: "FIXTURE" }, context).value,
      expected,
    );
    assert.equal(evaluatePredicate(birth, context).value, "UNKNOWN");
  }
});

test("education benefit income question uses its official 2026 assessment without inventing institution recognition", () => {
  const income = numericRule("E01", "PERCENT_OF_MEDIAN_INCOME");
  assert.equal(income.fact.reference, "2026년 교육급여 심사");
  assert.ok(
    income.evidenceRefs.some((ref) =>
      ref.includes(":official.moe-2026-education-benefit"),
    ),
  );
  const question = educationPreparedCatalog.questions.find(
    (q) => JSON.stringify(q.fact) === JSON.stringify(income.fact),
  );
  assert.ok(question);
  const tuition = educationPreparedCatalog.policies
    .find((p) => p.id === source("E01").policy.id)!
    .rules.find((r) =>
      r.fact.attribute.endsWith("education.e01.highSchoolTuition"),
    )!;
  assert.ok(tuition);
  assert.equal(
    educationPreparedCatalog.questions.some(
      (q) => JSON.stringify(q.fact) === JSON.stringify(tuition.fact),
    ),
    false,
  );
});
