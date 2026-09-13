import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { hashJson } from "../../src/features/policy/server/normalize.ts";
import { prepareReviewActivation, REVIEW_RELEVANCE_VERSION, REVIEW_DISPOSITION_VERSION, REVIEW_CORRECTION_VERSION, REVIEW_REASSESSMENT_VERSION } from "../../src/features/policy/server/review-activation.ts";
import { createRepository } from "../../src/features/policy/server/repository.ts";

async function main() {
  const { values } = parseArgs({ options: {
    input: { type: "string" }, decisions: { type: "string" },
    "out-dir": { type: "string", default: ".local/policy-review/activation" },
    apply: { type: "boolean", default: false },
    "expected-digest": { type: "string" },
    "review-version": { type: "string", default: REVIEW_RELEVANCE_VERSION },
    "record-kept": { type: "boolean", default: false },
  } });
  if (!values.input || !values.decisions) throw new Error("input-and-decisions-required");
  if (values["review-version"] !== REVIEW_RELEVANCE_VERSION && values["review-version"] !== REVIEW_DISPOSITION_VERSION && values["review-version"] !== REVIEW_CORRECTION_VERSION && values["review-version"] !== REVIEW_REASSESSMENT_VERSION)
    throw new Error("invalid-review-version");
  const plan = prepareReviewActivation(
    JSON.parse(await readFile(resolve(values.input), "utf8")),
    JSON.parse(await readFile(resolve(values.decisions), "utf8")),
    values["review-version"],
    values["record-kept"],
  );
  if (values.apply && values["expected-digest"] !== plan.digest)
    throw new Error("review-plan-digest-mismatch");
  const directory = resolve(values["out-dir"]!);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(join(directory, "plan.json"), JSON.stringify(plan, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify({ digest: plan.digest, activate: plan.activateCount, exclude: plan.excludeCount ?? 0, keepReview: plan.keepReviewCount, notReviewed: plan.notReviewedCount, apply: values.apply }));
  if (!values.apply) return;
  process.loadEnvFile(".env.local");
  if (process.env.POLICY_SYNC_ENABLED !== "true") throw new Error("writes-disabled");
  const repository = createRepository();
  const report: {
    planDigest: string; startedAt: string; finishedAt?: string;
    results: { sourceId: string; name: string; status: string; error?: string }[];
  } = { planDigest: plan.digest, startedAt: new Date().toISOString(), results: [] };
  const journal = `apply-${report.startedAt.replaceAll(":", "-")}.json`;
  const save = async () => {
    const content = JSON.stringify(report, null, 2) + "\n";
    await writeFile(join(directory, journal), content, { mode: 0o600 });
    await writeFile(join(directory, "apply-result.json"), content, { mode: 0o600 });
  };
  await save();
  for (const item of plan.items) {
    try {
      await repository.command("relevance_store", item.payload);
      const url = new URL("/rest/v1/policies", process.env.SUPABASE_URL);
      url.search = new URLSearchParams({ select: "source_id,catalog_status,applied_snapshot_id,normalized,relevance", source_id: `eq.${item.payload.sourceId}`, limit: "1" }).toString();
      const response = await fetch(url, { headers: { apikey: process.env.SUPABASE_SECRET_KEY! }, redirect: "error", signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error("verification-read-failed");
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length !== 1) throw new Error("verification-mismatch");
      const row = rows[0];
      const expectedStatus = item.payload.relevance.status === "RELATED" ? "ACTIVE"
        : item.payload.relevance.status === "UNRELATED" ? "EXCLUDED" : "REVIEW";
      if (row.source_id !== item.payload.sourceId || row.catalog_status !== expectedStatus ||
          row.applied_snapshot_id !== item.payload.snapshotId || hashJson(row.normalized) !== item.sourceDigest ||
          hashJson(row.relevance) !== hashJson(item.payload.relevance)) throw new Error("verification-mismatch");
      report.results.push({ sourceId: item.payload.sourceId, name: item.name, status: `VERIFIED_${expectedStatus}` });
      await save();
      if (report.results.length % 25 === 0) console.log(JSON.stringify({ verified: report.results.length }));
    } catch {
      // A transport failure may follow a committed transaction. Preserve the ID;
      // replaying this exact plan is idempotent, never claim rollback or success.
      report.results.push({ sourceId: item.payload.sourceId, name: item.name, status: "NEEDS_RECONCILIATION", error: "apply-or-verification-failed" });
      await save();
      throw new Error("review-activation-stopped-check-journal");
    }
  }
  report.finishedAt = new Date().toISOString();
  await save();
  console.log(JSON.stringify({ verifiedActive: report.results.filter((r) => r.status === "VERIFIED_ACTIVE").length,
    verifiedExcluded: report.results.filter((r) => r.status === "VERIFIED_EXCLUDED").length,
    verifiedReview: report.results.filter((r) => r.status === "VERIFIED_REVIEW").length,
    finishedAt: report.finishedAt, planDigest: plan.digest }));
}
main().catch((error) => {
  const allowed = ["input-and-decisions-required", "review-plan-digest-mismatch", "invalid-review-version", "writes-disabled", "review-activation-stopped-check-journal"];
  console.error(allowed.includes(error?.message) ? error.message : "review-activation-failed-check-local-plan");
  process.exitCode = 1;
});
