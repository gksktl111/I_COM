import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { syncPolicies } from "./sync.ts";
import type { PolicyRepository, CurrentPolicy } from "./repository.ts";
import type { Selection } from "./collect.ts";
import type { Row } from "./gov24/probe.ts";

// Authenticated fixture content with synthetic pagination: no live API or remote DB.
const root = "docs/fixtures/gov24/real/";
test("fixture API -> real PostgreSQL RPC: first/repeat/dry-run/partial failure/reprocess", async () => {
  const selected = JSON.parse(
    await readFile("scripts/policy/selection.json", "utf8"),
  ) as Selection[];
  const source = JSON.parse(
    await readFile(root + "selection.json", "utf8"),
  ) as { samples: { id: string; listRecord: Row }[] };
  const data = new Map<
    string,
    { list: Row; detail: Row[]; conditions: Row[] }
  >();
  for (let i = 0; i < source.samples.length; i++) {
    const s = source.samples[i];
    const detail = JSON.parse(
      await readFile(
        `${root}first/request-${String(i * 4 + 1).padStart(3, "0")}.json`,
        "utf8",
      ),
    ).body.data;
    const conditions = JSON.parse(
      await readFile(
        `${root}first/request-${String(i * 4 + 3).padStart(3, "0")}.json`,
        "utf8",
      ),
    ).body.data;
    data.set(s.id, { list: s.listRecord, detail, conditions });
  }
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to service_role;",
    );
    await db.exec(
      await readFile(
        "supabase/migrations/20260907181933_policy_ingestion.sql",
        "utf8",
      ),
    );
    await db.exec("set role service_role");
    const actions: string[] = [];
    const repository: PolicyRepository = {
      async command<T>(action: string, payload: Record<string, unknown>) {
        actions.push(action);
        const result = await db.query<{ value: T }>(
          "select public.policy_sync_command($1,$2::jsonb) as value",
          [action, JSON.stringify(payload)],
        );
        return result.rows[0].value;
      },
    };
    let failId: string | null = null,
      apiCalls = 0;
    const fetcher: typeof fetch = async (input) => {
      apiCalls++;
      const u = new URL(String(input)),
        ep = u.pathname.split("/").at(-1),
        id = u.searchParams.get("cond[서비스ID::EQ]");
      if (ep === "serviceDetail" && id === failId)
        return new Response("{}", { status: 400 });
      const rows =
        ep === "serviceList"
          ? [...data.values()].map((d) => d.list)
          : ep === "serviceDetail"
            ? data.get(id!)!.detail
            : data.get(id!)!.conditions;
      const page = Number(u.searchParams.get("page")),
        perPage = Number(u.searchParams.get("perPage")),
        part = rows.slice((page - 1) * perPage, page * perPage);
      return new Response(
        JSON.stringify({
          page,
          perPage,
          currentCount: part.length,
          matchCount: rows.length,
          totalCount: 100,
          data: part,
        }),
      );
    };
    const options = {
      repository,
      selected,
      dryRun: false,
      trigger: "manual" as const,
      key: "synthetic-key",
      budget: 100,
      perPage: 100,
      maxPages: 20,
      fetcher,
    };
    const first = await syncPolicies(options);
    assert.equal(first.status, "SUCCESS");
    assert.equal(first.items.length, 8);
    const count = async () =>
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from public.policy_source_snapshots",
        )
      ).rows[0].n;
    assert.equal(await count(), 8);
    const repeat = await syncPolicies(options);
    assert.equal(repeat.status, "SUCCESS");
    assert.equal(await count(), 8);
    assert.ok(
      repeat.items.every(
        (i) => !i.changes?.rawChanged && !i.changes?.displayChanged,
      ),
    );
    const rowsBefore = JSON.stringify(
      (
        await db.query(
          "select row_to_json(t) r from public.policy_sync_runs t order by id",
        )
      ).rows,
    );
    const leaseBefore = JSON.stringify(
      (await db.query("select * from public.policy_sync_locks")).rows,
    );
    actions.length = 0;
    const dry = await syncPolicies({ ...options, dryRun: true });
    assert.equal(dry.status, "SUCCESS");
    assert.ok(actions.every((a) => a === "current"));
    assert.equal(
      JSON.stringify(
        (
          await db.query(
            "select row_to_json(t) r from public.policy_sync_runs t order by id",
          )
        ).rows,
      ),
      rowsBefore,
    );
    assert.equal(
      JSON.stringify(
        (await db.query("select * from public.policy_sync_locks")).rows,
      ),
      leaseBefore,
    );
    const id = selected[0].id;
    const current = await repository.command<CurrentPolicy>("current", {
      externalId: id,
    });
    failId = id;
    data.get(selected[1].id)!.detail[0]["지원내용"] =
      "인위적인 변경 검증: 0원 지원, 조건 없음으로 해석하지 않음";
    const partial = await syncPolicies(options);
    assert.equal(partial.status, "PARTIAL");
    assert.equal(partial.items.filter((i) => i.status === "SUCCESS").length, 7);
    assert.equal(
      (await repository.command<CurrentPolicy>("current", { externalId: id }))
        .snapshotId,
      current.snapshotId,
    );
    assert.equal(await count(), 9);
    failId = null;
    const before = apiCalls;
    const reprocess = await syncPolicies({ ...options, trigger: "reprocess" });
    assert.equal(reprocess.status, "SUCCESS");
    assert.equal(apiCalls, before);
    assert.equal(await count(), 9);
  } finally {
    await db.close();
  }
});
