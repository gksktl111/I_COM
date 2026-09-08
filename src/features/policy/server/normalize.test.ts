import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBundle, compareNormalized, hashJson } from "./normalize.ts";
import type { RawBundle } from "./normalize.ts";
function bundle(): RawBundle {
  return {
    externalId: "id",
    apiVersion: "v3",
    list: {
      서비스ID: "id",
      서비스명: "지원",
      수정일시: "20240229120000",
      상세조회URL: "https://example.com/policy",
    },
    detail: [
      {
        서비스ID: "id",
        서비스명: "지원",
        수정일시: "2024-02-29",
        지원내용:
          "<p>소득 0 &lt; 10만원 &amp; 미지원</p><p>2 < 3, 5 > 4<br>끝</p><ol start='3'><li>첫째</li><li>둘째</li></ol><script>삭제</script><style>삭제</style>",
      },
    ],
    conditions: [{ 서비스ID: "id", JA0110: 0, JA0101: "Y" }],
    evidence: [],
  };
}
test("HTML boundaries, entities, comparisons and list numbers survive without mutating raw", () => {
  const raw = bundle(),
    before = structuredClone(raw),
    result = normalizeBundle(raw);
  assert.match(
    result.display.benefit_text!,
    /소득 0 < 10만원 & 미지원\n+2 < 3, 5 > 4\n끝\n+3\. 첫째\n+4\. 둘째/,
  );
  assert.doesNotMatch(result.display.benefit_text!, /삭제/);
  assert.deepEqual(raw, before);
  assert.equal(result.modified.list.status, "valid");
  assert.equal(result.conditionsHash, hashJson(raw.conditions));
  assert.equal(
    result.warnings.some((w) => w.includes("JA0110")),
    false,
  );
});
test("nullable fields have exact provenance and no fallback", () => {
  const raw = bundle();
  Object.assign(raw.detail[0], {
    접수기관명: null,
    문의처: "",
    구비서류: "  ",
  });
  const n = normalizeBundle(raw);
  for (const [field, kind] of Object.entries({
    reception_text: "null",
    contact_text: "empty",
    required_documents_text: "whitespace",
    target_text: "missing",
  })) {
    assert.equal(n.display[field], null);
    assert.equal(n.fieldSources[field].emptyKind, kind);
    assert.equal(n.fieldSources[field].fallback, false);
  }
});
test("quarantines invalid types, identities, cardinality and missing names", () => {
  for (const value of [0, false, {}, []]) {
    const raw = bundle();
    raw.detail[0].지원대상 = value;
    assert.throws(() => normalizeBundle(raw), /Invalid text type/);
  }
  for (const mutate of [
    (r: RawBundle) => {
      r.detail = [];
    },
    (r: RawBundle) => {
      r.conditions.push(r.conditions[0]);
    },
    (r: RawBundle) => {
      r.detail[0].서비스ID = " id";
    },
    (r: RawBundle) => {
      r.detail[0].서비스명 = "다름";
    },
    (r: RawBundle) => {
      r.detail[0].서비스명 = r.list.서비스명 = " ";
    },
    (r: RawBundle) => {
      r.list = null as unknown as RawBundle["list"];
    },
  ]) {
    const raw = bundle();
    mutate(raw);
    assert.throws(() => normalizeBundle(raw));
  }
});
test("URLs retain invalid raw evidence and date validation does not infer timezone", () => {
  for (const url of [
    " https://example.com",
    "https://user:pass@example.com",
    "https://a.test https://b.test",
    "https://a.test,https://b.test",
    "/relative",
  ]) {
    const raw = bundle();
    raw.detail[0].온라인신청사이트URL = url;
    const n = normalizeBundle(raw);
    assert.equal(n.urls.application_url.raw, url);
    assert.equal(n.urls.application_url.status, "invalid");
    assert.equal(n.display.application_url, null);
  }
  const raw = bundle();
  raw.detail[0].수정일시 = "2023-02-29";
  assert.equal(normalizeBundle(raw).modified.detail.status, "invalid");
});
test("stable hashes exclude evidence; raw-only, conditions-only and A-B-A compare current", () => {
  const raw = bundle(),
    a = normalizeBundle(raw);
  raw.evidence = [
    {
      endpoint: "serviceList",
      page: 1,
      perPage: 1,
      filters: {},
      at: "later",
      attempt: 1,
    },
  ];
  assert.equal(normalizeBundle(raw).rawHash, a.rawHash);
  raw.list.unknown = false;
  const rawOnly = compareNormalized(a, normalizeBundle(raw));
  assert.deepEqual(rawOnly, {
    changedFields: [],
    rawChanged: true,
    displayChanged: false,
    conditionsChanged: false,
  });
  raw.conditions[0].JA0110 = 1;
  const condition = compareNormalized(a, normalizeBundle(raw));
  assert.equal(condition.conditionsChanged, true);
  assert.equal(condition.displayChanged, false);
  raw.detail[0].지원내용 = "변경";
  const b = normalizeBundle(raw);
  assert.deepEqual(compareNormalized(b, a).changedFields, ["benefit_text"]);
  assert.equal(compareNormalized(b, a).displayChanged, true);
  assert.equal(hashJson({ b: 2, a: [1, 2] }), hashJson({ a: [1, 2], b: 2 }));
  assert.notEqual(hashJson([1, 2]), hashJson([2, 1]));
});
