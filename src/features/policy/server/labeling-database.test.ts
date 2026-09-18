import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { normalizeBokji } from "./bokjiro.ts";
import type { BokjiRaw } from "./bokjiro.ts";
import { evaluatePolicyQuality } from "./quality.ts";
import { evaluatePolicyRelevance } from "./relevance.ts";

let db: PGlite;
const provider = "BOKJIRO_CENTRAL";
type Assessment = {
  version: string;
  status: string;
  categories: string[];
  labels: Array<{
    category: string;
    subcategory: string;
    path: string;
    rule: string;
    evidence: Array<{ field: string; excerpt: string }>;
  }>;
  targets: string[];
  reason: string;
};
type Current = {
  source_id: string;
  snapshot_id: string;
  normalized: Record<string, unknown>;
  observation_id: number;
  review_id: number | null;
  assessment: Assessment;
  proposal: Assessment;
};
async function command<T = Record<string, unknown>>(
  action: string,
  payload: object,
): Promise<T> {
  return (
    await db.query<{ value: T }>(
      "select public.policy_sync_command($1,$2::jsonb) as value",
      [action, JSON.stringify({ provider, ...payload })],
    )
  ).rows[0].value;
}
async function admin(sql: string) {
  await db.exec("reset role");
  try {
    await db.exec(sql);
  } finally {
    await db.exec("set role service_role");
  }
}
async function count(table: string) {
  return (
    await db.query<{ n: number }>(
      `select count(*)::int as n from public.${table}`,
    )
  ).rows[0].n;
}
async function current() {
  return (
    await db.query<Current>(
      "select l.*,p.normalized from public.policy_current_labels l join public.policies p using(source_id)",
    )
  ).rows;
}
async function fixture(active = true) {
  const lease = await command<{ runId: string; generation: number }>(
    "auto_start",
    {
      runId: randomUUID(),
      config: { filters: {}, perPage: 2, maxPages: 20, dailyLimit: 20 },
    },
  );
  await command("auto_page", {
    ...lease,
    page: {
      page: 1,
      ids: ["a"],
      total: 1,
      sourceTotal: 1,
      rows: [{ servId: "a" }],
      evidence: [],
      capturedAt: "2026-09-08T00:00:00Z",
    },
  });
  const raw: BokjiRaw = {
    provider,
    apiVersion: "v1",
    externalId: "a",
    list: {
      servId: "a",
      servNm: "아동 보육료 지원",
      servDgst: "보육료 지원",
      servDtlLink:
        "https://www.bokjiro.go.kr/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do?wlfareInfoId=a&wlfareInfoReldBztpCd=01",
    },
    detail: [
      {
        servId: "a",
        servNm: "아동 보육료 지원",
        tgtrDtlCn: "영유아 자녀가 있는 가정",
        alwServCn: "어린이집 보육료를 지원합니다.",
        jurMnofNm: "기관",
      },
    ],
    xml: { list: "<fixture/>", detail: "<fixture/>" },
    evidence: [],
  };
  const normalized = normalizeBokji(raw);
  const { snapshotId } = await command<{ snapshotId: string }>("snapshot", {
    ...lease,
    externalId: "a",
    raw,
    rawHash: normalized.rawHash,
    hashVersion: normalized.hashVersion,
    evidence: [],
  });
  const relevance = evaluatePolicyRelevance(normalized.display);
  assert.equal(relevance.status, "RELATED");
  await command("apply", {
    ...lease,
    externalId: "a",
    snapshotId,
    normalized,
    quality: evaluatePolicyQuality(raw, normalized),
    changes: { displayChanged: true },
    ...(active ? { relevance } : {}),
  });
  const sourceId = (
    await db.query<{ source_id: string }>(
      "select source_id from public.policies",
    )
  ).rows[0].source_id;
  return { sourceId, snapshotId, normalized, relevance };
}
async function store(f: Awaited<ReturnType<typeof fixture>>) {
  return command("relevance_store", {
    sourceId: f.sourceId,
    snapshotId: f.snapshotId,
    displayHash: f.normalized.displayHash,
    normalizerVersion: f.normalized.normalizerVersion,
    relevance: f.relevance,
  });
}
function reviewPayload(row: Current) {
  return {
    observationId: row.observation_id,
    reviewKey: randomUUID(),
    expectedReviewId: row.review_id,
    expectedSnapshotId: row.snapshot_id,
    expectedNormalized: row.normalized,
    reviewer: "fixture-reviewer",
    reviewKind: "HUMAN",
    reason: "원문 지원 내용 확인",
    assessment: { ...structuredClone(row.proposal), status: "VERIFIED" },
  };
}
async function review(payload: ReturnType<typeof reviewPayload>) {
  return db.query("select public.policy_review_labels($1::jsonb)", [
    JSON.stringify(payload),
  ]);
}

