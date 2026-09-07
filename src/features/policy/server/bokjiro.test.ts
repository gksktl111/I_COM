import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseXml,
  BokjiClient,
  normalizeBokji,
  type BokjiRaw,
} from "./bokjiro.ts";

test("XML preserves strings, repeats, CDATA and empty values", () => {
  assert.deepEqual(
    parseXml(
      '<?xml version="1.0"?><wantedList><id>001</id><row><v><![CDATA[<p>A & B</p>]]></v></row><row><v/></row><empty></empty><encoded>&lt;&amp;&#65;&#x42;</encoded></wantedList>',
    ),
    {
      id: "001",
      row: [{ v: "<p>A & B</p>" }, { v: "" }],
      empty: "",
      encoded: "<&AB",
    },
  );
});
test("XML rejects malformed markup, declarations and unknown entities", () => {
  for (const xml of [
    "<r><a></r>",
    "<r><a>",
    "<r/><r/>",
    "<!DOCTYPE r><r><a/></r>",
    '<!ENTITY x "hi"><r><a/></r>',
    "<r><a>&unknown;</a></r>",
    "<r><a>&#0;</a></r>",
    '<r x="1" x="2"><a/></r>',
    "<r><a>bare & value</a></r>",
    "<r><a/></r>tail",
  ])
    assert.throws(() => parseXml(xml), /Invalid XML/);
});
test("client fixes endpoint, decodes key once, redacts evidence and enforces budget", async () => {
  let evidence: unknown;
  const client = new BokjiClient(
    "secret%2Bkey",
    "BOKJIRO_CENTRAL",
    1,
    async (c) => {
      evidence = c;
    },
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.origin, "https://apis.data.go.kr");
      assert.equal(
        url.pathname,
        "/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001",
      );
      assert.equal(url.searchParams.get("serviceKey"), "secret+key");
      assert.equal(init?.redirect, "error");
      return new Response(
        "<wantedList><resultCode>0</resultCode><echo>secret+key</echo></wantedList>",
      );
    },
  );
  const result = await client.request("list", {
    serviceKey: "override",
    searchWrd: "secret+key",
  });
  assert.doesNotMatch(JSON.stringify(evidence), /secret|override/);
  assert.equal(result.data.echo, "[REDACTED]");
  assert.equal(client.calls, 1);
  await assert.rejects(client.request("list", {}), /budget/);
});
test("client rejects HTTP 200 business errors, network secrets and oversized streams", async () => {
  for (const response of [
    new Response("<wantedList><resultCode>10</resultCode></wantedList>"),
    new Response("<wantedList><resultCode>00</resultCode></wantedList>"),
    new Response("oops", { status: 500 }),
  ]) {
    const c = new BokjiClient(
      "secret",
      "BOKJIRO_LOCAL",
      1,
      undefined,
      async () => response,
    );
    await assert.rejects(c.request("list", {}));
  }
  const c = new BokjiClient(
    "secret",
    "BOKJIRO_LOCAL",
    1,
    undefined,
    async () => {
      throw new Error("secret");
    },
  );
  await assert.rejects(
    c.request("detail", {}),
    (e) => !String(e).includes("secret"),
  );
  let cancelled = false;
  const large = new BokjiClient(
    "secret",
    "BOKJIRO_LOCAL",
    1,
    undefined,
    async () =>
      new Response(
        new ReadableStream({
          pull(c) {
            c.enqueue(new Uint8Array(1024 * 1024));
          },
          cancel() {
            cancelled = true;
          },
        }),
      ),
  );
  await assert.rejects(large.request("list", {}), /response-size/);
  assert.equal(cancelled, true);
});
function raw(): BokjiRaw {
  return {
    provider: "BOKJIRO_LOCAL",
    apiVersion: "v1",
    externalId: "001",
    list: { servId: "001", servNm: "지원", servDgst: "요약" },
    detail: [
      {
        servId: "001",
        servNm: "지원",
        sprtTrgtCn: "<p>대상</p>",
        enfcBgngYmd: "20260101",
        inqplCtadrList: [
          { wlfareInfoReldNm: "A", wlfareInfoReldCn: "123" },
          { wlfareInfoReldNm: "B", wlfareInfoReldCn: "456" },
        ],
      },
    ],
    xml: { list: "original", detail: "original" },
    evidence: [],
  };
}
test("normalization rejects mismatched identity and preserves lists and effective dates without inventing application dates", () => {
  const r = raw(),
    before = structuredClone(r),
    n = normalizeBokji(r);
  assert.equal(n.display.application_period_text, null);
  assert.equal(n.display.required_documents_text, null);
  assert.equal(n.display.target_text, "대상");
  assert.equal(n.display.contact_text, "A 123\nB 456");
  assert.deepEqual(n.additional.inqplCtadrList, r.detail[0].inqplCtadrList);
  assert.deepEqual(r, before);
  r.detail[0].servId = "002";
  assert.throws(() => normalizeBokji(r), /ID mismatch/);
  r.detail[0].servId = "001";
  r.detail[0].servNm = "다름";
  assert.throws(() => normalizeBokji(r), /name mismatch/);
});

