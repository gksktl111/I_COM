import assert from "node:assert/strict";
import { test } from "node:test";
import module from "node:module";
import {
  createRecommendationService,
  readRecommendationRequest,
  recommendationErrorResponse,
  RecommendationRequestError,
  type RecommendationWireRequest,
} from "./recommendation-service.ts";
import type { Catalog } from "../recommendation/types.ts";
import type { PublicPolicy } from "../public/types.ts";

const { registerHooks } = module as unknown as {
  registerHooks(hooks: {
    resolve(
      specifier: string,
      context: unknown,
      next: (specifier: string, context: unknown) => unknown,
    ): unknown;
  }): { deregister(): void };
};
const hooks = registerHooks({
  resolve(specifier, context, next) {
    return specifier === "server-only"
      ? { url: "data:text/javascript,export {};", shortCircuit: true }
      : next(specifier, context);
  },
});
const { createRecommendationCatalogLoader, policyDisplayFingerprint } =
  await import("./recommendation-release.ts");
const { POST } = await import(
  "../../../app/api/policy-recommendations/route.ts"
);
const { GET } = await import("../../../app/api/policies/[id]/route.ts");
hooks.deregister();

const input = (): RecommendationWireRequest => ({
  revision: 1,
  category: "education",
  selectedChildren: ["child-1"],
  subjectsComplete: true,
  householdId: "home",
  needs: [],
  answers: [],
  phase: "RESULTS",
  questionCount: 0,
  view: "CURRENT",
});
const publicPolicy: PublicPolicy = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Server test policy",
  summary: null,
  provider_name: null,
  purpose_text: null,
  target_text: "Test target",
  criteria_text: null,
  benefit_text: null,
  application_method_text: null,
  application_period_text: null,
  required_documents_text: null,
  reception_text: null,
  contact_text: null,
  source_url: "https://example.com",
  application_url: null,
  updated_at: null,
};
// Isolated test release; no entry is registered in the production loader.
const catalog: Catalog = {
  version: "test-approved-release",
  policies: [
    {
      id: publicPolicy.id,
      title: publicPolicy.name,
      category: "education",
      sourceVersion: "test-source",
      release: "HUMAN",
      releaseSourceVersion: "test-source",
      completePaths: true,
      rules: [
        {
          id: "r",
          fact: {
            attribute: "school.uniform",
            subject: "BENEFICIARY",
            basis: "SCHOOL",
            reference: "2026",
          },
          label: "Test uniform",
          evidenceRefs: ["test-only"],
          review: "HUMAN",
          sourceVersion: "test-source",
          operator: "EQ",
          expected: true,
        },
      ],
      paths: [
        {
          id: "path",
          subject: "CHILD",
          complete: true,
          expression: { kind: "PREDICATE", ruleId: "r" },
          purposes: ["uniform"],
          purposeEvidence: ["test-only"],
          availability: "UNKNOWN",
          availabilityEvidence: [],
        },
      ],
    },
  ],
  questions: [
    {
      id: "q",
      version: "1",
      fact: {
        attribute: "school.uniform",
        subject: "BENEFICIARY",
        basis: "SCHOOL",
        reference: "2026",
      },
      prompt: "Test uniform?",
      whyAsked: "Test only",
      burden: 1,
      options: [{ label: "Yes", value: { kind: "BOOLEAN", value: true } }],
      prerequisites: [],
    },
  ],
};
const load = async () => ({
  catalog: structuredClone(catalog),
  policies: [publicPolicy],
  coverage: "READY" as const,
});
const service = createRecommendationService({
  loadCatalog: load,
  now: () => new Date("2026-09-09T00:00:00Z"),
});
const answered = (): RecommendationWireRequest => ({
  ...input(),
  answers: [
    {
      key: {
        ...catalog.questions[0].fact,
        subject: { kind: "CHILD", id: "child-1" },
      },
      recordedAt: "2026-09-09T00:00:00Z",
      questionId: "q",
      questionVersion: "1",
      state: "PROVIDED",
      source: "USER_DECLARED",
      value: { kind: "BOOLEAN", value: true },
    },
  ],
});

