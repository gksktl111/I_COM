import assert from "node:assert/strict";
import { test } from "node:test";
import { createAutomaticSource } from "./automatic-source.ts";
import type { Provider } from "./automatic-source.ts";

function fixture(provider: Provider, fault = "") {
  const requests: URL[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    const gov = provider === "GOV24";
    const list = gov
      ? url.pathname.endsWith("serviceList")
      : /(?:Welfarelist|WelfarelistV001)$/.test(url.pathname);
    const page = Number(url.searchParams.get(gov ? "page" : "pageNo") ?? 1);
    const size = Number(
      url.searchParams.get(gov ? "perPage" : "numOfRows") ?? 20,
    );
    const id =
      url.searchParams.get(gov ? "cond[서비스ID::EQ]" : "servId") ?? "";
    if (fault === "transport") throw new TypeError("network");
    if (gov) {
      const total = list ? 12 : 1;
      let data = list
        ? page === 1
          ? Array.from({ length: 12 }, (_, i) => ({
              서비스ID: `WLF${i}`,
              서비스명: `Name${i}`,
            }))
          : []
        : page === 1
          ? [
              {
                서비스ID: fault === "identity" ? "wrong" : id,
                서비스명: `Name${id.slice(3)}`,
              },
            ]
          : [];
      if (fault === "duplicate" && list) data[1] = data[0];
      if (fault === "short" && list) data = data.slice(0, 11);
      return Response.json({
        page: fault === "envelope" ? 99 : page,
        perPage: size,
        currentCount: data.length,
        matchCount: total,
        totalCount: total,
        data,
      });
    }
    if (!list)
      return new Response(
        `<root><resultCode>0</resultCode><servId>${fault === "identity" ? "WLF999" : id}</servId><servNm>Name${id.slice(3)}</servNm></root>`,
      );
    let ids = page === 1 ? Array.from({ length: 12 }, (_, i) => `WLF${i}`) : [];
    if (fault === "duplicate" && ids.length) ids[1] = ids[0];
    if (fault === "short") ids = ids.slice(0, 11);
    return new Response(
      `<root><resultCode>0</resultCode><pageNo>${fault === "envelope" ? 99 : page}</pageNo><numOfRows>${size}</numOfRows><totalCount>12</totalCount>${ids.map((id) => `<servList><servId>${id}</servId><servNm>Name${id.slice(3)}</servNm></servList>`).join("")}</root>`,
    );
  };
  return { requests, fetcher };
}

for (const provider of ["GOV24", "BOKJIRO_CENTRAL", "BOKJIRO_LOCAL"] as const) {
  test(`${provider}: discovers more than ten IDs and collects details without reloading lists`, async () => {
    const mock = fixture(provider);
    let reserved = 0;
    const source = createAutomaticSource(
      { provider, filters: {}, perPage: 20 },
      "key",
      100,
      async () => {
        reserved++;
      },
      mock.fetcher,
    );
    const page = await source.page(1);
    assert.equal(page.ids.length, 12);
    for (const id of page.ids) {
      const raw = await source.detail(page, id);
      assert.equal(raw.externalId, id);
      assert.equal(raw.evidence.length, provider === "GOV24" ? 5 : 2);
    }
    assert.equal((await source.page(2)).ids.length, 0);
    assert.equal(source.calls, provider === "GOV24" ? 50 : 14);
    assert.equal(reserved, source.calls);
    assert.equal(mock.requests.length, source.calls);
    if (provider === "BOKJIRO_CENTRAL") {
      assert.equal(mock.requests[0].searchParams.get("srchKeyCode"), "003");
      assert.equal(mock.requests[0].searchParams.get("callTp"), "L");
    }
  });
  test(`${provider}: rejects bad pages, mismatched details, and expired evidence`, async () => {
    for (const fault of ["envelope", "duplicate", "short"]) {
      const source = createAutomaticSource(
        { provider, filters: {}, perPage: 20 },
        "key",
        100,
        async () => {},
        fixture(provider, fault).fetcher,
      );
      await assert.rejects(source.page(1));
    }
    const mock = fixture(provider, "identity");
    const source = createAutomaticSource(
      { provider, filters: {}, perPage: 20 },
      "key",
      100,
      async () => {},
      mock.fetcher,
    );
    const page = await source.page(1);
    await assert.rejects(source.detail(page, page.ids[0]), /id-mismatch/);
    const before = source.calls;
    await assert.rejects(
      source.detail(
        { ...page, capturedAt: "2000-01-01T00:00:00Z" },
        page.ids[0],
      ),
      /window/,
    );
    assert.equal(source.calls, before);
  });
  test(`${provider}: reservation failure cannot be retried as a transport error`, async () => {
    let reserved = 0;
    const mock = fixture(provider);
    const source = createAutomaticSource(
      { provider, filters: {}, perPage: 20 },
      "key",
      100,
      async () => {
        reserved++;
        throw new TypeError("daily-budget-exhausted");
      },
      mock.fetcher,
    );
    await assert.rejects(source.page(1), /daily-budget-exhausted/);
    await assert.rejects(source.page(1), /daily-budget-exhausted/);
    assert.equal(reserved, 1);
    assert.equal(source.calls, 0);
    assert.equal(mock.requests.length, 0);
  });
}

test("Gov24 reserves each actual retry and respects its client budget", async () => {
  let reserved = 0;
  const mock = fixture("GOV24", "transport");
  const source = createAutomaticSource(
    { provider: "GOV24", filters: {}, perPage: 20 },
    "key",
    2,
    async () => {
      reserved++;
    },
    mock.fetcher,
  );
  await assert.rejects(source.page(1), /budget/);
  assert.equal(reserved, 2);
  assert.equal(source.calls, 2);
});

test("provider-specific filters are validated before HTTP", () => {
  for (const [provider, filters] of [
    ["GOV24", { "cond[서비스ID::EQ]": "x" }],
    ["BOKJIRO_CENTRAL", { ctpvNm: "서울특별시" }],
    ["BOKJIRO_LOCAL", { serviceKey: "override" }],
    ["BOKJIRO_CENTRAL", { srchKeyCode: "999" }],
  ] as Array<[Provider, Record<string, string>]>) {
    assert.throws(() =>
      createAutomaticSource(
        { provider, filters, perPage: 20 },
        "key",
        10,
        async () => {},
      ),
    );
  }
});

test("overlapping operations cannot mix page capture evidence", async () => {
  const mock = fixture("GOV24");
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  const source = createAutomaticSource(
    { provider: "GOV24", filters: {}, perPage: 20 },
    "key",
    10,
    () => ready,
    mock.fetcher,
  );
  const first = source.page(1);
  await assert.rejects(source.page(2), /source-operation-in-progress/);
  release();
  assert.equal((await first).evidence.length, 1);
  assert.equal(source.calls, 1);
});
