import assert from "node:assert/strict";
import { test } from "node:test";
import { runAutomatic } from "./automatic.ts";
import { createAutomaticSource } from "./automatic-source.ts";
import { normalizeBundle } from "./normalize.ts";
import type { RawBundle } from "./normalize.ts";
import type { AutomaticOptions } from "./automatic.ts";
import type { SourcePage } from "./automatic-source.ts";
import type { PolicyRepository } from "./repository.ts";

function setup(total = 12) {
  const pages = new Map<number, SourcePage>();
  const success = new Set<string>();
  const events: { action: string; payload: Record<string, unknown> }[] = [];
  const requests: URL[] = [];
  let next = 1,
    complete = false,
    reserved = 0;
  const control = {
    daily: Infinity,
    failId: "",
    drift: false,
    storageFail: "",
    title: "test",
    target: "",
  };
  const repository: PolicyRepository = {
    async command<T>(action: string, payload: Record<string, unknown>) {
      events.push({ action, payload });
      assert.equal(payload.provider, options.provider);
      if (action === control.storageFail)
        throw new Error("storage-unavailable");
      let result: unknown = {};
      if (action === "auto_start")
        result = { runId: "run-1", generation: 1, status: "RUNNING" };
      if (action === "auto_state") {
        const page =
          [...pages.values()].find((p) =>
            p.ids.some((id) => !success.has(id)),
          ) ?? null;
        result = {
          run: { status: "RUNNING", calls: reserved },
          job: {
            config: {},
            next_page: next,
            expected_total: pages.size ? total : null,
            discovery_complete: complete,
          },
          page,
          pendingIds: page?.ids.filter((id) => !success.has(id)) ?? [],
        };
      }
      if (action === "auto_reserve") {
        const allowed = reserved < control.daily;
        if (allowed) reserved++;
        result = { allowed, reason: allowed ? undefined : "DAILY_BUDGET" };
      }
      if (action === "auto_page" || action === "auto_refresh") {
        const page = payload.page as SourcePage;
        pages.set(page.page, page);
        if (action === "auto_page") {
          assert.equal(page.page, next);
          next++;
          complete = page.ids.length === 0;
        }
      }
      if (action === "current") result = null;
      if (action === "snapshot")
        result = { snapshotId: `snapshot-${payload.externalId}` };
      if (
        action === "apply" ||
        action === "auto_exclude" ||
        action === "auto_skip_existing"
      )
        success.add(String(payload.externalId));
      if (action === "finish") {
        assert.equal(complete, true);
        assert.equal(success.size, total);
        assert.equal(payload.calls, 0);
        result = { status: "SUCCESS" };
      }
      return result as T;
    },
  };
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    assert.equal(
      reserved,
      requests.length,
      "attempt must be reserved before fetch",
    );
    const endpoint = url.pathname.split("/").at(-1);
    const id = url.searchParams.get("cond[서비스ID::EQ]") ?? "0";
    if (endpoint === "serviceDetail" && id === control.failId)
      return new Response("secret upstream content", { status: 400 });
    const row = (externalId: string) => ({
      서비스ID: externalId,
      서비스명: control.title,
      수정일시: "20260907000000",
    });
    const all =
      endpoint === "serviceList"
        ? Array.from({ length: total }, (_, i) =>
            row(control.drift && i === 0 ? "changed" : String(i)),
          )
        : endpoint === "serviceDetail"
          ? [{ ...row(id), 수정일시: "2026-09-07", 지원대상: control.target }]
          : [{ 서비스ID: id, JA0110: 0 }];
    const page = Number(url.searchParams.get("page"));
    const perPage = Number(url.searchParams.get("perPage"));
    const data = all.slice((page - 1) * perPage, page * perPage);
    return new Response(
      JSON.stringify({
        page,
        perPage,
        currentCount: data.length,
        matchCount: all.length,
        totalCount: Math.max(total, all.length),
        data,
      }),
    );
  };
  const options: AutomaticOptions = {
    provider: "GOV24",
    filters: {},
    key: "synthetic-key",
    perPage: 6,
    maxPages: 10,
    dailyLimit: 1000,
    callBudget: 100,
    repository,
    fetcher,
  };
  return { options, control, events, requests, success, pages };
}

