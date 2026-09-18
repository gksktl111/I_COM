import test from "node:test";
import assert from "node:assert/strict";
import sample from "../../../../docs/fixtures/policy-recommendation/education-sample-20260909.json" with { type: "json" };
import officialScope from "../../../../docs/fixtures/policy-recommendation/official-scope-link-20260913.json" with { type: "json" };
import module from "node:module";
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
const { projectPublicPolicy } = await import("../public-data.ts");
hooks.deregister();
import { classifyProvisionalScope } from "./provisional-classification.ts";
import { createCategoryRecommendationService } from "./category-recommendation.ts";
import type { PublicPolicy } from "../public/types.ts";
function policy(sampleId: string) {
  const item = sample.items.find((p) => p.sample_id === sampleId)!;
  return projectPublicPolicy({
    source_id: item.source_id,
    normalized: { display: item.display },
    updated_at: null,
  })!;
}
test("공식 근거의 활동지원·자립수당을 맞는 분야에 연결하고 자격 확인 안내를 유지한다", async () => {
  for (const item of officialScope.items) {
    const policy = item.policy as PublicPolicy;
    const request = {
      flow: "CATEGORY_BANK_V1",
      revision: 0,
      category: item.include[0],
      childProfiles: [],
      needs: [],
      bankAnswers: [],
      phase: "RESULTS",
    };
    const after = await createCategoryRecommendationService({
      loadPolicies: async () => [policy],
    })(request);
    assert.deepEqual(after.policies.map((p) => p.policy.id), [policy.id]);
    assert(after.policies[0].tags.includes("자격·소득·신청기간 추가 확인 필요"));
    if (item.include[0] !== "health") {
      const before = await createCategoryRecommendationService({
        loadPolicies: async () => [policy],
        classifyScope: () => undefined,
      })(request);
      assert.equal(before.policies.length, 0);
    }
    for (const category of item.exclude) {
      const excluded = await createCategoryRecommendationService({
        loadPolicies: async () => [policy],
      })({ ...request, category });
      assert.equal(excluded.policies.length, 0);
    }
    assert.equal(classifyProvisionalScope({ ...policy, target_text: "대상이 변경됨" }, request.category), undefined);
    assert.equal(classifyProvisionalScope({ ...policy, id: "another-policy" }, request.category), undefined);
  }
});
test("exact archived scope corrects missing uniform support and university-only scholarship without deciding eligibility", async () => {
  const policies = [policy("E03"), policy("E18")];
  const request = {
    flow: "CATEGORY_BANK_V1",
    revision: 0,
    category: "education",
    childProfiles: [],
    needs: ["uniform"],
    bankAnswers: [],
    phase: "RESULTS",
  };
  const before = await createCategoryRecommendationService({
    loadPolicies: async () => policies,
    classifyScope: () => undefined,
  })(request);
  assert.deepEqual(
    before.policies.map((p) => p.policy.id),
    [policies[1].id],
  );
  const after = await createCategoryRecommendationService({
    loadPolicies: async () => policies,
  })(request);
  assert.deepEqual(
    after.policies.map((p) => p.policy.id),
    [policies[0].id],
  );
  assert(after.policies[0].tags.includes("잠정 추천"));
  assert(after.policies[0].tags.includes("자격·소득·신청기간 추가 확인 필요"));
});
test("classification text changes, renamed source identities and other categories never reuse archived decisions", () => {
  for (const id of ["E03", "E18"]) {
    const original = policy(id);
    assert.equal(classifyProvisionalScope(original, "education"), id === "E03");
    for (const field of [
      "name",
      "summary",
      "provider_name",
      "purpose_text",
      "target_text",
      "criteria_text",
      "benefit_text",
      "source_url",
    ] as const)
      assert.equal(
        classifyProvisionalScope(
          { ...original, [field]: "changed classification evidence" },
          "education",
        ),
        undefined,
        field,
      );
    assert.equal(
      classifyProvisionalScope(
        { ...original, id: "another-source" },
        "education",
      ),
      undefined,
    );
    assert.equal(classifyProvisionalScope(original, "health"), undefined);
    assert.equal(
      classifyProvisionalScope(
        { ...original, updated_at: "2026-09-12T00:00:00Z" },
        "education",
      ),
      id === "E03",
    );
  }
});

test("projected v6 scope drives provisional recommendations without keywords and excludes other fields", async () => {
  const policy = projectPublicPolicy({
    source_id: "00000000-0000-0000-0000-000000000005",
    normalized: { display: { name: "보조기기 제공", target_text: "지역 주민", benefit_text: "보조기기 대여 및 수리" } },
    relevance: { version: "policy-relevance-review-6", status: "RELATED", categories: ["의료·건강"], conditionChecks: ["세부 소득 조건 확인 필요"] },
  })!;
  const request = { flow: "CATEGORY_BANK_V1", revision: 0, category: "health", childProfiles: [], needs: [], bankAnswers: [], phase: "RESULTS" };
  const recommend = createCategoryRecommendationService({ loadPolicies: async () => [policy] });
  const result = await recommend(request);
  assert.deepEqual(result.policies.map((item) => item.policy.id), [policy.id]);
  assert(result.policies[0].tags.includes("자격·소득·신청기간 추가 확인 필요"));
  for (const category of ["pregnancy", "childcare", "care", "education", "housing"]) {
    assert.equal(classifyProvisionalScope(policy, category), false);
    assert.equal((await recommend({ ...request, category })).policies.length, 0);
  }
  assert.equal((await createCategoryRecommendationService({ loadPolicies: async () => [policy], classifyScope: () => undefined })(request)).policies.length, 0);
  for (const field of ["id", "name", "summary", "provider_name", "purpose_text", "target_text", "criteria_text", "benefit_text", "source_url"] as const) {
    const changed = { ...policy, [field]: "원문 변경" };
    assert.equal(classifyProvisionalScope(changed, "health"), undefined, field);
  }
  assert.equal(classifyProvisionalScope(policy, "family"), undefined);
});

test("v5 scope overrides archived corrections only while its source fingerprint remains current", () => {
  const original = policy("E03");
  const tagged = projectPublicPolicy({
    source_id: original.id,
    normalized: { display: original },
    relevance: { version: "policy-relevance-review-5", status: "RELATED", categories: ["주거·생활지원"] },
  })!;
  assert.equal(classifyProvisionalScope(original, "education"), true);
  assert.equal(classifyProvisionalScope(tagged, "education"), false);
  assert.equal(classifyProvisionalScope(tagged, "housing"), true);
  assert.equal(classifyProvisionalScope({ ...tagged, benefit_text: "수정된 지원내용" }, "housing"), undefined);
  const older = projectPublicPolicy({
    source_id: original.id, normalized: { display: original },
    relevance: { version: "policy-relevance-review-4", status: "RELATED", categories: ["아동 교육"] },
  })!;
  assert.equal(older.reviewedScope, undefined);
  assert.equal(classifyProvisionalScope(older, "education"), true);
});