before(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon,authenticated,service_role;",
  );
  for (const migration of [
    "20260907181933_policy_ingestion",
    "20260907192856_policy_multiple_providers",
    "20260908053334_policy_automatic_quality",
    "20260908073708_policy_relevance",
    "20260908075211_policy_scope_exclusion",
    "20260908080358_policy_catalog_disposition",
    "20260908082550_policy_relevance_v2",
    "20260908091150_policy_relevance_v3",
    "20260908120844_policy_interest_labeling",
    "20260911141935_policy_review_activation",
    "20260911145539_policy_review_disposition",
    "20260911150947_policy_review_pending_notes",
    "20260911152220_policy_review_correction",
  ]) {
    await db.exec(
      await readFile(
        new URL(
          `../../../../supabase/migrations/${migration}.sql`,
          import.meta.url,
        ),
        "utf8",
      ),
    );
  }
});
beforeEach(async () => {
  await admin(
    "truncate public.policy_label_reviews,public.policy_label_observations,public.policy_relevance_observations,public.policy_auto_jobs,public.policy_auto_pages,public.policy_api_daily_usage,public.policy_quality_observations,public.policy_sources,public.policy_source_snapshots,public.policies,public.policy_sync_runs,public.policy_sync_items,public.policy_sync_locks; insert into public.policy_sync_locks(name) values ('GOV24'),('BOKJIRO_CENTRAL'),('BOKJIRO_LOCAL');",
  );
});
after(async () => {
  await db?.close();
});

test("review activation creates label proposals without claiming human verification", async () => {
  const f = await fixture(false);
  const payload = {
    sourceId: f.sourceId, snapshotId: f.snapshotId,
    displayHash: f.normalized.displayHash,
    normalizerVersion: f.normalized.normalizerVersion,
    reviewOnly: true, expectedNormalized: f.normalized, previousRelevance: null,
    relevance: { ...f.relevance, version: "policy-relevance-review-1",
      evidence: [{ field: "target_text", excerpt: "영유아 자녀가 있는 가정", rule: "영유아 보육 지원 대상 확인" }] },
  };
  await command("relevance_store", payload);
  const [row] = await current();
  assert.equal(row.assessment.status, "PROPOSED");
  assert.ok(row.assessment.labels.length > 0);
  assert.equal(row.review_id, null);
  assert.equal(await count("policy_label_reviews"), 0);
  await command("relevance_store", payload);
  assert.equal(await count("policy_label_observations"), 1);
  assert.deepEqual(await current(), [row]);
});

test("apply and relevance activation immediately create proposals and backfill is idempotent", async () => {
  const f = await fixture(false);
  assert.equal(await count("policy_label_observations"), 0);
  assert.deepEqual(await current(), []);
  await store(f);
  const [row] = await current();
  assert.equal(row.assessment.status, "PROPOSED");
  assert.ok(row.assessment.labels.length > 0);
  assert.equal(row.review_id, null);
  await db.query("select public.policy_label_backfill(null,100)");
  await db.query("select public.policy_label_backfill(null,100)");
  await store(f);
  assert.equal(await count("policy_label_observations"), 1);
  assert.deepEqual(await current(), [row]);
});

test("apply and direct policy insert/update cannot bypass automatic labeling", async () => {
  await fixture(true);
  assert.equal((await current())[0].assessment.status, "PROPOSED");
  await admin(
    "truncate public.policy_label_reviews,public.policy_label_observations;",
  );
  await db.query("update public.policies set relevance=relevance");
  assert.equal(await count("policy_label_observations"), 1);
  await admin(
    "truncate public.policy_label_reviews,public.policy_label_observations;",
  );
  const saved = (
    await db.query<{
      source_id: string;
      applied_snapshot_id: string;
      normalized: unknown;
      relevance: unknown;
    }>(
      "select source_id,applied_snapshot_id,normalized,relevance from public.policies",
    )
  ).rows[0];
  await admin(
    "truncate public.policies,public.policy_relevance_observations,public.policy_label_observations,public.policy_label_reviews;",
  );
  await db.query(
    "insert into public.policies(source_id,applied_snapshot_id,normalized,relevance) values($1,$2,$3,$4)",
    [
      saved.source_id,
      saved.applied_snapshot_id,
      JSON.stringify(saved.normalized),
      JSON.stringify(saved.relevance),
    ],
  );
  assert.equal((await current())[0].assessment.status, "PROPOSED");
});