test("automatically discovers more than ten IDs, attaches quality, and validates terminal coverage", async () => {
  const s = setup();
  const result = await runAutomatic(s.options);
  assert.equal(result.status, "SUCCESS");
  assert.equal(result.processed, 12);
  assert.equal(s.success.size, 12);
  assert.equal(result.calls, s.requests.length);
  assert.deepEqual(
    s.events.find((e) => e.action === "auto_start")?.payload.config,
    { filters: {}, perPage: 6, maxPages: 10, dailyLimit: 1000 },
  );
  assert.ok(
    s.events
      .filter((e) => e.action === "apply")
      .every((e) => e.payload.quality),
  );
  assert.equal(s.events.filter((e) => e.action === "auto_page").length, 3);
});

test("item pause resumes only unfinished items and refreshes the saved page once", async () => {
  const s = setup();
  const first = await runAutomatic({ ...s.options, maxItems: 2 });
  assert.equal(first.reason, "ITEM_LIMIT");
  const boundary = s.requests.length;
  const second = await runAutomatic({ ...s.options, resumeRunId: first.runId });
  assert.equal(second.status, "SUCCESS");
  assert.equal(second.processed, 10);
  assert.equal(s.events.filter((e) => e.action === "auto_refresh").length, 1);
  assert.ok(
    s.requests
      .slice(boundary)
      .filter((u) => u.pathname.endsWith("serviceDetail"))
      .every(
        (u) => !["0", "1"].includes(u.searchParams.get("cond[서비스ID::EQ]")!),
      ),
  );
});

test("call cap stops in the middle of a detail bundle without failing that policy or sending another request", async () => {
  const s = setup();
  const result = await runAutomatic({ ...s.options, callBudget: 3 });
  assert.equal(result.reason, "CALL_BUDGET");
  assert.equal(result.calls, 3);
  assert.equal(s.requests.length, 3);
  assert.equal(
    s.events.some((e) => e.action === "fail" || e.action === "finish"),
    false,
  );
});

test("daily quota refusal pauses before another network attempt", async () => {
  const s = setup();
  s.control.daily = 2;
  const result = await runAutomatic(s.options);
  assert.equal(result.reason, "DAILY_BUDGET");
  assert.equal(s.requests.length, 2);
  assert.equal(
    s.events.some((e) => e.action === "fail"),
    false,
  );
});

test("failed detail stores a controlled quality failure and never finishes incomplete discovery", async () => {
  const s = setup(2);
  s.control.failId = "0";
  const result = await runAutomatic(s.options);
  assert.equal(result.reason, "UPSTREAM_ERROR");
  assert.deepEqual([...s.success], ["1"]);
  const failed = s.events.find((e) => e.action === "fail")!;
  assert.equal(failed.payload.errorCode, "COLLECTION_OR_NORMALIZATION_FAILED");
  assert.ok(failed.payload.quality);
  assert.equal(
    s.events.some((e) => e.action === "finish"),
    false,
  );
});

test("saved-page drift prevents refresh persistence and further detail collection", async () => {
  const s = setup();
  await runAutomatic({ ...s.options, maxItems: 1 });
  s.control.drift = true;
  const boundary = s.requests.length;
  const result = await runAutomatic({ ...s.options, resumeRunId: "run-1" });
  assert.equal(result.reason, "SOURCE_DRIFT");
  assert.equal(s.requests.length - boundary, 1);
  assert.equal(
    s.events.some((e) => e.action === "auto_refresh"),
    false,
  );
});

