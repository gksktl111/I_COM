import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import {
  normalizeBokji,
  type BokjiRaw,
} from "../../src/features/policy/server/bokjiro.ts";
import { hashJson } from "../../src/features/policy/server/normalize.ts";

// Read-only exports in, public verification metadata out. Never loads credentials.
const [beforePath, afterPath, outputPath] = process.argv.slice(2);
if (
  !beforePath ||
  !afterPath ||
  !outputPath ||
  [beforePath, afterPath].includes(outputPath)
) {
  throw new Error(
    "Usage: verify-bokjiro-reprocess.ts <before.json> <after.json|-> <report.json>",
  );
}
type Row = {
  provider: BokjiRaw["provider"];
  external_id: string;
  applied_snapshot_id: string;
  captured_at: string;
  raw_hash: string;
  raw: BokjiRaw;
  normalized: ReturnType<typeof normalizeBokji>;
};
type Export = { queriedAt: string; rows: Row[] };
const read = (path: string): Export => JSON.parse(readFileSync(path, "utf8"));
const before = read(beforePath),
  after = afterPath === "-" ? null : read(afterPath);
const id = (r: Row) => `${r.provider}/${r.external_id}`;
const expected = [
  "BOKJIRO_CENTRAL/WLF00000024",
  "BOKJIRO_CENTRAL/WLF00000030",
  "BOKJIRO_LOCAL/WLF00002249",
  "BOKJIRO_LOCAL/WLF00002340",
];
assert.deepEqual(before.rows.map(id).sort(), expected);
if (after) assert.deepEqual(after.rows.map(id).sort(), expected);
const policies = before.rows.map((row) => {
  assert.equal(id(row), `${row.raw.provider}/${row.raw.externalId}`);
  const replay = normalizeBokji(row.raw);
  const d = row.raw.detail[0];
  // Explicit previous committed bokjiro-1 contract, not a current rule verdict.
  const legacyHash = hashJson({
    target:
      d[row.provider === "BOKJIRO_CENTRAL" ? "tgtrDtlCn" : "sprtTrgtCn"] ??
      null,
    criteria: d.slctCritCn ?? null,
    classification: replay.classification,
  });
  assert.equal(row.raw_hash, replay.rawHash, `${id(row)} raw hash`);
  assert.equal(row.normalized.normalizerVersion, "bokjiro-1");
  assert.equal(
    hashJson(row.normalized),
    hashJson({
      ...replay,
      conditionsHash: legacyHash,
      normalizerVersion: "bokjiro-1",
    }),
    `${id(row)} full legacy normalization`,
  );
  assert.equal(replay.displayHash, row.normalized.displayHash);
  assert.notEqual(replay.conditionsHash, legacyHash);
  const applied = after?.rows.find((r) => id(r) === id(row));
  if (after) {
    assert.ok(applied);
    assert.equal(applied.applied_snapshot_id, row.applied_snapshot_id);
    assert.equal(applied.raw_hash, row.raw_hash);
    assert.equal(applied.captured_at, row.captured_at);
    assert.equal(
      hashJson(applied.raw),
      hashJson(row.raw),
      `${id(row)} complete raw preservation`,
    );
    assert.equal(
      hashJson(applied.normalized),
      hashJson(replay),
      `${id(row)} full v2 replay`,
    );
  }
  return {
    provider: row.provider,
    externalId: row.external_id,
    snapshotId: row.applied_snapshot_id,
    capturedAt: row.captured_at,
    rawHash: row.raw_hash,
    displayHash: replay.displayHash,
    beforeConditionsHash: legacyHash,
    afterConditionsHash: replay.conditionsHash,
    beforeVersion: row.normalized.normalizerVersion,
    afterVersion: replay.normalizerVersion,
    rawHashMatches: true,
    fullLegacyReplayEqual: true,
    displayUnchanged: true,
    conditionsChanged: true,
    remoteApplied: !!applied,
    rawAndSnapshotUnchanged: applied ? true : null,
    fullV2ReplayEqual: applied ? true : null,
  };
});
const report = {
  verifiedAt: new Date().toISOString(),
  beforeQueriedAt: before.queriedAt,
  afterQueriedAt: after?.queriedAt ?? null,
  scope: after
    ? "Four authorized applied DB snapshots: full v1/v2 replay, raw/snapshot/display preservation and conditions hash change. No policy eligibility or current-law approval."
    : "Preflight on four authorized v1 DB snapshots. Full legacy replay and planned v2 differences; no assertion of remote v2 application.",
  policies,
};
writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    policies: policies.length,
    fullLegacyReplayEqual: policies.length,
    remoteApplied: !!after,
  }),
);
