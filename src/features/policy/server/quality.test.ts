import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { normalizeBundle, hashJson } from "./normalize.ts";
import type { RawBundle } from "./normalize.ts";
import { normalizeBokji, parseXml } from "./bokjiro.ts";
import type { BokjiRaw } from "./bokjiro.ts";
import type { Row } from "./gov24/probe.ts";
import { evaluatePolicyQuality, failureQuality } from "./quality.ts";

function gov(index = 0): RawBundle {
  const base = new URL(
    "../../../../docs/fixtures/gov24/real/",
    import.meta.url,
  );
  const json = (name: string) =>
    JSON.parse(readFileSync(new URL(name, base), "utf8"));
  const sample = json("selection.json").samples[index];
  return {
    externalId: sample.id,
    apiVersion: "v3",
    list: sample.listRecord,
    detail: json(`first/request-${String(index * 4 + 1).padStart(3, "0")}.json`)
      .body.data,
    conditions: json(
      `first/request-${String(index * 4 + 3).padStart(3, "0")}.json`,
    ).body.data,
    evidence: [],
  };
}
function bokji(): BokjiRaw {
  const base = new URL(
    "../../../../docs/fixtures/bokjiro/real/",
    import.meta.url,
  );
  const list = readFileSync(
    new URL("central-childcare-list.xml", base),
    "utf8",
  );
  const detail = readFileSync(
    new URL("central-WLF00000024-detail.xml", base),
    "utf8",
  );
  const row = (parseXml(list).servList as Row[]).find(
    (r) => r.servId === "WLF00000024",
  )!;
  return {
    provider: "BOKJIRO_CENTRAL",
    apiVersion: "v1",
    externalId: "WLF00000024",
    list: row,
    detail: [parseXml(detail)],
    xml: { list, detail },
    evidence: [],
  };
}
test("real Gov24 samples have deterministic JSON quality without enabling eligibility", () => {
  for (let index = 0; index < 8; index++) {
    const raw = gov(index),
      before = structuredClone(raw),
      n = normalizeBundle(raw);
    const quality = evaluatePolicyQuality(raw, n);
    assert.equal(quality.version, "policy-quality-1");
    assert.equal(quality.comparisonReady, false);
    assert.deepEqual(quality.metrics, { required: 6, present: 6, missing: 0 });
    assert.notEqual(quality.status, "ERROR");
    assert.ok(quality.issues.some((i) => i.code === "ELIGIBILITY_UNVERIFIED"));
    assert.ok(!quality.issues.some((i) => i.code === "SOURCE_LINK_MISMATCH"));
    assert.deepEqual(quality, evaluatePolicyQuality(raw, n));
    assert.deepEqual(JSON.parse(JSON.stringify(quality)), quality);
    assert.deepEqual(raw, before);
  }
});
test("missing and invalid source links retain distinct reasons", () => {
  const raw = gov();
  raw.list.상세조회URL = "";
  let quality = evaluatePolicyQuality(raw, normalizeBundle(raw));
  assert.ok(
    quality.issues.some(
      (i) =>
        i.field === "source_url" &&
        i.code === "SOURCE_FIELD_MISSING" &&
        i.message.includes("empty"),
    ),
  );
  raw.list.상세조회URL = "https://user:secret@example.test";
  quality = evaluatePolicyQuality(raw, normalizeBundle(raw));
  assert.ok(
    quality.issues.some(
      (i) => i.field === "source_url" && i.code === "INVALID_URL",
    ),
  );
  assert.ok(
    !quality.issues.some(
      (i) => i.field === "source_url" && i.kind === "SOURCE_MISSING",
    ),
  );
  assert.equal(quality.metrics.missing, 1);
  assert.ok(!JSON.stringify(quality).includes("secret"));
  for (const link of [
    "https://gov.kr.attacker.test/portal/rcvfvrSvc/dtlEx/" + raw.externalId,
    "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/wrong",
    "https://www.gov.kr/",
  ]) {
    raw.list.상세조회URL = link;
    assert.ok(
      evaluatePolicyQuality(raw, normalizeBundle(raw)).issues.some(
        (i) => i.code === "SOURCE_LINK_MISMATCH",
      ),
    );
  }
});
test("Bokjiro dedicated gaps distinguish retained procedural text from unavailable information", () => {
  const raw = bokji();
  let n = normalizeBokji(raw);
  const real = evaluatePolicyQuality(raw, n);
  assert.notEqual(real.status, "ERROR");
  assert.ok(!real.issues.some((i) => i.code === "SOURCE_LINK_MISMATCH"));
  raw.detail[0].applmetList = {
    servSeDetailNm: "신청 기간: 상시 신청. 준비 서류: 신청서",
    servSeDetailLink: "",
  };
  n = normalizeBokji(raw);
  const retained = evaluatePolicyQuality(raw, n);
  for (const field of ["application_period_text", "required_documents_text"]) {
    assert.equal(n.display[field], null);
    assert.ok(
      retained.issues.some(
        (i) =>
          i.field === field &&
          i.code === "DEDICATED_FIELD_MISSING_TEXT_RETAINED",
      ),
    );
  }
  raw.detail[0].applmetList = { servSeDetailNm: "방문", servSeDetailLink: "" };
  for (const key of ["tgtrDtlCn", "slctCritCn", "alwServCn"])
    raw.detail[0][key] = "안내";
  const absent = evaluatePolicyQuality(raw, normalizeBokji(raw));
  assert.ok(
    absent.issues.some(
      (i) =>
        i.field === "required_documents_text" &&
        i.code === "SOURCE_FIELD_MISSING",
    ),
  );
  assert.equal(retained.metrics.required, 6);
});
test("raw-only changes trigger review even when Gov24 condition codes do not change", () => {
  const raw = gov(),
    old = normalizeBundle(raw);
  raw.detail[0].지원대상 += " 추가 검토 문구";
  const next = normalizeBundle(raw);
  assert.equal(next.conditionsHash, old.conditionsHash);
  const quality = evaluatePolicyQuality(raw, next, old);
  assert.equal(quality.status, "REVIEW");
  assert.ok(quality.issues.some((i) => i.code === "RAW_SOURCE_CHANGED"));
  assert.ok(
    !quality.issues.some((i) => i.code === "CONDITION_EVIDENCE_CHANGED"),
  );
  assert.ok(
    !evaluatePolicyQuality(raw, next, next).issues.some(
      (i) => i.kind === "CHANGE",
    ),
  );
  raw.conditions[0].JA0110 = 77;
  assert.ok(
    evaluatePolicyQuality(raw, normalizeBundle(raw), next).issues.some(
      (i) => i.code === "CONDITION_EVIDENCE_CHANGED",
    ),
  );
});
test("hash binding and numeric preservation catch transformed evidence corruption", () => {
  const raw = gov(),
    n = normalizeBundle(raw);
  n.display.benefit_text = "99999999999999원";
  n.displayHash = hashJson(n.display);
  let quality = evaluatePolicyQuality(raw, n);
  assert.equal(quality.status, "ERROR");
  assert.ok(quality.issues.some((i) => i.code === "NUMERIC_CONTENT_MISMATCH"));
  raw.list.unknown = "changed";
  quality = evaluatePolicyQuality(raw, n);
  assert.ok(quality.issues.some((i) => i.code === "RAW_HASH_MISMATCH"));
});
test("malformed dates and known truncation remain actionable warnings", () => {
  const raw = gov(7);
  raw.detail[0].수정일시 = "2025-02-29";
  const quality = evaluatePolicyQuality(raw, normalizeBundle(raw));
  assert.ok(quality.issues.some((i) => i.code === "INVALID_MODIFIED_DATE"));
  assert.ok(quality.issues.some((i) => i.code === "POSSIBLE_URL_TRUNCATION"));
  const b = bokji();
  b.detail[0].lastModYmd = "20250229";
  assert.ok(
    evaluatePolicyQuality(b, normalizeBokji(b)).issues.some(
      (i) => i.code === "INVALID_MODIFIED_DATE",
    ),
  );
});
test("failure assessment accepts only controlled codes and never echoes exception text", () => {
  const failure = failureQuality("request https://api.test?serviceKey=SECRET");
  assert.equal(failure.status, "ERROR");
  assert.deepEqual(failure.metrics, { required: 0, present: 0, missing: 0 });
  assert.equal(failure.issues.length, 1);
  assert.equal(failure.issues[0].code, "INGESTION_FAILED");
  assert.ok(!JSON.stringify(failure).includes("SECRET"));
  assert.equal(
    failureQuality("NORMALIZATION_FAILED").issues[0].code,
    "NORMALIZATION_FAILED",
  );
});

test("technical PASS still carries independent verification gaps and explicit no-documents is present", () => {
  const raw = gov();
  // A controlled complete case removes the real sample's list/detail conflict.
  raw.list.신청방법 = raw.detail[0].신청방법;
  raw.detail[0].구비서류 = "해당없음";
  const normalized = normalizeBundle(raw);
  const quality = evaluatePolicyQuality(raw, normalized);
  assert.equal(quality.status, "PASS");
  assert.equal(quality.comparisonReady, false);
  assert.ok(!quality.issues.some((i) => i.field === "required_documents_text"));
  assert.deepEqual(
    quality.issues.map((i) => i.code),
    [
      "ELIGIBILITY_UNVERIFIED",
      "SOURCE_ACCESS_UNVERIFIED",
      "SOURCE_OFFICIALITY_UNVERIFIED",
    ],
  );
});
