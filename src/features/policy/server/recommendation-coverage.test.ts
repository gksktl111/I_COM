import test from "node:test";
import assert from "node:assert/strict";
import { auditRecommendationCoverage } from "./recommendation-coverage.ts";
import {
  sixFieldSources,
  sixFieldPreparedCatalog,
  sixFieldSourceVersions,
} from "./catalogs/six-field-prepared.ts";
const prepared = {
  catalog: sixFieldPreparedCatalog,
  sourceVersions: sixFieldSourceVersions,
};
const inventory = () => ({
  checkedAt: "2026-09-11T12:57:46Z",
  items: structuredClone(sixFieldSources),
});

test("coverage distinguishes current drafts, changed snapshots and missing active policies without changing approval", () => {
  const input = inventory();
  const before = JSON.stringify(prepared);
  const first = auditRecommendationCoverage(input, prepared);
  assert.equal(first.summary.currentDraftCount, 24);
  assert.equal(first.summary.noDraftCount, 6);
  const id = sixFieldPreparedCatalog.policies[0].id;
  input.items.find((r) => r.policy.id === id)!.source.snapshotId =
    "00000000-0000-0000-0000-000000000001";
  const changed = auditRecommendationCoverage(input, prepared);
  assert.equal(changed.summary.changedDraftCount, 1);
  assert.equal(
    changed.rows.find((r) => r.policyId === id)!.status,
    "SOURCE_CHANGED",
  );
  input.items = input.items.filter((r) => r.policy.id !== id);
  assert.deepEqual(
    auditRecommendationCoverage(input, prepared).summary.inactiveDraftIds,
    [id],
  );
  assert.equal(JSON.stringify(prepared), before);
});

test("duplicate source IDs fail instead of inflating coverage and input order does not change identity", () => {
  const input = inventory();
  const before = auditRecommendationCoverage(input, prepared);
  input.items.reverse();
  assert.deepEqual(auditRecommendationCoverage(input, prepared), before);
  input.items.push(input.items[0]);
  assert.throws(
    () => auditRecommendationCoverage(input, prepared),
    /invalid-coverage-source/,
  );
});

test("months and income bases stay separate review signals, and multi-field discovery is not a policy count", () => {
  const input = inventory();
  input.items = [input.items[0]];
  const p = input.items[0].policy;
  p.name = "아동 돌봄 건강 교육비 지원";
  p.target_text =
    "6개월 거주, 중위소득 기준은 건강보험료로 확인하며 소득인정액과 다름";
  p.criteria_text = null;
  const report = auditRecommendationCoverage(input, prepared);
  const row = report.rows[0];
  assert(row.categories.length > 1);
  assert.equal(report.summary.activeCount, 1);
  assert.equal(report.summary.multiCategoryCount, 1);
  assert(!row.conditionSignals.some((s) => s.kind === "AGE"));
  for (const kind of [
    "MONTHS_UNRESOLVED",
    "INCOME_MEDIAN",
    "INCOME_INSURANCE",
    "INCOME_RECOGNIZED",
  ])
    assert(
      row.conditionSignals.some(
        (s) => s.kind === kind && p.target_text!.includes(s.quote),
      ),
    );
  assert(!("rules" in row));
});
