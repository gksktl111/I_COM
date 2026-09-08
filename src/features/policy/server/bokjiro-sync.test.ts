import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { syncBokjiro } from "./bokjiro-sync.ts";
import type { BokjiProvider } from "./bokjiro.ts";
import type { PolicyRepository } from "./repository.ts";

let db: PGlite;
const tables = [
  "policy_sources",
  "policy_source_snapshots",
  "policies",
  "policy_sync_runs",
  "policy_sync_items",
  "policy_sync_locks",
];
const repository: PolicyRepository = {
  async command<T>(
    action: string,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const result = await db.query<{ value: T }>(
      "select public.policy_sync_command($1,$2::jsonb) as value",
      [action, JSON.stringify(payload)],
    );
    return result.rows[0].value;
  },
};
before(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; grant usage on schema public to anon, authenticated, service_role;",
  );
  for (const name of [
    "20260907181933_policy_ingestion",
    "20260907192856_policy_multiple_providers",
  ]) {
    await db.exec(
      await readFile(
        new URL(`../../../../supabase/migrations/${name}.sql`, import.meta.url),
        "utf8",
      ),
    );
  }
});
beforeEach(async () => {
  await db.exec(
    `reset role; truncate ${tables.map((t) => `public.${t}`).join(", ")}; insert into public.policy_sync_locks(name) values ('GOV24'),('BOKJIRO_CENTRAL'),('BOKJIRO_LOCAL'); set role service_role;`,
  );
});
after(async () => {
  await db?.close();
});
const fixture = (name: string) =>
  readFile(
    new URL(
      `../../../../docs/fixtures/bokjiro/real/${name}.xml`,
      import.meta.url,
    ),
    "utf8",
  );