test("reviews are explicit and idempotent; invalid taxonomy, evidence and conflicting keys fail", async () => {
  await fixture();
  const [row] = await current();
  const valid = reviewPayload(row);
  await review(valid);
  await review(valid);
  assert.equal(await count("policy_label_reviews"), 1);
  assert.equal((await current())[0].assessment.status, "VERIFIED");
  assert.equal((await current())[0].proposal.status, "PROPOSED");
  row.review_id = (await current())[0].review_id;
  await assert.rejects(
    review({ ...valid, reviewKey: randomUUID() }),
    /LABEL_REVIEW_CONFLICT/,
  );
  const invalid = [
    { ...valid, reason: "conflicting retry" },
    {
      ...reviewPayload(row),
      assessment: { ...valid.assessment, categories: ["invented"] },
    },
    {
      ...reviewPayload(row),
      assessment: { ...valid.assessment, categories: [], labels: [] },
    },
    { ...reviewPayload(row), reviewKind: "AUTOMATIC" },
  ];
  for (const field of ["subcategory", "category"] as const) {
    const payload = reviewPayload(row);
    payload.assessment.labels[0][field] = "invented";
    invalid.push(payload);
  }
  const missingCategory = reviewPayload(row);
  delete (
    missingCategory.assessment.labels[0] as Partial<
      (typeof missingCategory.assessment.labels)[0]
    >
  ).category;
  invalid.push(missingCategory);
  const invented = reviewPayload(row);
  invented.assessment.labels[0].evidence[0].excerpt = "원문에 없는 허구 근거";
  invalid.push(invented);
  for (const payload of invalid)
    await assert.rejects(review(payload), /LABEL|REVIEW/);
  assert.equal(await count("policy_label_reviews"), 1);
  const ai = { ...reviewPayload(row), reviewKind: "AI_ASSISTED" };
  await review(ai);
  assert.equal(await count("policy_label_reviews"), 2);
});

for (const change of [
  "normalizer",
  "display",
  "content",
  "snapshot",
] as const) {
  test(`${change} identity changes hide old labels and never inherit historical reviews`, async () => {
    const f = await fixture();
    const [old] = await current();
    await review(reviewPayload(old));
    if (change === "snapshot") {
      await db.query(
        "insert into public.policy_source_snapshots(source_id,raw_hash,hash_version,raw) select source_id,raw_hash||'-new',hash_version,raw from public.policy_source_snapshots",
      );
      const next = (
        await db.query<{ id: string }>(
          "select id from public.policy_source_snapshots where id<>$1",
          [f.snapshotId],
        )
      ).rows[0].id;
      await db.query("update public.policies set applied_snapshot_id=$1", [
        next,
      ]);
    } else if (change === "content") {
      await db.query(
        "update public.policies set normalized=jsonb_set(normalized,'{display,benefit_text}',$1::jsonb)",
        [JSON.stringify("changed source without updating supplied hash")],
      );
    } else {
      await db.query(
        "update public.policies set normalized=jsonb_set(normalized,$1::text[],$2::jsonb)",
        [
          [change === "normalizer" ? "normalizerVersion" : "displayHash"],
          JSON.stringify("changed-identity"),
        ],
      );
    }
    assert.deepEqual(await current(), []);
    await assert.rejects(review(reviewPayload(old)), /STALE/);
    await db.query("update public.policies set relevance=$1::jsonb", [
      JSON.stringify(f.relevance),
    ]);
    const [fresh] = await current();
    assert.notEqual(fresh.observation_id, old.observation_id);
    assert.equal(fresh.review_id, null);
    assert.equal(
      fresh.assessment.status,
      change === "content" ? "NEEDS_REVIEW" : "PROPOSED",
    );
    assert.equal(await count("policy_label_observations"), 2);
    assert.equal(await count("policy_label_reviews"), 1);
  });
}

test("inactive sources disappear from CURRENT while immutable history survives", async () => {
  await fixture();
  const [row] = await current();
  await review(reviewPayload(row));
  await db.query(
    "update public.policies set relevance=jsonb_set(relevance,'{status}','\"UNRELATED\"')",
  );
  assert.deepEqual(await current(), []);
  await assert.rejects(review(reviewPayload(row)), /STALE|INACTIVE/);
  await db.query("select public.policy_label_backfill(null,100)");
  assert.equal(await count("policy_label_observations"), 1);
  assert.equal(await count("policy_label_reviews"), 1);
  for (const table of ["policy_label_observations", "policy_label_reviews"]) {
    await assert.rejects(
      db.query(`update public.${table} set assessment='{}'`),
      /permission denied/,
    );
    await assert.rejects(
      db.query(`delete from public.${table}`),
      /permission denied/,
    );
  }
});