for (const [provider, prefix, id, listFile, expected] of [
  [
    "BOKJIRO_CENTRAL",
    "central",
    "WLF00000024",
    "central-childcare-list.xml",
    "아이돌봄서비스",
  ],
  [
    "BOKJIRO_LOCAL",
    "local",
    "WLF00002340",
    "local-childcare-list-page2.xml",
    "출산양육지원금 지급",
  ],
] as const) {
  test(`normalizes real ${provider} XML without losing evidence`, () => {
    const base = new URL(
      "../../../../docs/fixtures/bokjiro/real/",
      import.meta.url,
    );
    const listXml = readFileSync(new URL(listFile, base), "utf8");
    const detailXml = readFileSync(
      new URL(`${prefix}-${id}-detail.xml`, base),
      "utf8",
    );
    const listData = parseXml(listXml),
      detail = parseXml(detailXml);
    const records = Array.isArray(listData.servList)
      ? listData.servList
      : [listData.servList];
    const list = records.find((row) => row.servId === id);
    assert.ok(list);
    const bundle: BokjiRaw = {
      provider,
      apiVersion: "v1",
      externalId: id,
      list,
      detail: [detail],
      xml: { list: listXml, detail: detailXml },
      evidence: [],
    };
    const before = structuredClone(bundle),
      normalized = normalizeBokji(bundle);
    assert.equal(normalized.display.name, expected);
    assert.ok(normalized.display.target_text);
    assert.ok(normalized.display.benefit_text);
    assert.ok(normalized.display.application_method_text);
    assert.equal(normalized.display.application_period_text, null);
    assert.equal(Object.keys(normalized.display).length, 14);
    assert.deepEqual(bundle, before);
  });
}

test("access and quota failures stop subsequent network calls", async () => {
  for (const [status, code] of [
    [401, "0"],
    [403, "0"],
    [429, "0"],
    [200, "20"],
    [200, "22"],
    [200, "23"],
    [200, "30"],
    [200, "31"],
  ] as const) {
    let calls = 0;
    const client = new BokjiClient(
      "secret",
      "BOKJIRO_LOCAL",
      5,
      undefined,
      async () => {
        calls++;
        return new Response(
          `<wantedDtl><resultCode>${code}</resultCode></wantedDtl>`,
          { status },
        );
      },
    );
    await assert.rejects(client.request("detail", {}));
    await assert.rejects(client.request("detail", {}), /blocked/);
    assert.equal(calls, 1);
  }
});

test("summary never becomes purpose and malformed nested text rejects", () => {
  for (const provider of ["BOKJIRO_LOCAL", "BOKJIRO_CENTRAL"] as const) {
    const r = raw();
    r.provider = provider;
    r.detail[0].servDgst = "요약";
    r.detail[0].wlfareInfoOutlCn = "요약";
    const n = normalizeBokji(r);
    assert.equal(n.display.purpose_text, null);
    assert.equal(n.fieldSources.purpose_text.emptyKind, "missing");
    for (const invalid of [123, {}, []]) {
      const field =
        provider === "BOKJIRO_CENTRAL" ? "applmetList" : "inqplCtadrList";
      const name =
        provider === "BOKJIRO_CENTRAL" ? "servSeDetailNm" : "wlfareInfoReldNm";
      const content =
        provider === "BOKJIRO_CENTRAL"
          ? "servSeDetailLink"
          : "wlfareInfoReldCn";
      r.detail[0][field] = [{ [name]: invalid }];
      assert.throws(() => normalizeBokji(r), /nested text/);
      r.detail[0][field] = [{ [content]: invalid }];
      assert.throws(() => normalizeBokji(r), /nested text/);
    }
  }
});
test("capture records timestamp and manual budget cannot exceed 100", async () => {
  assert.throws(
    () => new BokjiClient("secret", "BOKJIRO_LOCAL", 101),
    /configuration/,
  );
  const start = Date.now();
  let capturedAt = "";
  const c = new BokjiClient(
    "secret",
    "BOKJIRO_LOCAL",
    100,
    async (capture) => {
      capturedAt = capture.capturedAt;
    },
    async () => new Response("<r><resultCode>0</resultCode></r>"),
  );
  await c.request("list", {});
  assert.ok(
    Date.parse(capturedAt) >= start && Date.parse(capturedAt) <= Date.now(),
  );
});
