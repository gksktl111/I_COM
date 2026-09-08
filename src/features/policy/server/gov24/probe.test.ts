import test from "node:test";
import assert from "node:assert/strict";
import { ProbeClient, collectPages, observations, redact } from "./probe.ts";
import type { Capture } from "./probe.ts";
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
test("budget counts retries and cannot be exceeded", async () => {
  let calls = 0;
  const captures: Capture[] = [];
  const client = new ProbeClient(
    "secret",
    2,
    async (c) => {
      captures.push(c);
    },
    async () => {
      calls++;
      return reply({}, 500);
    },
  );
  await assert.rejects(client.request("serviceList", 1, 5, {}), /budget/);
  assert.equal(calls, 2);
  assert.equal(captures.length, 2);
});
test("auth/quota stop future requests; key and reflected URL are sanitized", async () => {
  for (const status of [401, 403, 429]) {
    let calls = 0;
    const captures: Capture[] = [];
    const client = new ProbeClient(
      "a%2Bb%3D",
      10,
      async (c) => {
        captures.push(c);
      },
      async (url, options) => {
        calls++;
        assert.equal(options?.redirect, "error");
        assert.equal(
          new URL(String(url)).searchParams.get("serviceKey"),
          "a+b=",
        );
        return reply({ error: String(url), serviceKey: "a+b=" }, status);
      },
    );
    await assert.rejects(client.request("serviceList", 1, 5, {}));
    await assert.rejects(client.request("serviceList", 1, 5, {}));
    assert.equal(calls, 1);
    assert.doesNotMatch(JSON.stringify(captures), /a%2Bb%3D|a\+b=/);
  }
  assert.deepEqual(redact({ authorization: "secret" }, "secret"), {
    authorization: "[REDACTED]",
  });
});
test("transport exceptions never expose raw URL or key", async () => {
  const captures: Capture[] = [];
  const client = new ProbeClient(
    "secret",
    2,
    async (c) => {
      captures.push(c);
    },
    async () => {
      throw new Error("https://example.com?serviceKey=secret");
    },
  );
  await assert.rejects(
    client.request("serviceList", 1, 5, {}),
    (error) => !String(error).includes("secret"),
  );
  assert.doesNotMatch(JSON.stringify(captures), /secret|example.com/);
});
test("reads all pages until observed empty page and quarantines mismatched IDs", async () => {
  const responses = [
    [{ 서비스ID: "one", x: 1 }],
    [{ 서비스ID: "two" }, { 서비스ID: "one", x: 1 }],
    [],
  ];
  let page = 0;
  const client = new ProbeClient(
    "secret",
    5,
    async () => {},
    async () =>
      reply({ data: responses[page++], totalCount: 1, matchCount: 1 }),
  );
  const result = await collectPages(client, "serviceDetail", "one", 1, 5);
  assert.equal(page, 3);
  assert.equal(result.rowCount, 3);
  assert.equal(result.duplicates, 1);
  assert.equal(result.mismatches.length, 1);
  assert.equal(result.quarantined, true);
  assert.equal(result.termination, "empty-page-observed");
});
test("page cap and malformed envelope remain incomplete", async () => {
  const client = new ProbeClient(
    "secret",
    5,
    async () => {},
    async () => reply({ data: [{ 서비스ID: "one" }] }),
  );
  assert.equal(
    (await collectPages(client, "supportConditions", "one", 1, 2)).termination,
    "page-cap",
  );
  const invalid = new ProbeClient(
    "secret",
    1,
    async () => {},
    async () => reply({ code: "ERROR" }),
  );
  assert.equal(
    (await collectPages(invalid, "supportConditions", "one", 1, 2)).termination,
    "error",
  );
});
test("observations separate absence, null, empty, whitespace and declared absent fields", () => {
  const stats = observations(
    [{ x: null }, { x: "" }, { x: "  " }, { x: 42 }, {}],
    { x: { type: "string" }, never: { type: "string" } },
  );
  assert.equal(stats.x.missing, 1);
  assert.equal(stats.x.null, 1);
  assert.equal(stats.x.empty, 1);
  assert.equal(stats.x.whitespace, 1);
  assert.equal(stats.x.maxStringLength, 2);
  assert.equal(stats.x.types.number, 1);
  assert.equal(stats.never.missing, 5);
});
test("response body has a finite byte cap", async () => {
  const captures: Capture[] = [];
  const client = new ProbeClient(
    "secret",
    1,
    async (c) => {
      captures.push(c);
    },
    async () => reply({ data: ["x".repeat(200)] }),
    1000,
    20,
  );
  await assert.rejects(client.request("serviceList", 1, 1, {}), /size/);
  assert.equal(captures[0].body, undefined);
});
test("request validator rejects credential overrides without making a call", async () => {
  let calls = 0;
  const client = new ProbeClient(
    "secret",
    1,
    async () => {},
    async () => {
      calls++;
      return reply({ data: [] });
    },
  );
  await assert.rejects(
    client.request("serviceList", 1, 5, { serviceKey: "replacement" }),
    /filter/,
  );
  await assert.rejects(client.request("serviceList", 0, 5, {}), /options/);
  assert.equal(calls, 0);
});
test("business errors with data and pagination inconsistencies remain explicit", async () => {
  const captures: Capture[] = [];
  const client = new ProbeClient(
    "secret",
    2,
    async (c) => {
      captures.push(c);
    },
    async () => reply({ data: [], code: "ERROR" }),
  );
  await assert.rejects(client.request("serviceList", 1, 5, {}), /business/);
  assert.ok(captures[0].anomalies?.includes("invalid-page"));
  const other = new ProbeClient(
    "secret",
    1,
    async (c) => {
      captures.push(c);
    },
    async () =>
      reply({
        data: [],
        page: 2,
        perPage: 5,
        currentCount: 3,
        totalCount: 0,
        matchCount: 0,
      }),
  );
  await other.request("serviceList", 1, 5, {});
  assert.deepEqual(captures[1].anomalies, [
    "page-mismatch",
    "currentCount-mismatch",
  ]);
});

test("transient transport retry succeeds within budget; long Retry-After is deferred", async () => {
  let calls = 0;
  const client = new ProbeClient(
    "synthetic-retry",
    2,
    async () => {},
    async () => {
      if (++calls === 1) throw new TypeError("synthetic network failure");
      return new Response(
        JSON.stringify({
          page: 1,
          perPage: 5,
          currentCount: 0,
          totalCount: 0,
          matchCount: 0,
          data: [],
        }),
      );
    },
  );
  assert.deepEqual(await client.request("serviceList", 1, 5, {}), []);
  assert.equal(calls, 2);
  let deferredCalls = 0;
  const deferred = new ProbeClient(
    "synthetic-defer",
    3,
    async () => {},
    async () => {
      deferredCalls++;
      return new Response("{}", {
        status: 503,
        headers: { "Retry-After": "60" },
      });
    },
  );
  await assert.rejects(deferred.request("serviceList", 1, 5, {}), /HTTP 503/);
  assert.equal(deferredCalls, 1);
});
