import assert from "node:assert/strict";
import { test } from "node:test";
import { completePages, collectSelection } from "./collect.ts";
import { ProbeClient } from "./gov24/probe.ts";
import type { Capture, Row } from "./gov24/probe.ts";

function setup(pages: { rows: Row[]; match?: number; status?: number }[]) {
  const captures: Capture[] = [];
  let calls = 0;
  const client = new ProbeClient(
    "synthetic-test-key",
    20,
    async (c) => {
      captures.push(c);
    },
    async (url) => {
      const u = new URL(String(url)),
        p = pages[calls++];
      assert.ok(p, "Unexpected additional request");
      return new Response(
        JSON.stringify({
          page: Number(u.searchParams.get("page")),
          perPage: Number(u.searchParams.get("perPage")),
          currentCount: p.rows.length,
          totalCount: 100,
          matchCount: p.match ?? 1,
          data: p.rows,
        }),
        { status: p.status ?? 200 },
      );
    },
  );
  return { client, captures, calls: () => calls };
}
const filters = { "cond[서비스ID::EQ]": "id-1" };
test("only count-matching traversal and terminal page complete", async () => {
  const { client, captures } = setup([
    { rows: [{ 서비스ID: "id-1" }] },
    { rows: [] },
  ]);
  const result = await completePages(
    client,
    captures,
    "serviceDetail",
    filters,
    { perPage: 5, maxPages: 3 },
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.evidence.length, 2);
});
test("premature empty, count drift, duplicate, mismatched ID and cap are rejected", async () => {
  const cases = [
    { pages: [{ rows: [], match: 1 }], code: /premature-empty-page/ },
    {
      pages: [{ rows: [{ 서비스ID: "id-1" }] }, { rows: [], match: 2 }],
      code: /count-changed/,
    },
    {
      pages: [
        { rows: [{ 서비스ID: "id-1" }] },
        { rows: [{ 서비스ID: "id-1" }] },
      ],
      code: /duplicate-id/,
    },
    { pages: [{ rows: [{ 서비스ID: "other" }] }], code: /id-mismatch/ },
  ];
  for (const c of cases) {
    const s = setup(c.pages);
    await assert.rejects(
      completePages(s.client, s.captures, "serviceDetail", filters, {
        perPage: 1,
        maxPages: 3,
      }),
      c.code,
    );
  }
  const s = setup([{ rows: [{ 서비스ID: "id-1" }] }]);
  await assert.rejects(
    completePages(s.client, s.captures, "serviceDetail", filters, {
      perPage: 1,
      maxPages: 1,
    }),
    /page-limit/,
  );
});
test("authentication failure stops all remaining policy groups", async () => {
  const s = setup([{ rows: [], status: 403 }]);
  const selected = Array.from({ length: 5 }, (_, i) => ({
    id: String(i),
    reason: "test",
    filters: { "cond[서비스명::LIKE]": `name${i}` },
  }));
  const failures: string[] = [];
  await assert.rejects(
    collectSelection(
      s.client,
      s.captures,
      selected,
      { perPage: 5, maxPages: 3 },
      async (_, __, error) => {
        failures.push(error!);
      },
    ),
    /run-stopped/,
  );
  assert.equal(s.calls(), 1);
  assert.deepEqual(failures, ["list-request-failed"]);
});
