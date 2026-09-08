import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { runAutomatic } from "./automatic.ts";
import type { AutomaticOptions } from "./automatic.ts";
import type { PolicyRepository } from "./repository.ts";

const provider = "BOKJIRO_CENTRAL";
const fixture = (name: string) =>
  readFile(
    new URL(
      `../../../../docs/fixtures/bokjiro/real/${name}.xml`,
      import.meta.url,
    ),
    "utf8",
  );

test("real Bokjiro XML and PostgreSQL RPC preserve automatic cursors, quotas, snapshots and quarantined quality across resume", async () => {
  const ids = ["WLF00000024", "WLF00000030"];
  const [list, ...detailFiles] = await Promise.all([
    fixture("central-childcare-list"),
    ...ids.map((id) => fixture(`central-${id}-detail`)),
  ]);
  const blocks = list.match(/<servList>[\s\S]*?<\/servList>/g) ?? [];
  const rows = ids.map((id) => {
    const block = blocks.find((value) =>
      value.includes(`<servId>${id}</servId>`),
    );
    assert.ok(block);
    return block;
  });
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated, service_role;",
    );
    for (const migration of [
      "20260907181933_policy_ingestion",
      "20260907192856_policy_multiple_providers",
      "20260908053334_policy_automatic_quality",
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
    await db.exec("set role service_role");
    const actions: string[] = [];
    const repository: PolicyRepository = {
      async command<T>(
        action: string,
        payload: Record<string, unknown>,
      ): Promise<T> {
        actions.push(action);
        const result = await db.query<{ value: T }>(
          "select public.policy_sync_command($1,$2::jsonb) as value",
          [action, JSON.stringify(payload)],
        );
        return result.rows[0].value;
      },
    };
    const requests: URL[] = [];
    let badQuality = false;
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      const quota = await db.query<{ reserved_calls: number }>(
        "select reserved_calls from public.policy_api_daily_usage where provider=$1",
        [provider],
      );
      assert.equal(
        quota.rows[0].reserved_calls,
        requests.length,
        "database quota must reserve each attempt before fetch",
      );
      const id = url.searchParams.get("servId");
      if (id) {
        const index = ids.indexOf(id);
        assert.notEqual(index, -1);
        let xml = detailFiles[index];
        if (badQuality && id === ids[0]) {
          assert.match(xml, /<tgtrDtlCn>[\s\S]*?<\/tgtrDtlCn>/);
          xml = xml.replace(
            /<tgtrDtlCn>[\s\S]*?<\/tgtrDtlCn>/,
            "<tgtrDtlCn><![CDATA[<p></p>]]></tgtrDtlCn>",
          );
        }
        return new Response(xml);
      }
      const page = Number(url.searchParams.get("pageNo"));
      assert.equal(url.searchParams.get("numOfRows"), "1");
      return new Response(
        `<wantedList><resultCode>0</resultCode><resultMessage>NORMAL SERVICE</resultMessage><pageNo>${page}</pageNo><numOfRows>1</numOfRows><totalCount>2</totalCount>${rows[page - 1] ?? ""}</wantedList>`,
      );
    };
    const options: AutomaticOptions = {
      provider,
      filters: { searchWrd: "양육" },
      perPage: 1,
      maxPages: 10,
      dailyLimit: 1000,
      callBudget: 100,
      key: "fixture-key",
      repository,
      fetcher,
    };
    const savedRun = async (runId: string) =>
      (
        await db.query<{
          status: string;
          calls: number;
          next_page: number;
          discovery_complete: boolean;
        }>(
          "select r.status,r.calls,j.next_page,j.discovery_complete from public.policy_sync_runs r join public.policy_auto_jobs j on j.run_id=r.id where r.id=$1",
          [runId],
        )
      ).rows[0];
    const countSnapshots = async () =>
      (
        await db.query<{ n: number }>(
          "select count(*)::integer n from public.policy_source_snapshots",
        )
      ).rows[0].n;
    const current = () =>
      repository.command("current", { provider, externalId: ids[0] });

    const paused = await runAutomatic({ ...options, maxItems: 1 });
    assert.equal(paused.reason, "ITEM_LIMIT");
    assert.equal(paused.calls, 2);
    assert.equal(paused.processed, 1);
    assert.deepEqual(await savedRun(paused.runId), {
      status: "PARTIAL",
      calls: 2,
      next_page: 2,
      discovery_complete: false,
    });
    const boundary = requests.length;
    const resumed = await runAutomatic({
      ...options,
      resumeRunId: paused.runId,
    });
    assert.equal(resumed.runId, paused.runId);
    assert.equal(resumed.status, "SUCCESS");
    assert.equal(resumed.processed, 1);
    assert.equal(resumed.calls, 3);
    assert.deepEqual(
      requests
        .slice(boundary)
        .filter((u) => u.searchParams.has("servId"))
        .map((u) => u.searchParams.get("servId")),
      [ids[1]],
    );
    assert.deepEqual(await savedRun(resumed.runId), {
      status: "SUCCESS",
      calls: 5,
      next_page: 4,
      discovery_complete: true,
    });
    assert.equal(await countSnapshots(), 2);
    const applied = await current();

    const repeat = await runAutomatic(options);
    assert.equal(repeat.status, "SUCCESS");
    assert.equal(repeat.calls, 5);
    assert.equal(
      await countSnapshots(),
      2,
      "identical provider snapshots deduplicate across runs",
    );
    assert.deepEqual(await current(), applied);

    badQuality = true;
    const quarantine = await runAutomatic(options);
    assert.equal(quarantine.reason, "UPSTREAM_ERROR");
    assert.equal(quarantine.calls, 2);
    assert.equal(
      await countSnapshots(),
      3,
      "quarantined source remains available as a snapshot",
    );
    assert.deepEqual(
      await current(),
      applied,
      "quality ERROR preserves the previously applied policy",
    );
    const failed = await db.query<{
      status: string;
      snapshot_id: string;
      issues: { code: string; field: string }[];
    }>(
      "select status,snapshot_id,issues from public.policy_quality_observations where run_id=$1",
      [quarantine.runId],
    );
    assert.equal(failed.rows.length, 1);
    assert.equal(failed.rows[0].status, "ERROR");
    assert.ok(failed.rows[0].snapshot_id);
    assert.ok(
      failed.rows[0].issues.some(
        (i) => i.code === "DISPLAY_CONTENT_LOST" && i.field === "target_text",
      ),
    );
    assert.deepEqual(await savedRun(quarantine.runId), {
      status: "FAILED",
      calls: 2,
      next_page: 2,
      discovery_complete: false,
    });

    badQuality = false;
    const actionBoundary = actions.length;
    const recovered = await runAutomatic({
      ...options,
      resumeRunId: quarantine.runId,
    });
    assert.equal(recovered.status, "SUCCESS");
    assert.equal(recovered.calls, 5);
    assert.equal(recovered.processed, 2);
    assert.equal(
      actions
        .slice(actionBoundary)
        .filter((action) => action === "auto_refresh").length,
      1,
    );
    assert.deepEqual(await savedRun(recovered.runId), {
      status: "SUCCESS",
      calls: 7,
      next_page: 4,
      discovery_complete: true,
    });
    assert.equal(await countSnapshots(), 3);
    assert.deepEqual(await current(), applied);
    const observations = await db.query<{
      external_id: string;
      status: string;
    }>(
      "select external_id,status from public.policy_quality_observations where run_id=$1 order by id",
      [recovered.runId],
    );
    assert.deepEqual(
      observations.rows.map((row) => row.external_id),
      [ids[0], ids[0], ids[1]],
    );
    assert.equal(observations.rows[0].status, "ERROR");
    assert.ok(
      observations.rows
        .slice(1)
        .every((row) => row.status === "REVIEW" || row.status === "PASS"),
    );
    assert.equal(
      requests.length,
      paused.calls +
        resumed.calls +
        repeat.calls +
        quarantine.calls +
        recovered.calls,
    );
  } finally {
    await db.close();
  }
});