test("page limit includes the required terminal page and never implies success", async () => {
  const s = setup(2);
  const result = await runAutomatic({ ...s.options, maxPages: 1 });
  assert.equal(result.reason, "PAGE_LIMIT");
  assert.equal(s.success.size, 2);
  assert.equal(
    s.events.some((e) => e.action === "finish"),
    false,
  );
});

test("application storage failure stops without fabricating a source failure", async () => {
  const s = setup(2);
  s.control.storageFail = "apply";
  await assert.rejects(runAutomatic(s.options), /automatic-storage-failed/);
  assert.equal(
    s.events.some((e) => e.action === "fail" || e.action === "finish"),
    false,
  );
});

test("invalid limits are rejected before any storage or upstream work", async () => {
  const s = setup();
  await assert.rejects(
    runAutomatic({ ...s.options, dailyLimit: 0 }),
    /invalid-automatic-limits/,
  );
  assert.equal(s.events.length, 0);
  assert.equal(s.requests.length, 0);
});

test("reservation storage failure propagates before fetch and is never recorded as an item failure", async () => {
  const s = setup(2);
  s.control.storageFail = "auto_reserve";
  await assert.rejects(runAutomatic(s.options), /automatic-storage-failed/);
  assert.equal(s.requests.length, 0);
  assert.equal(
    s.events.some((e) => e.action === "fail" || e.action === "auto_pause"),
    false,
  );
});

test("quality ERROR retains the source snapshot and evaluated issues without replacing current display", async () => {
  const s = setup(1);
  const previousRaw: RawBundle = {
    externalId: "0",
    apiVersion: "v3",
    list: { 서비스ID: "0", 서비스명: "test", 수정일시: "20260907000000" },
    detail: [
      {
        서비스ID: "0",
        서비스명: "test",
        수정일시: "2026-09-07",
        지원대상: "Existing target text",
      },
    ],
    conditions: [{ 서비스ID: "0", JA0110: 0 }],
    evidence: [],
  };
  const previous = {
    raw: previousRaw,
    normalized: normalizeBundle(previousRaw),
    snapshotId: "previous",
  };
  let displayed = previous.normalized;
  const command = s.options.repository.command.bind(s.options.repository);
  s.options.repository = {
    async command<T>(action: string, payload: Record<string, unknown>) {
      if (action === "current") return previous as T;
      if (action === "apply")
        displayed = payload.normalized as typeof displayed;
      return command<T>(action, payload);
    },
  };
  s.options.sourceFactory = (...args) => {
    const source = createAutomaticSource(...args);
    return {
      ...source,
      async detail(page, id) {
        const raw = await source.detail(page, id);
        // Nonempty markup has no retained display content: a real evaluator ERROR.
        raw.detail[0].지원대상 = "<p></p>";
        return raw;
      },
    };
  };
  const result = await runAutomatic(s.options);
  assert.equal(result.reason, "UPSTREAM_ERROR");
  assert.equal(displayed, previous.normalized);
  assert.equal(displayed.display.target_text, "Existing target text");
  assert.equal(
    s.events.some((e) => e.action === "apply"),
    false,
  );
  const snapshot = s.events.find((e) => e.action === "snapshot")!;
  assert.equal(
    (snapshot.payload.raw as RawBundle).detail[0].지원대상,
    "<p></p>",
  );
  const failed = s.events.find((e) => e.action === "fail")!;
  assert.equal(failed.payload.errorCode, "QUALITY_ASSESSMENT_FAILED");
  const quality = failed.payload.quality as {
    status: string;
    issues: { code: string; field: string }[];
  };
  assert.equal(quality.status, "ERROR");
  assert.ok(
    quality.issues.some(
      (i) => i.code === "DISPLAY_CONTENT_LOST" && i.field === "target_text",
    ),
  );
  assert.equal(
    s.events.some((e) => e.action === "finish"),
    false,
  );
});

