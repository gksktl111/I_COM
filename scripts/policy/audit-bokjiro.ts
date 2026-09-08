import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  normalizeBokji,
  parseXml,
  type BokjiRaw,
} from "../../src/features/policy/server/bokjiro.ts";
import { hashJson } from "../../src/features/policy/server/normalize.ts";

// Offline evidence audit: no credentials, network requests or database writes.
const [storedPath, outputPath] = process.argv.slice(2);
if (!storedPath || !outputPath || storedPath === outputPath) {
  throw new Error(
    "Usage: audit-bokjiro.ts <stored-validation.json> <report.json>",
  );
}
const stored = JSON.parse(readFileSync(storedPath, "utf8")) as {
  verifiedAt: string;
  policies: Array<{
    provider: BokjiRaw["provider"];
    external_id: string;
    applied_snapshot_id: string;
    normalizer_version: string;
    display: Record<string, string | null>;
  }>;
};
type Row = Record<string, unknown>;
function rows(value: unknown): Row[] {
  if (value == null || value === "") return [];
  const values = Array.isArray(value) ? value : [value];
  if (values.some((v) => !v || typeof v !== "object" || Array.isArray(v))) {
    throw new Error("Unexpected repeated fixture field");
  }
  return values as Row[];
}
const fixture = (name: string) =>
  readFileSync(
    new URL(`../../docs/fixtures/bokjiro/real/${name}`, import.meta.url),
    "utf8",
  );
