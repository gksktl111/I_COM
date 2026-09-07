import fs from "node:fs";
import { hashJson, normalizeBundle } from "../../src/features/policy/server/normalize.ts";
import type { RawBundle, NormalizedBundle } from "../../src/features/policy/server/normalize.ts";

// Offline audit of a read-only DB export. Never reads credentials or writes to DB.
const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath || inputPath === outputPath) {
  throw new Error("Usage: node --experimental-strip-types scripts/policy/audit-stored.ts <DB-export.json> <report.json>");
}
const input = JSON.parse(fs.readFileSync(inputPath, "utf8")) as {
  queriedAt: string;
  rows: Array<{
    external_id: string;
    applied_snapshot_id: string;
    captured_at: string;
    raw_hash: string;
    raw: RawBundle;
    normalized: NormalizedBundle;
  }>;
};
const policies = input.rows.map((row) => {
  const n = row.normalized;
  const fields = Object.entries(n.fieldSources).map(([field, source]) => {
    const raw = (source.endpoint === "serviceList" ? row.raw.list : row.raw.detail[0])[source.field];
    // Independent, deliberately narrow oracle: these samples should differ only
    // in whitespace. A future HTML sample needs semantic review, not a relaxed pass.
    const expected = typeof raw === "string"
      ? raw.replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim())
          .join("\n").replace(/\n{4,}/g, "\n\n\n").trim() || null
      : null;
    return {
      field, rawField: source.field, endpoint: source.endpoint,
      whitespaceOnlyEquivalent: n.display[field] === expected,
      empty: raw == null, rawType: raw === null ? "null" : typeof raw,
    };
  });
  return {
    externalId: row.external_id, snapshotId: row.applied_snapshot_id,
    rawHash: row.raw_hash, capturedAt: row.captured_at,
    normalizerVersion: n.normalizerVersion,
    replayEqual: hashJson(normalizeBundle(row.raw)) === hashJson(n),
    rawHashMatches: n.rawHash === row.raw_hash,
    fields, display: n.display, urls: n.urls, warnings: n.warnings,
    conditions: row.raw.conditions[0],
  };
});
fs.writeFileSync(outputPath, JSON.stringify({
  queriedAt: input.queriedAt,
  scope: "Stored development DB snapshots; no fresh Gov24 fetch; whitespace equivalence is independent of normalizer replay.",
  policies,
}, null, 2) + "\n");
console.log(JSON.stringify({
  policies: policies.length,
  replayEqual: policies.filter((p) => p.replayEqual).length,
  hashMatches: policies.filter((p) => p.rawHashMatches).length,
  fields: policies.flatMap((p) => p.fields).length,
  whitespaceDifferences: policies.flatMap((p) => p.fields.filter((f) => !f.whitespaceOnlyEquivalent)).length,
}));