test("unrelated listing titles complete without detail, snapshots, or application", async () => {
  const s = setup(2);
  s.control.title = "어업 장비 구입 지원";
  const result = await runAutomatic(s.options);
  assert.equal(result.status, "SUCCESS");
  assert.equal(result.processed, 2);
  assert.equal(result.calls, 2);
  assert.ok(s.requests.every((url) => url.pathname.endsWith("serviceList")));
  assert.equal(
    s.events.some((e) => ["snapshot", "apply", "fail"].includes(e.action)),
    false,
  );
  const excluded = s.events.filter((e) => e.action === "auto_exclude");
  assert.equal(excluded.length, 2);
  assert.equal(excluded[0].payload.phase, "LIST");
  assert.equal(excluded[0].payload.page, 1);
  assert.equal(excluded[0].payload.runId, "run-1");
  assert.equal(excluded[0].payload.generation, 1);
  assert.equal(
    (excluded[0].payload.relevance as { status: string }).status,
    "UNRELATED",
  );
});

test("ambiguous titles use detail evidence to exclude and retain the source snapshot", async () => {
  const s = setup(1);
  s.control.target = "노인 전용 지원";
  const result = await runAutomatic(s.options);
  assert.equal(result.status, "SUCCESS");
  assert.ok(s.requests.some((url) => url.pathname.endsWith("serviceDetail")));
  const excluded = s.events.find((e) => e.action === "auto_exclude")!;
  assert.equal(excluded.payload.phase, "DETAIL");
  assert.equal(excluded.payload.snapshotId, "snapshot-0");
  assert.ok(
    s.events.findIndex((e) => e.action === "snapshot") <
      s.events.indexOf(excluded),
  );
  assert.equal(
    s.events.some((e) => e.action === "apply"),
    false,
  );
});

test("uncertain relevance remains collected for review", async () => {
  const s = setup(1);
  const result = await runAutomatic(s.options);
  assert.equal(result.status, "SUCCESS");
  assert.ok(s.events.some((e) => e.action === "apply"));
  assert.equal(
    s.events.some((e) => e.action === "auto_exclude"),
    false,
  );
});

test("existing related policies still refresh when the source becomes unrelated", async () => {
  const s = setup(1);
  s.control.title = "어업 장비 구입 지원";
  const raw: RawBundle = {
    externalId: "0",
    apiVersion: "v3",
    list: { 서비스ID: "0", 서비스명: "아동수당", 수정일시: "20260907000000" },
    detail: [{ 서비스ID: "0", 서비스명: "아동수당", 수정일시: "2026-09-07" }],
    conditions: [{ 서비스ID: "0", JA0110: 0 }],
    evidence: [],
  };
  const command = s.options.repository.command.bind(s.options.repository);
  s.options.repository = {
    async command<T>(action: string, payload: Record<string, unknown>) {
      if (action === "current")
        return {
          raw,
          normalized: normalizeBundle(raw),
          snapshotId: "old",
        } as T;
      return command<T>(action, payload);
    },
  };
  const result = await runAutomatic({ ...s.options, mode: "refresh" });
  assert.equal(result.status, "SUCCESS");
  assert.ok(s.requests.some((url) => url.pathname.endsWith("serviceDetail")));
  assert.ok(s.events.some((e) => e.action === "apply"));
  assert.equal(
    s.events.some((e) => e.action === "auto_exclude"),
    false,
  );
});

test("resumed unrelated titles still require unchanged page coverage before exclusion", async () => {
  const s = setup(2);
  s.control.title = "기초연금";
  const first = await runAutomatic({ ...s.options, maxItems: 1 });
  assert.equal(first.reason, "ITEM_LIMIT");
  s.control.drift = true;
  const boundary = s.events.length;
  const result = await runAutomatic({ ...s.options, resumeRunId: "run-1" });
  assert.equal(result.reason, "SOURCE_DRIFT");
  assert.equal(
    s.events.slice(boundary).some((e) => e.action === "auto_exclude"),
    false,
  );
});

