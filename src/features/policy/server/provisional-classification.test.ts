import test from "node:test";
import assert from "node:assert/strict";
import sample from "../../../../docs/fixtures/policy-recommendation/education-sample-20260909.json" with { type: "json" };
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
function policy(sampleId: string) {
  const item = sample.items.find((p) => p.sample_id === sampleId)!;
  return projectPublicPolicy({
    source_id: item.source_id,
    normalized: { display: item.display },
    updated_at: null,
  })!;
}
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
