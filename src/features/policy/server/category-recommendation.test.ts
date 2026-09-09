import test from "node:test";
import assert from "node:assert/strict";
import {
  createCategoryRecommendationService,
  createCompletePublicCatalogLoader,
  parseCategoryBankRequest,
} from "./category-recommendation.ts";
import { recommendationErrorResponse } from "./recommendation-service.ts";
import type { PublicPolicy } from "../public/types.ts";
const request = {
  flow: "CATEGORY_BANK_V1",
  revision: 1,
  category: "education",
  needs: ["uniform"],
  childProfiles: [{ id: "a", sex: null, birthYear: 2014 }],
  bankAnswers: [],
  phase: "RESULTS",
};
const policy = (id: string, name: string): PublicPolicy => ({
  id,
  name,
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
});
test("real supplied candidates remain provisional; purpose and declared school detail change order", async () => {
  const run = createCategoryRecommendationService({
    loadPolicies: async () => [
      policy("a", "초등학생 학습 지원"),
      policy("b", "중학생 교복 지원"),
      policy("c", "고등학생 교복 지원"),
      policy("d", "노인 의료비 지원"),
    ],
  });
  const unknown = await run({ ...request, needs: [] });
  assert.equal(unknown.candidateCount, 3);
  const result = await run({
    ...request,
    bankAnswers: [
      {
        questionId: "E01",
        subjectId: "a",
        state: "PROVIDED",
        value: "ENROLLED",
      },
      { questionId: "E02", subjectId: "a", state: "PROVIDED", value: "HIGH" },
    ],
  });
  assert.equal(result.policies[0].policy.id, "c");
  assert.equal(result.candidateCount, 3);
  assert(
    result.policies.every((p) =>
      p.tags.includes("자격·소득·신청기간 추가 확인 필요"),
    ),
  );
});
test("reject unsupported subjects, stale descendants, invalid options and extra fields before loading", async () => {
  let loads = 0;
  const run = createCategoryRecommendationService({
    loadPolicies: async () => {
      loads++;
      return [];
    },
  });
  for (const patch of [
    { revision: -1 },
    { needs: ["not-a-need"] },
    { secret: "extra" },
    {
      bankAnswers: [
        { questionId: "E03", subjectId: "a", state: "PROVIDED", value: "G6" },
      ],
    },
    {
      bankAnswers: [
        { questionId: "E01", subjectId: "unknown", state: "SKIPPED" },
      ],
    },
    {
      bankAnswers: [
        {
          questionId: "E01",
          subjectId: "a",
          state: "SKIPPED",
          value: "ENROLLED",
        },
      ],
    },
  ]) {
    await assert.rejects(
      run({ ...request, ...patch }),
      (e) => recommendationErrorResponse(e).status === 400,
    );
  }
  assert.equal(loads, 0);
  assert.equal(parseCategoryBankRequest(request).revision, 1);
});
test("all public pages loaded once and cache published only on full success", async () => {
  const offsets: number[] = [];
  let time = 0;
  let fail = true;
  const load = createCompletePublicCatalogLoader(
    async ({ offset }) => {
      offsets.push(offset);
      if (offset === 1000 && fail) throw new Error("unavailable");
      return {
        items: [policy(String(offset), "학생 교복")],
        nextOffset: offset === 0 ? 1000 : null,
      };
    },
    () => time,
  );
  await assert.rejects(load());
  fail = false;
  const [one, two] = await Promise.all([load(), load()]);
  assert.equal(one.length, 2);
  assert.equal(one, two);
  await load();
  assert.deepEqual(offsets, [0, 1000, 0, 1000]);
  time = 60001;
  await load();
  assert.deepEqual(offsets, [0, 1000, 0, 1000, 0, 1000]);
});
test("broken paging fails safely and missing data is a 503", async () => {
  const load = createCompletePublicCatalogLoader(async () => ({
    items: [],
    nextOffset: 0,
  }));
  await assert.rejects(
    load(),
    (e) => recommendationErrorResponse(e).status === 503,
  );
});

test("response is bounded while candidateCount covers catalog and residence never excludes candidates", async () => {
  const run = createCategoryRecommendationService({
    loadPolicies: async () =>
      Array.from({ length: 25 }, (_, i) =>
        policy(
          String(i),
          `${i === 24 ? "서울특별시 강남구" : "부산광역시"} 학생 교복 지원`,
        ),
      ),
  });
  const result = await run({
    ...request,
    residence: {
      region: "서울특별시",
      district: "강남구",
      basis: "REGISTERED_RESIDENCE",
      reference: "CURRENT",
    },
  });
  assert.equal(result.candidateCount, 25);
  assert.equal(result.policies.length, 20);
  assert.equal(result.policies[0].policy.id, "24");
  assert(result.policies.some((p) => p.policy.name.includes("부산")));
});

test("every category ranks matching public content with its registered purpose", async () => {
  for (const [category, need, name] of [
    ["pregnancy", "postpartum", "산모 산후 회복 지원"],
    ["childcare", "daycare", "어린이집 보육료 지원"],
    ["care", "night-care", "야간 돌봄 지원"],
    ["health", "checkups", "건강 검진 지원"],
    ["education", "uniform", "중학생 교복 지원"],
    ["housing", "housing-costs", "월세 주거비 지원"],
  ]) {
    const run = createCategoryRecommendationService({
      loadPolicies: async () => [policy(category, name)],
    });
    const result = await run({ ...request, category, needs: [need] });
    assert.equal(result.candidateCount, 1, category);
    assert(result.policies[0].score > 10, category);
  }
});
