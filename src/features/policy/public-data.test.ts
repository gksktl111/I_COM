import assert from "node:assert/strict";
import { test } from "node:test";
import module from "node:module";
import {
  conditionError,
  interestError,
  selectInterest,
  questionProfile,
  safePolicyUrl,
  initialConditions,
  matchesInterests,
  type PublicPolicy,
} from "./public/types.ts";
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
    if (specifier === "server-only")
      return { url: "data:text/javascript,export {};", shortCircuit: true };
    return next(specifier, context);
  },
});
const { readPublicPolicies } = await import("./public-data.ts");
hooks.deregister();

test("public catalogue reads only ACTIVE candidates and projects public display fields", async (t) => {
  const oldUrl = process.env.SUPABASE_URL,
    oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "synthetic-private-secret";
  t.after(() => {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = oldKey;
  });
  let rows: unknown = [
    {
      source_id: "00000000-0000-0000-0000-000000000001",
      updated_at: "2026-09-08T00:00:00Z",
      applied_snapshot_id: "private-snapshot",
      relevance: { reason: "private-assessment" },
      normalized: {
        rawHash: "private-hash",
        display: {
          name: "테스트 보육 지원",
          target_text: "만 6세 미만",
          benefit_text: "공식 안내의 지원 내용",
          source_url: "https://www.gov.kr/policy",
          application_url: "javascript:alert(1)",
          raw: "private-raw",
          secret: "private-display-key",
        },
      },
    },
  ];
  const fetchMock = t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/rest/v1/policy_active_candidates");
      assert.equal(
        url.searchParams.get("select"),
        "source_id,normalized,updated_at",
      );
      assert.equal(init?.redirect, "error");
      assert.equal(init?.cache, "no-store");
      assert.equal(
        new Headers(init?.headers).get("apikey"),
        "synthetic-private-secret",
      );
      return Response.json(rows);
    },
  );
  const result = await readPublicPolicies();
  assert.equal(result.items.length, 1);
  assert.equal(result.nextOffset, null);
  assert.equal(result.items[0].name, "테스트 보육 지원");
  assert.equal(result.items[0].source_url, "https://www.gov.kr/policy");
  assert.equal(result.items[0].application_url, null);
  assert.equal(result.items[0].criteria_text, null);
  assert.doesNotMatch(
    JSON.stringify(result),
    /private-|rawHash|relevance|snapshot|secret/i,
  );
  await readPublicPolicies({ id: result.items[0].id });
  const detailUrl = new URL(String(fetchMock.mock.calls[1].arguments[0]));
  assert.equal(
    detailUrl.searchParams.get("source_id"),
    `eq.${result.items[0].id}`,
  );
  const calls = fetchMock.mock.callCount();
  for (const id of ["bad-id", "id,or=(true)"])
    await assert.rejects(readPublicPolicies({ id }), /invalid-policy-filter/);
  for (const offset of [-1, 0.5, NaN, 100001])
    await assert.rejects(
      readPublicPolicies({ offset }),
      /invalid-policy-filter/,
    );
  assert.equal(fetchMock.mock.callCount(), calls);
  rows = [{ source_id: "bad", normalized: { display: { name: "" } } }];
  assert.deepEqual((await readPublicPolicies()).items, []);
  process.env.SUPABASE_URL = "https://attacker.invalid";
  await assert.rejects(readPublicPolicies(), /policy-data-unavailable/);
});
test("public link projection rejects executable and credential-bearing URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:password@example.com",
    "/relative",
    null,
  ])
    assert.equal(safePolicyUrl(url), null);
  assert.equal(
    safePolicyUrl("https://www.bokjiro.go.kr/"),
    "https://www.bokjiro.go.kr/",
  );
});
test("unknown inputs remain unknown and interests are discovery, not eligibility", () => {
  const value = initialConditions();
  assert.equal(value.pregnancy, "unknown");
  assert.equal(value.childrenComplete, "unknown");
  assert.equal(value.income, "unknown");
  assert.deepEqual(value.household, []);
  const policy = {
    name: "산모 의료비 지원",
    target_text: "원문 확인 필요",
  } as PublicPolicy;
  assert.equal(matchesInterests(policy, []), true);
  assert.equal(matchesInterests(policy, ["주거·생활지원", "의료·건강"]), true);
  assert.equal(matchesInterests(policy, ["주거·생활지원"]), false);
});