test("server evaluates approved facts with its own PUBLIC mode and clock", async () => {
  const response = await service(answered());
  assert.equal(response.result.mode, "PUBLIC");
  assert.equal(response.result.evaluatedAt, "2026-09-09T00:00:00.000Z");
  assert.equal(response.result.cards[0].eligibility, "ELIGIBLE");
  assert.deepEqual(response.policies, [publicPolicy]);
  assert.equal(response.coverage, "READY");
});
test("request boundary rejects client authority, malformed types and limits", async () => {
  for (const patch of [
    { mode: "FIXTURE" },
    { evaluatedAt: "2020-01-01" },
    { catalog: {} },
    { phase: "OTHER" },
    { revision: -1 },
    { revision: Number.MAX_SAFE_INTEGER + 1 },
    { category: {} },
    { category: "invented" },
    { selectedChildren: Array.from({ length: 31 }, (_, i) => `c${i}`) },
    { selectedChildren: ["a", "a"] },
    { questionCount: -1 },
    { needs: ["invented"] },
  ])
    await assert.rejects(
      service({ ...input(), ...patch }),
      RecommendationRequestError,
    );
  const nested = answered();
  (nested.answers[0].key as unknown as Record<string, unknown>).approved = true;
  await assert.rejects(service(nested), RecommendationRequestError);
});
test("child profiles accept year boundaries, unknown values and reordered selected IDs", async () => {
  for (const child of [
    { id: "child-1", sex: "MALE", birthYear: 2026 },
    { id: "child-1", sex: "FEMALE", birthYear: 1900 },
    { id: "child-1", sex: null, birthYear: null },
  ]) {
    const response = await service({ ...answered(), childProfiles: [child] });
    assert.equal(response.result.cards[0].eligibility, "ELIGIBLE");
  }
  await service({
    ...input(),
    selectedChildren: ["child-1", "child-2"],
    childProfiles: [
      { id: "child-2", sex: "FEMALE", birthYear: 2020 },
      { id: "child-1", sex: "MALE", birthYear: 2015 },
    ],
  });
  await service({
    ...input(),
    category: "health",
    selectedChildren: [],
    childProfiles: [],
  });
});
test("child profiles reject malformed data, future years, duplicates and scope mismatch", async () => {
  const child = { id: "child-1", sex: "MALE", birthYear: 2020 };
  for (const patch of [
    { id: "" },
    { id: "child-2" },
    { sex: "OTHER" },
    { sex: true },
    { sex: undefined },
    { birthYear: undefined },
    { birthYear: "2020" },
    { birthYear: 1899 },
    { birthYear: 2027 },
    { birthYear: 2020.5 },
    { birthYear: NaN },
    { birthYear: Infinity },
    { birthDate: "2020-01-01" },
  ])
    await assert.rejects(
      service({ ...input(), childProfiles: [{ ...child, ...patch }] }),
      RecommendationRequestError,
    );
  for (const childProfiles of [null, {}, [], [child, child], [null]])
    await assert.rejects(
      service({ ...input(), childProfiles }),
      RecommendationRequestError,
    );
  await assert.rejects(
    service({
      ...input(),
      selectedChildren: ["child-1", "child-2"],
      childProfiles: [child],
    }),
    RecommendationRequestError,
  );
  await assert.rejects(
    service({
      ...input(),
      childProfiles: Array.from({ length: 31 }, (_, i) => ({
        ...child,
        id: `child-${i}`,
      })),
    }),
    RecommendationRequestError,
  );
});
test("year-only child profiles do not invent birthdays, exact ages or actual child counts", async () => {
  const scoped = structuredClone(catalog);
  const common = {
    label: "Test precision boundary",
    evidenceRefs: ["test-only"],
    review: "HUMAN" as const,
    sourceVersion: "test-source",
  };
  scoped.policies[0].rules = [
    {
      ...common,
      id: "birthday",
      fact: {
        attribute: "birth.date",
        subject: "BENEFICIARY",
        basis: "BIRTH",
        reference: "CURRENT",
      },
      operator: "DATE_RANGE",
      earliest: "2020-01-01",
      latest: "2020-01-01",
    },
    {
      ...common,
      id: "age",
      fact: {
        attribute: "age.years",
        subject: "BENEFICIARY",
        basis: "FULL_AGE",
        reference: "2026-09-09",
      },
      operator: "NUMBER_RANGE",
      min: 6,
      max: 6,
      minInclusive: true,
      maxInclusive: true,
      unit: "years",
    },
    {
      ...common,
      id: "count",
      fact: {
        attribute: "children.total",
        subject: "HOUSEHOLD",
        basis: "ACTUAL_TOTAL",
        reference: "CURRENT",
      },
      operator: "NUMBER_RANGE",
      min: 1,
      max: 1,
      minInclusive: true,
      maxInclusive: true,
      unit: "children",
    },
  ];
  scoped.policies[0].paths[0].expression = {
    kind: "ALL",
    children: scoped.policies[0].rules.map((rule) => ({
      kind: "PREDICATE",
      ruleId: rule.id,
    })),
  };
  scoped.questions = [];
  const response = await createRecommendationService({
    loadCatalog: async () => ({
      catalog: scoped,
      policies: [publicPolicy],
      coverage: "READY",
    }),
    now: () => new Date("2026-09-09T00:00:00Z"),
  })({
    ...input(),
    childProfiles: [{ id: "child-1", sex: "MALE", birthYear: 2020 }],
  });
  assert.equal(response.result.cards[0].eligibility, "UNKNOWN");
  assert.deepEqual(
    new Set(
      response.result.cards[0].checksNeeded.map(
        (check) => check.factKey?.attribute,
      ),
    ),
    new Set(["birth.date", "age.years", "children.total"]),
  );
});
test("residence accepts valid districts, unknown scope and Sejong without a district", async () => {
  for (const [region, district] of [
    ["서울특별시", "관악구"],
    ["부산광역시", "기장군"],
    ["서울특별시", ""],
    ["세종특별자치시", ""],
    ["", ""],
  ]) {
    const response = await service({
      ...answered(),
      residence: {
        region,
        district,
        basis: "REGISTERED_RESIDENCE",
        reference: "CURRENT",
      },
    });
    assert.equal(
      response.result.cards[0].eligibility,
      "ELIGIBLE",
      "unmapped residence does not exclude an otherwise eligible policy",
    );
  }
});
test("residence rejects unknown regions, mismatched districts and client date/basis claims", async () => {
  const residence = {
    region: "서울특별시",
    district: "관악구",
    basis: "REGISTERED_RESIDENCE",
    reference: "CURRENT",
  };
  for (const patch of [
    { region: "없는 지역" },
    { region: "toString" },
    { district: "기장군" },
    { region: "", district: "관악구" },
    { region: "세종특별자치시", district: "세종시" },
    { region: 1 },
    { district: null },
    { basis: "ACTUAL_RESIDENCE" },
    { reference: "2026-03-01" },
    { approved: true },
  ])
    await assert.rejects(
      service({ ...input(), residence: { ...residence, ...patch } }),
      RecommendationRequestError,
    );
  await assert.rejects(
    service({ ...input(), residence: null }),
    RecommendationRequestError,
  );
  await assert.rejects(
    service({
      ...input(),
      residence: {
        region: "서울특별시",
        basis: "REGISTERED_RESIDENCE",
        reference: "CURRENT",
      },
    }),
    RecommendationRequestError,
  );
});
test("current residence never supplies a historical policy eligibility fact", async () => {
  const historical = structuredClone(catalog);
  const fact = {
    attribute: "residence.region",
    subject: "BENEFICIARY" as const,
    basis: "REGISTERED",
    reference: "2026-03-01",
  };
  historical.policies[0].rules[0].fact = fact;
  const rule = historical.policies[0].rules[0];
  if (rule.operator === "EQ") rule.expected = "서울특별시";
  historical.questions[0].fact = fact;
  historical.questions[0].options = [
    { label: "서울", value: { kind: "CODE", value: "서울특별시" } },
  ];
  const response = await createRecommendationService({
    loadCatalog: async () => ({
      catalog: historical,
      policies: [publicPolicy],
      coverage: "READY",
    }),
  })({
    ...input(),
    residence: {
      region: "서울특별시",
      district: "관악구",
      basis: "REGISTERED_RESIDENCE",
      reference: "CURRENT",
    },
  });
  assert.equal(response.result.cards[0].eligibility, "UNKNOWN");
  assert.ok(
    response.result.cards[0].checksNeeded.some(
      (check) => check.factKey?.reference === "2026-03-01",
    ),
  );
});
test("all six fields accept registered interests before release and reject another field's interests", async () => {
  const waiting = createRecommendationService({
    loadCatalog: createRecommendationCatalogLoader(),
  });
  for (const [category, need] of [
    ["pregnancy", "prenatal"],
    ["childcare", "daycare"],
    ["care", "temporary-care"],
    ["health", "checkups"],
    ["education", "learning"],
    ["housing", "living-costs"],
  ]) {
    const response = await waiting({ ...input(), category, needs: [need] });
    assert.equal(response.coverage, "AWAITING_REVIEW");
    assert.deepEqual(response.result.cards, []);
    await assert.rejects(
      waiting({
        ...input(),
        category,
        needs: [category === "education" ? "prenatal" : "uniform"],
      }),
      RecommendationRequestError,
    );
  }
  const extension = structuredClone(catalog);
  extension.policies[0].paths[0].purposes.push("approved-extension");
  const extended = createRecommendationService({
    loadCatalog: async () => ({
      catalog: extension,
      policies: [publicPolicy],
      coverage: "READY",
    }),
  });
  await extended({ ...input(), needs: ["approved-extension"] });
  await assert.rejects(
    extended({
      ...input(),
      category: "housing",
      needs: ["approved-extension"],
    }),
    RecommendationRequestError,
  );
});
test("answers must match approved question, option, fact and selected subject", async () => {
  for (const mutate of [
    (a: ReturnType<typeof answered>) => {
      a.answers[0].key.attribute = "income.fake";
    },
    (a: ReturnType<typeof answered>) => {
      a.answers[0].key.subject.id = "unselected";
    },
    (a: ReturnType<typeof answered>) => {
      a.answers[0].questionVersion = "old";
    },
    (a: ReturnType<typeof answered>) => {
      a.answers[0].questionId = "fake";
    },
    (a: ReturnType<typeof answered>) => {
      if (a.answers[0].state === "PROVIDED")
        a.answers[0].value = { kind: "CODE", value: "fabricated" };
    },
  ]) {
    const request = answered();
    mutate(request);
    await assert.rejects(service(request), RecommendationRequestError);
  }
});
test("empty production registry does not read active policies or fabricate approval", async () => {
  let reads = 0;
  const loader = createRecommendationCatalogLoader(undefined, async () => {
    reads++;
    throw new Error("should-not-read");
  });
  const response = await createRecommendationService({ loadCatalog: loader })({
    ...input(),
    needs: ["uniform", "entry-preparation"],
  });
  assert.equal(reads, 0);
  assert.equal(response.coverage, "AWAITING_REVIEW");
  assert.deepEqual(response.result.cards, []);
  assert.deepEqual(response.questions, []);
});
test("release loader rejects changed displays and follows all pages without partial success", async () => {
  const release = {
    catalog,
    displayFingerprints: {
      [publicPolicy.id]: policyDisplayFingerprint(publicPolicy),
    },
  };
  const offsets: number[] = [];
  const loader = createRecommendationCatalogLoader(
    release,
    async ({ offset = 0 } = {}) => {
      offsets.push(offset);
      return offset === 0
        ? { items: [], nextOffset: 1000 }
        : { items: [publicPolicy], nextOffset: null };
    },
  );
  assert.equal((await loader()).catalog.policies.length, 1);
  assert.deepEqual(offsets, [0, 1000]);
  const stale = await createRecommendationCatalogLoader(release, async () => ({
    items: [{ ...publicPolicy, target_text: "Changed" }],
    nextOffset: null,
  }))();
  assert.deepEqual(stale.catalog.policies, []);
  assert.deepEqual(stale.catalog.questions, []);
  assert.equal(stale.coverage, "AWAITING_REVIEW");
  await assert.rejects(
    createRecommendationCatalogLoader(release, async ({ offset = 0 } = {}) => {
      if (offset) throw new Error("private-upstream-error");
      return { items: [publicPolicy], nextOffset: 1000 };
    })(),
    /private-upstream-error/,
  );
  const invalid = structuredClone(release);
  invalid.catalog.policies[0].releaseSourceVersion = "stale";
  await assert.rejects(
    createRecommendationCatalogLoader(invalid)(),
    /invalid-approved-release/,
  );
});
test("bounded JSON stream rejects oversized bodies and safe errors never reveal causes", async () => {
  await assert.rejects(
    readRecommendationRequest(
      new Request("https://example.com", {
        method: "POST",
        body: "x".repeat(128 * 1024 + 1),
      }),
    ),
    RecommendationRequestError,
  );
  await assert.rejects(
    readRecommendationRequest(
      new Request("https://example.com", { method: "POST", body: "{" }),
    ),
    RecommendationRequestError,
  );
  const failure = recommendationErrorResponse(
    new Error("secret database credentials"),
  );
  assert.equal(failure.status, 503);
  assert.equal(failure.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await failure.json(), {
    error: "recommendation-data-unavailable",
  });
});
test("POST exposes review coverage and rejects client fixture mode without a public cache", async () => {
  const response = await POST(
    new Request("https://example.com/api/policy-recommendations", {
      method: "POST",
      body: JSON.stringify(input()),
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal((await response.json()).coverage, "AWAITING_REVIEW");
  const invalid = await POST(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ ...input(), mode: "FIXTURE" }),
    }),
  );
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), {
    error: "invalid-recommendation-request",
  });
});
test("detail API validates ID and distinguishes missing records from safe upstream failures", async (t) => {
  const oldUrl = process.env.SUPABASE_URL,
    oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-private-secret";
  t.after(() => {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = oldKey;
  });
  const request = new Request("https://example.com");
  assert.equal(
    (await GET(request, { params: Promise.resolve({ id: "bad" }) })).status,
    400,
  );
  t.mock.method(globalThis, "fetch", async () => Response.json([]));
  assert.equal(
    (await GET(request, { params: Promise.resolve({ id: publicPolicy.id }) }))
      .status,
    404,
  );
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("test-private-secret");
  });
  const failure = await GET(request, {
    params: Promise.resolve({ id: publicPolicy.id }),
  });
  assert.equal(failure.status, 503);
  assert.deepEqual(await failure.json(), { error: "policy-data-unavailable" });
});

test("changed question context is a recoverable conflict with a safe uncached error", async () => {
  const { RecommendationContextChangedError } = await import(
    "./recommendation-service.ts"
  );
  const response = recommendationErrorResponse(
    new RecommendationContextChangedError(),
  );
  assert.equal(response.status, 409);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(await response.json(), {
    error: "recommendation-context-changed",
  });
});