test("anon and authenticated have no label table, view or RPC access", async () => {
  await fixture();
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`reset role; set role ${role}`);
    for (const relation of [
      "policy_label_observations",
      "policy_label_reviews",
      "policy_current_labels",
    ]) {
      await assert.rejects(
        db.query(`select * from public.${relation}`),
        /permission denied/,
      );
    }
    for (const sql of [
      "select public.policy_review_labels('{}')",
      "select public.policy_label_backfill(null,100)",
      "select public.policy_assign_labels(null)",
      "select public.policy_evaluate_labels('{}')",
    ]) {
      await assert.rejects(db.query(sql), /permission denied/);
    }
  }
  await db.exec("reset role; set role service_role");
  assert.equal((await current()).length, 1);
});

test("a real label trigger failure rolls back relevance activation and its observation", async () => {
  const f = await fixture(false);
  await admin(
    "create function public.fail_label_fixture() returns trigger language plpgsql as $$ begin raise exception 'FIXTURE_LABEL_FAILURE'; end $$; create trigger fail_label_fixture before insert on public.policy_label_observations for each row execute function public.fail_label_fixture();",
  );
  try {
    await assert.rejects(store(f), /FIXTURE_LABEL_FAILURE/);
    assert.equal(
      (
        await db.query<{ catalog_status: string }>(
          "select catalog_status from public.policies",
        )
      ).rows[0].catalog_status,
      "REVIEW",
    );
    assert.equal(await count("policy_relevance_observations"), 0);
    assert.equal(await count("policy_label_observations"), 0);
  } finally {
    await admin(
      "drop trigger fail_label_fixture on public.policy_label_observations; drop function public.fail_label_fixture();",
    );
  }
  await store(f);
  assert.equal((await current())[0].assessment.status, "PROPOSED");
});

test("six-interest boundary examples evaluate from actual benefit and target evidence", async () => {
  const cases = JSON.parse(
    await readFile(
      new URL(
        "../../../../docs/fixtures/policy-labeling/rule-cases.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as Array<{ name: string; display: object; expectedCategories: string[] }>;
  for (const item of cases) {
    const result = await db.query<{ assessment: { categories: string[] } }>(
      "select public.policy_evaluate_labels($1::jsonb) assessment",
      [JSON.stringify(item.display)],
    );
    assert.deepEqual(
      result.rows[0].assessment.categories.toSorted(),
      item.expectedCategories.toSorted(),
      item.name,
    );
  }
});

test("direct review inserts cannot bypass evidence validation or revision conflicts", async () => {
  await fixture();
  const [row] = await current();
  const insert = (assessment: object) =>
    db.query(
      "insert into public.policy_label_reviews(observation_id,review_key,reviewer,review_kind,reason,assessment) values($1,$2,'fixture','AI_ASSISTED','direct insertion',$3)",
      [row.observation_id, randomUUID(), JSON.stringify(assessment)],
    );
  await assert.rejects(
    insert({
      ...row.proposal,
      status: "VERIFIED",
      categories: ["invented"],
      labels: [],
    }),
    /INVALID_LABEL/,
  );
  assert.equal(await count("policy_label_reviews"), 0);
  await insert({ ...row.proposal, status: "VERIFIED" });
  await assert.rejects(
    insert({ ...row.proposal, status: "VERIFIED" }),
    /LABEL_REVIEW_CONFLICT/,
  );
});

test("an original review bundle cannot be rebound to a refreshed observation with identical display", async () => {
  await fixture();
  const [old] = await current();
  const payload = reviewPayload(old);
  await db.query(
    "update public.policies set normalized=jsonb_set(normalized,'{normalizerVersion}','\"new-normalizer\"')",
  );
  await db.query("update public.policies set relevance=$1", [
    JSON.stringify(
      evaluatePolicyRelevance(
        (old.normalized as { display: Record<string, unknown> }).display,
      ),
    ),
  ]);
  const [fresh] = await current();
  await assert.rejects(
    review({ ...payload, observationId: fresh.observation_id }),
    /STALE_LABEL_REVIEW/,
  );
  assert.equal(await count("policy_label_reviews"), 0);
});