function whitespace(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string" || /<\/?[a-z]/i.test(value)) {
    throw new Error(
      "This independent whitespace oracle requires plain-text samples; inspect new markup separately",
    );
  }
  return value.replace(/\s/gu, "") || null;
}
function numericEntities(value: unknown): unknown {
  // Observed central samples contain decimal references for circled list numbers.
  // Keep the strict whitespace result separately; do not hide this transformation.
  return typeof value === "string"
    ? value.replace(/&#(\d+);/g, (_, digits: string) => {
        const code = Number(digits);
        if (
          code < 32 ||
          code > 0x10ffff ||
          (code >= 0xd800 && code <= 0xdfff)
        ) {
          throw new Error("Unexpected numeric character reference");
        }
        return String.fromCodePoint(code);
      })
    : value;
}
const expectedIds = [
  "WLF00000024",
  "WLF00000030",
  "WLF00002249",
  "WLF00002340",
];
if (
  hashJson(stored.policies.map((p) => p.external_id).sort()) !==
  hashJson(expectedIds.sort())
) {
  throw new Error("Audit requires exactly the four selected samples");
}
const policies = stored.policies.map((saved) => {
  const central = saved.provider === "BOKJIRO_CENTRAL";
  if (!central && saved.provider !== "BOKJIRO_LOCAL")
    throw new Error("Unexpected provider");
  const listFile = central
    ? "central-childcare-list.xml"
    : saved.external_id === "WLF00002249"
      ? "local-list.xml"
      : "local-childcare-list-page2.xml";
  const detailFile = `${central ? "central" : "local"}-${saved.external_id}-detail.xml`;
  const listXml = fixture(listFile),
    detailXml = fixture(detailFile);
  const list = rows(parseXml(listXml).servList).filter(
    (r) => r.servId === saved.external_id,
  );
  if (list.length !== 1) throw new Error("Fixture list identity is not unique");
  const d = parseXml(detailXml),
    l = list[0];
  const raw: BokjiRaw = {
    provider: saved.provider,
    apiVersion: "v1",
    externalId: saved.external_id,
    list: l,
    detail: [d],
    xml: { list: listXml, detail: detailXml },
    evidence: [],
  };
  const replay = normalizeBokji(raw);
  // Explicit source mapping independent of the normalizer's fieldSources output.
  const sourceFields: Record<string, [string | null, unknown]> = {
    name: ["detail.servNm", d.servNm],
    summary: ["list.servDgst", l.servDgst],
    purpose_text: [null, null],
    target_text: [
      central ? "detail.tgtrDtlCn" : "detail.sprtTrgtCn",
      central ? d.tgtrDtlCn : d.sprtTrgtCn,
    ],
    criteria_text: ["detail.slctCritCn", d.slctCritCn],
    benefit_text: ["detail.alwServCn", d.alwServCn],
    application_method_text: [
      central ? "detail.applmetList[*]" : "detail.aplyMtdCn",
      central
        ? rows(d.applmetList)
            .map((v) =>
              [v.servSeDetailNm, v.servSeDetailLink]
                .filter((x) => x != null)
                .join(" "),
            )
            .join("\n")
        : d.aplyMtdCn,
    ],
    application_period_text: [null, null],
    required_documents_text: [null, null],
    provider_name: [
      central ? "detail.jurMnofNm" : "detail.bizChrDeptNm",
      central ? d.jurMnofNm : d.bizChrDeptNm,
    ],
    reception_text: [null, null],
    contact_text: [
      central ? "detail.rprsCtadr" : "detail.inqplCtadrList[*]",
      central
        ? d.rprsCtadr
        : rows(d.inqplCtadrList)
            .map((v) =>
              [v.wlfareInfoReldNm, v.wlfareInfoReldCn]
                .filter((x) => x != null)
                .join(" "),
            )
            .join("\n"),
    ],
    source_url: ["list.servDtlLink", l.servDtlLink],
    application_url: [null, null],
  };
  const fields = Object.entries(sourceFields).map(([field, [path, value]]) => ({
    field,
    path,
    dedicatedFieldProvided: path !== null,
    whitespaceOnlyEquivalent:
      Object.hasOwn(saved.display, field) &&
      whitespace(value) === whitespace(saved.display[field]),
    numericEntityAndWhitespaceEquivalent:
      Object.hasOwn(saved.display, field) &&
      whitespace(numericEntities(value)) === whitespace(saved.display[field]),
    replayEqual: replay.display[field] === saved.display[field],
    empty: saved.display[field] === null,
  }));
  return {
    provider: saved.provider,
    externalId: saved.external_id,
    snapshotId: saved.applied_snapshot_id,
    storedNormalizerVersion: saved.normalizer_version,
    replayNormalizerVersion: replay.normalizerVersion,
    fixtures: [listFile, detailFile].map((file) => ({
      file,
      sha256: createHash("sha256").update(fixture(file)).digest("hex"),
    })),
    displayReplayEqual: hashJson(saved.display) === hashJson(replay.display),
    // Fixture pages may differ from the later stored capture: not a DB raw-hash assertion.
    fixtureRawHash: replay.rawHash,
    fixtureConditionsHash: replay.conditionsHash,
    fields,
    display: saved.display,
    dates: replay.dates,
    classification: replay.classification,
    additional: replay.additional,
    urls: replay.urls,
  };
});
const summary = {
  policies: policies.length,
  displayReplayEqual: policies.filter((p) => p.displayReplayEqual).length,
  fields: policies.flatMap((p) => p.fields).length,
  whitespaceDifferences: policies
    .flatMap((p) => p.fields)
    .filter((f) => !f.whitespaceOnlyEquivalent).length,
  unexplainedDifferences: policies
    .flatMap((p) => p.fields)
    .filter((f) => !f.numericEntityAndWhitespaceEquivalent).length,
};
writeFileSync(
  outputPath,
  JSON.stringify(
    {
      auditedAt: new Date().toISOString(),
      storedVerifiedAt: stored.verifiedAt,
      scope:
        "Committed public XML fixtures versus historical stored-validation display values. No live raw export; no claim of current DB raw-hash or full normalized replay equality. Whitespace comparison and normalizer display replay are separate checks; semantic review remains required.",
      summary,
      policies,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify(summary));
if (summary.displayReplayEqual !== 4 || summary.unexplainedDifferences)
  process.exitCode = 1;
