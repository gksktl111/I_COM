import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareReviewActivation, type ReviewDecisions } from "./review-activation.ts";

function fixture() {
  const sourceId = "11111111-1111-4111-8111-111111111111";
  const inventory = { queriedAt: "2026-09-11T14:15:17.881Z", rows: [{
    source_id: sourceId, applied_snapshot_id: "22222222-2222-4222-8222-222222222222",
    catalog_status: "REVIEW", relevance: { version: "policy-relevance-3", status: "REVIEW" },
    normalized: { displayHash: "a".repeat(64), normalizerVersion: "fixture-1",
      display: { name: "학생 급식 지원", target_text: "결식 우려가 있는 아동", benefit_text: "급식비 지원" } },
  }] };
  const decisions: ReviewDecisions = { kind: "CATALOG_REVIEW_DECISIONS", inputQueriedAt: inventory.queriedAt, items: [{
    sourceId, name: "학생 급식 지원", decision: "ACTIVATE", categories: ["아동 돌봄"],
    evidence: [{ field: "target_text", excerpt: "결식 우려가 있는 아동", rule: "아동에게 직접 급식 지원" }],
    reason: "아동 대상 급식 지원 근거 확인",
  }] };
  return { inventory, decisions };
}

test("activation plan binds full source and prior decision and leaves unreviewed policies untouched", () => {
  const { inventory, decisions } = fixture();
  inventory.rows.push({ ...structuredClone(inventory.rows[0]), source_id: "33333333-3333-4333-8333-333333333333" });
  const plan = prepareReviewActivation(inventory, decisions);
  assert.equal(plan.activateCount, 1);
  assert.equal(plan.notReviewedCount, 1);
  assert.deepEqual(plan.items[0].payload.expectedNormalized, inventory.rows[0].normalized);
  assert.deepEqual(plan.items[0].payload.previousRelevance, inventory.rows[0].relevance);
  assert.equal(plan.digest, prepareReviewActivation(inventory, decisions).digest);
  inventory.rows[0].normalized.display.benefit_text = "다른 지원";
  assert.notEqual(plan.digest, prepareReviewActivation(inventory, decisions).digest);
  assert.equal(plan.items[0].payload.expectedNormalized.display.benefit_text, "급식비 지원");
});

test("keep review creates no write and invented evidence, wrong cohort, duplicate decisions and active input fail closed", () => {
  const { inventory, decisions } = fixture();
  const kept = structuredClone(decisions);
  Object.assign(kept.items[0], { decision: "KEEP_REVIEW", categories: [], evidence: [] });
  assert.equal(prepareReviewActivation(inventory, kept).items.length, 0);
  assert.equal(prepareReviewActivation(inventory, kept).keepReviewCount, 1);
  const unread = structuredClone(kept);
  unread.items[0].reason = "UNREAD: 아직 상세 검토 전";
  assert.throws(() => prepareReviewActivation(inventory, unread), /decision-shape/);
  const invented = structuredClone(decisions);
  invented.items[0].evidence[0].excerpt = "없는 근거";
  assert.throws(() => prepareReviewActivation(inventory, invented), /evidence/);
  assert.throws(() => prepareReviewActivation(inventory, { ...decisions, inputQueriedAt: "2026-09-10T00:00:00Z" }), /inventory/);
  assert.throws(() => prepareReviewActivation(inventory, { ...decisions, items: [...decisions.items, ...decisions.items] }), /decision-identity/);
  inventory.rows[0].catalog_status = "ACTIVE";
  assert.throws(() => prepareReviewActivation(inventory, decisions), /source/);
});

test("v2 plans preserve keep-review, require direct evidence and separately count excluded policies", () => {
  const { inventory, decisions } = fixture();
  inventory.rows[0].normalized.display.name = "사업장 시설 지원";
  inventory.rows[0].normalized.display.target_text = "사업자등록을 한 소상공인";
  inventory.rows[0].normalized.display.benefit_text = "사업장 시설 개선비";
  decisions.items[0].name = "사업장 시설 지원";
  decisions.items[0].reason = "사업장 시설 개선이며 가족·아동 경로 없음";
  decisions.items[0].evidence = [{ field: "target_text", excerpt: "사업자등록을 한 소상공인", rule: "사업자 대상" }];
  const excluded = structuredClone(decisions);
  excluded.items[0].decision = "EXCLUDE";
  excluded.items[0].categories = [];
  assert.throws(() => prepareReviewActivation(inventory, excluded), /activation-decision/);
  const plan = prepareReviewActivation(inventory, excluded, "policy-relevance-review-2");
  assert.equal(plan.activateCount, 0);
  assert.equal(plan.excludeCount, 1);
  assert.equal(plan.items[0].payload.relevance.status, "UNRELATED");
  assert.deepEqual(plan.items[0].payload.expectedNormalized, inventory.rows[0].normalized);
  excluded.items[0].evidence = [{ field: "name", excerpt: "사업장 시설 지원", rule: "사업명만 확인" }];
  assert.throws(() => prepareReviewActivation(inventory, excluded, "policy-relevance-review-2"), /direct-evidence/);
  Object.assign(inventory.rows[0].normalized.display, { criteria_text: "선정기준 원문" });
  excluded.items[0].evidence = [{ field: "criteria_text", excerpt: "선정기준 원문", rule: "직접 선정 대상 근거" }];
  assert.equal(prepareReviewActivation(inventory, excluded, "policy-relevance-review-2").excludeCount, 1);
});

test("pending review notes are opt-in and bind the reviewed source without activation", () => {
  const { inventory, decisions } = fixture();
  Object.assign(decisions.items[0], { decision: "KEEP_REVIEW", categories: [], evidence: [], reason: "지원 대상 문장 추가 확인 필요" });
  assert.equal(prepareReviewActivation(inventory, decisions, "policy-relevance-review-2").items.length, 0);
  const plan = prepareReviewActivation(inventory, decisions, "policy-relevance-review-2", true);
  assert.equal(plan.recordedReviewCount, 1);
  assert.equal(plan.activateCount, 0);
  assert.equal(plan.excludeCount, 0);
  assert.equal(plan.items[0].payload.relevance.status, "REVIEW");
  assert.deepEqual(plan.items[0].payload.expectedNormalized, inventory.rows[0].normalized);
  assert.throws(() => prepareReviewActivation(inventory, decisions, "policy-relevance-review-1", true), /version/);
});

test("correction plans can only return exclusions to pending", () => {
  const { inventory, decisions } = fixture();
  inventory.rows[0].catalog_status = "EXCLUDED";
  inventory.rows[0].relevance = { version: "policy-relevance-review-2", status: "UNRELATED" };
  assert.throws(() => prepareReviewActivation(inventory, decisions, "policy-relevance-review-3", true), /correction-must/);
  Object.assign(decisions.items[0], { decision: "KEEP_REVIEW", categories: [], evidence: [] });
  const plan = prepareReviewActivation(inventory, decisions, "policy-relevance-review-3", true);
  assert.equal(plan.items[0].payload.correction, true);
  assert.equal(plan.items[0].payload.relevance.status, "REVIEW");
  assert.deepEqual(plan.items[0].payload.previousRelevance, inventory.rows[0].relevance);
});