async function state(names = tables) {
  return Promise.all(
    names.map(
      async (name) =>
        (
          await db.query(
            `select to_jsonb(t) as row from public.${name} t order by to_jsonb(t)::text`,
          )
        ).rows,
    ),
  );
}
async function setup(provider: BokjiProvider) {
  const central = provider === "BOKJIRO_CENTRAL";
  const prefix = central ? "central" : "local";
  const ids = central
    ? ["WLF00000024", "WLF00000030"]
    : ["WLF00002249", "WLF00002340"];
  const lists = await Promise.all(
    (central
      ? ["central-childcare-list"]
      : ["local-list", "local-childcare-list-page2"]
    ).map(fixture),
  );
  const blocks =
    lists.join("\n").match(/<servList>[\s\S]*?<\/servList>/g) ?? [];
  const selectedBlocks = ids.map((id) => {
    const block = blocks.find((b) => b.includes(`<servId>${id}</servId>`));
    assert.ok(block, `real list fixture contains ${id}`);
    return block;
  });
  const details = new Map(
    await Promise.all(
      ids.map(
        async (id) => [id, await fixture(`${prefix}-${id}-detail`)] as const,
      ),
    ),
  );
  const selected = ids.map((id) => ({
    id,
    reason: "Real XML integration fixture with synthetic pagination",
    filters: { searchWrd: "양육" },
  }));
  const requests: URL[] = [];
  let wrongId: string | undefined;
  let badCount: "changed" | "missing" | undefined;
  // The real service rows/details are retained verbatim. This envelope is synthetic:
  // two selected records on page 1 and a terminal empty page 2.
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    assert.equal(url.protocol, "https:");
    const id = url.searchParams.get("servId");
    if (id) {
      assert.ok(details.has(id));
      const xml = details.get(id)!;
      return new Response(
        id === wrongId
          ? xml.replace(
              `<servId>${id}</servId>`,
              "<servId>WLF99999999</servId>",
            )
          : xml,
      );
    }
    const page = url.searchParams.get("pageNo");
    const count =
      badCount === "missing"
        ? ""
        : `<totalCount>${badCount === "changed" && page === "2" ? 3 : 2}</totalCount>`;
    return new Response(
      `<wantedList><resultCode>0</resultCode><resultMessage>NORMAL SERVICE</resultMessage><pageNo>${page}</pageNo><numOfRows>2</numOfRows>${count}${page === "1" ? selectedBlocks.join("") : ""}</wantedList>`,
    );
  };
  const run = (extra: Partial<Parameters<typeof syncBokjiro>[0]> = {}) =>
    syncBokjiro({
      provider,
      selected,
      key: "fixture-key",
      repository,
      dryRun: false,
      trigger: "manual",
      perPage: 2,
      fetcher,
      ...extra,
    });
  return {
    ids,
    requests,
    run,
    wrong: (id?: string) => {
      wrongId = id;
    },
    count: (value: typeof badCount) => {
      badCount = value;
    },
  };
}
for (const provider of ["BOKJIRO_CENTRAL", "BOKJIRO_LOCAL"] as const) {
  test(`${provider}: real XML first sync/reprocess deduplicate and dry-run leaves all six tables unchanged`, async () => {
    const f = await setup(provider);
    const first = await f.run();
    assert.equal(first.status, "SUCCESS", JSON.stringify(first));
    assert.equal(first.items.length, 2);
    assert.equal(first.calls, 4);
    const persisted = await state(tables.slice(0, 3));
    const beforeReprocessRequests = f.requests.length;
    const reprocessed = await f.run({ trigger: "reprocess" });
    assert.equal(reprocessed.status, "SUCCESS", JSON.stringify(reprocessed));
    assert.equal(reprocessed.calls, 0);
    assert.equal(f.requests.length, beforeReprocessRequests);
    const afterReprocess = await state(tables.slice(0, 3));
    assert.deepEqual(
      afterReprocess.map((rows) => rows.length),
      persisted.map((rows) => rows.length),
    );
    assert.deepEqual(afterReprocess[1], persisted[1]);
    assert.deepEqual(afterReprocess[2], persisted[2]);
    const beforeDry = await state();
    assert.equal((await f.run({ dryRun: true })).status, "SUCCESS");
    assert.deepEqual(await state(), beforeDry);
  });
  test(`${provider}: wrong detail ID preserves applied value; resume skips successful IDs`, async () => {
    const f = await setup(provider);
    assert.equal((await f.run()).status, "SUCCESS");
    const before = await repository.command("current", {
      provider,
      externalId: f.ids[1],
    });
    f.wrong(f.ids[1]);
    const partial = await f.run();
    assert.equal(partial.status, "PARTIAL", JSON.stringify(partial));
    assert.deepEqual(
      await repository.command("current", { provider, externalId: f.ids[1] }),
      before,
    );
    assert.deepEqual(
      partial.items.map((i) => i.status),
      ["SUCCESS", "FAILED"],
    );
    f.wrong();
    f.requests.length = 0;
    assert.ok("runId" in partial);
    const resumed = await f.run({ resumeRunId: partial.runId as string });
    assert.equal(resumed.status, "SUCCESS", JSON.stringify(resumed));
    assert.deepEqual(
      resumed.items.map((i) => i.id),
      [f.ids[1]],
    );
    assert.deepEqual(
      f.requests
        .filter((u) => u.searchParams.has("servId"))
        .map((u) => u.searchParams.get("servId")),
      [f.ids[1]],
    );
  });
  for (const count of ["changed", "missing"] as const) {
    test(`${provider}: ${count} totalCount blocks all snapshot/application writes`, async () => {
      const f = await setup(provider);
      assert.equal((await f.run()).status, "SUCCESS");
      const before = await state(tables.slice(0, 3));
      f.count(count);
      f.requests.length = 0;
      const result = await f.run();
      assert.equal(result.status, "FAILED", JSON.stringify(result));
      assert.deepEqual(await state(tables.slice(0, 3)), before);
      assert.equal(
        f.requests.some((u) => u.searchParams.has("servId")),
        false,
      );
    });
  }
}