test("exclusion storage failure stops without recording a source failure", async () => {
  const s = setup(1);
  s.control.title = "기초연금";
  s.control.storageFail = "auto_exclude";
  await assert.rejects(runAutomatic(s.options), /automatic-storage-failed/);
  assert.equal(s.success.size, 0);
  assert.equal(
    s.events.some((e) => ["fail", "finish", "auto_pause"].includes(e.action)),
    false,
  );
});

test("Bokjiro listing titles use servNm for early exclusion", async () => {
  const s = setup(1);
  s.options.provider = "BOKJIRO_CENTRAL";
  s.options.sourceFactory = (config, ...args) => {
    const source = createAutomaticSource(
      { ...config, provider: "GOV24" },
      ...args,
    );
    return {
      ...source,
      async page(number) {
        const page = await source.page(number);
        return {
          ...page,
          rows: page.rows.map((row) => ({
            servId: row.서비스ID,
            servNm: "기초연금",
          })),
        };
      },
      async detail() {
        throw new Error("unrelated Bokjiro listing must not fetch detail");
      },
    };
  };
  const result = await runAutomatic(s.options);
  assert.equal(result.status, "SUCCESS");
  assert.equal(
    s.events.find((e) => e.action === "auto_exclude")?.payload.phase,
    "LIST",
  );
  assert.equal(
    s.events.some((e) => e.action === "fail" || e.action === "apply"),
    false,
  );
});

test("new-only skips stored policies without detail calls and resumes remaining new policies", async () => {
  const s = setup(3);
  const command = s.options.repository.command.bind(s.options.repository);
  s.options.repository = {
    async command<T>(action: string, payload: Record<string, unknown>) {
      if (action === "current" && payload.externalId === "0")
        return { snapshotId: "existing" } as T;
      return command<T>(action, payload);
    },
  };
  const first = await runAutomatic({
    ...s.options,
    mode: "new-only",
    maxItems: 1,
  });
  assert.equal(first.reason, "ITEM_LIMIT");
  assert.equal(first.calls, 1, "only list discovery consumes upstream budget");
  assert.deepEqual(
    s.events.find((e) => e.action === "auto_skip_existing")?.payload,
    {
      runId: "run-1",
      generation: 1,
      externalId: "0",
      page: 1,
      provider: "GOV24",
    },
  );
  const second = await runAutomatic({
    ...s.options,
    mode: "new-only",
    resumeRunId: first.runId,
  });
  assert.equal(second.status, "SUCCESS");
  const details = s.requests.filter((u) =>
    u.pathname.endsWith("serviceDetail"),
  );
  assert.deepEqual(
    [...new Set(details.map((u) => u.searchParams.get("cond[서비스ID::EQ]")))],
    ["1", "2"],
  );
  assert.equal(
    s.events.filter((e) => e.action === "auto_skip_existing").length,
    1,
  );
  assert.equal(s.events.filter((e) => e.action === "apply").length, 2);
  assert.equal(
    s.events.some(
      (e) =>
        ["snapshot", "apply", "auto_exclude"].includes(e.action) &&
        e.payload.externalId === "0",
    ),
    false,
  );
});

test("failure to persist an existing-policy skip stops before any detail request", async () => {
  const s = setup(1);
  s.control.storageFail = "auto_skip_existing";
  const command = s.options.repository.command.bind(s.options.repository);
  s.options.repository = {
    async command<T>(action: string, payload: Record<string, unknown>) {
      if (action === "current") return { snapshotId: "existing" } as T;
      return command<T>(action, payload);
    },
  };
  await assert.rejects(
    runAutomatic({ ...s.options, mode: "new-only" }),
    /automatic-storage-failed/,
  );
  assert.equal(s.requests.length, 1);
  assert.equal(s.success.size, 0);
});