test("condition edits validate hidden fields before applying across tabs", () => {
  const value = initialConditions();
  assert.match(conditionError(value, "2026-09-08")!, /지원 분야/);
  value.interests = ["돌봄"];
  assert.equal(conditionError(value, "2026-09-08"), null);
  value.totalChildren = "-1";
  assert.match(conditionError(value, "2026-09-08")!, /총자녀/);
  value.totalChildren = "2";
  value.children = [
    { id: 1, precision: "date", birth: "2027-01-01", care: "unknown" },
  ];
  assert.match(conditionError(value, "2026-09-08")!, /자녀 1/);
  value.children[0].birth = "2026-02-30";
  assert.match(conditionError(value, "2026-09-08")!, /유효한 날짜/);
  value.children[0] = {
    id: 1,
    precision: "month",
    birth: "2026-09",
    care: "unknown",
  };
  assert.equal(conditionError(value, "2026-09-08"), null);
});

test("one interest is required and switching replaces category-only answers", () => {
  const value = initialConditions();
  assert.ok(interestError(value));
  value.interests = ["돌봄", "의료·건강"];
  assert.ok(interestError(value));
  value.region = "서울특별시";
  value.children = [
    { id: 1, precision: "date", birth: "2020-01-01", care: "nursery" },
  ];
  value.careTime = "evening";
  const switched = selectInterest(value, "의료·건강");
  assert.equal(interestError(switched), null);
  assert.deepEqual(switched.interests, ["의료·건강"]);
  assert.equal(switched.region, "서울특별시");
  assert.equal(switched.children[0].birth, "2020-01-01");
  assert.equal(switched.children[0].care, "unknown");
  assert.equal(switched.careTime, "unknown");
  assert.equal(questionProfile(switched).household, false);
});

test("pregnancy questions skip hidden child validation until child questions apply", () => {
  const value = selectInterest(initialConditions(), "임신·출산");
  value.family = ["임신 중"];
  value.totalChildren = "-1";
  assert.equal(questionProfile(value).children, false);
  assert.equal(conditionError(value), null);
  value.family = ["출산 후"];
  assert.equal(questionProfile(value).children, true);
  assert.match(conditionError(value)!, /총자녀/);
});

test("education can be selected with child questions and discovers learning support", () => {
  const previous = selectInterest(initialConditions(), "돌봄");
  previous.careTime = "evening";
  previous.children = [
    { id: 1, precision: "date", birth: "2017-03-01", care: "unknown" },
  ];
  const value = selectInterest(previous, "아동 교육");
  assert.deepEqual(value.interests, ["아동 교육"]);
  assert.equal(conditionError(value, "2026-09-08"), null);
  assert.deepEqual(questionProfile(value), {
    children: true,
    household: true,
    childcare: true,
  });
  assert.equal(value.children[0].birth, "2017-03-01");
  assert.equal(value.careTime, "unknown");
  for (const policy of [
    { name: "초중고 학생 학용품비 지원" },
    { name: "학습 지원", target_text: "학교 밖 청소년" },
    { name: "입학준비금", target_text: "초등학교 입학생" },
  ]) {
    assert.equal(
      matchesInterests(policy as PublicPolicy, value.interests),
      true,
    );
  }
  for (const name of [
    "아동 정기 양육수당",
    "초등학생 방과 후 돌봄",
    "성인 직무교육비 지원",
  ]) {
    assert.equal(
      matchesInterests({ name } as PublicPolicy, value.interests),
      false,
    );
  }
});
