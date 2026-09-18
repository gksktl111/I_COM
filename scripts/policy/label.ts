/** Server-only, resumable labeling/reporting for the configured policy database. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import {
  prepareReviewPlan,
  type ReviewBundle,
  type ReviewPlan,
} from "../../src/features/policy/server/labeling-plan.ts";

async function main() {
  const { values } = parseArgs({
    options: {
      apply: { type: "boolean" },
      reviews: { type: "string" },
      output: { type: "string", default: ".local/policy-labeling/report.json" },
    },
  });
  process.loadEnvFile(".env.local");
  if (values.apply && process.env.POLICY_SYNC_ENABLED !== "true")
    throw Error("writes-disabled");
  const base = new URL(
    process.env.SUPABASE_URL ?? "https://unconfigured.invalid",
  );
  const key = process.env.SUPABASE_SECRET_KEY;
  if (
    !key ||
    base.protocol !== "https:" ||
    !base.hostname.endsWith(".supabase.co") ||
    base.username ||
    base.password ||
    base.port
  )
    throw Error("invalid-database-environment");
  async function request(path: string, body?: object) {
    const response = await fetch(new URL(`/rest/v1/${path}`, base), {
      method: body ? "POST" : "GET",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      headers: { apikey: key!, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw Error(`database-http-${response.status}`);
    return response.json();
  }
  async function list(table: string, select: string) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const page = await request(
        `${table}?${new URLSearchParams({ select, order: "source_id.asc", limit: "500", offset: String(offset) })}`,
      );
      if (!Array.isArray(page)) throw Error("invalid-database-response");
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  }
  if (values.apply && !values.reviews) {
    let after = null;
    for (;;) {
      const batch = await request("rpc/policy_label_backfill", {
        p_after: after,
        p_limit: 100,
      });
      if (!batch.processed) break;
      if (!batch.after || batch.after === after)
        throw Error("invalid-batch-cursor");
      after = batch.after;
      console.log(
        JSON.stringify({
          stage: "backfill",
          processed: batch.processed,
          after,
        }),
      );
    }
  }
  const active = await list(
    "policy_active_candidates",
    "source_id,applied_snapshot_id,normalized",
  );
  let labels = await list("policy_current_labels", "*");
  if (values.reviews) {
    const bundleText = await readFile(values.reviews, "utf8");
    const bundle = JSON.parse(bundleText) as ReviewBundle;
    if (!Array.isArray(bundle.items) || typeof bundle.reviewRun !== "string")
      throw Error("invalid-review-bundle");
    const bundleHash = createHash("sha256").update(bundleText).digest("hex");
    const planKey = createHash("sha256")
      .update(base.hostname + ":" + bundle.reviewRun)
      .digest("hex");
    const planPath = `.local/policy-labeling/plan-${planKey}.json`;
    let existing: ReviewPlan | undefined;
    try {
      existing = JSON.parse(await readFile(planPath, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    let plan = prepareReviewPlan(bundle, bundleHash, active, labels, existing);
    if (values.apply && !existing) {
      await mkdir(".local/policy-labeling", { recursive: true, mode: 0o700 });
      try {
        await writeFile(planPath, JSON.stringify(plan, null, 2), {
          flag: "wx",
          mode: 0o600,
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        plan = prepareReviewPlan(
          bundle,
          bundleHash,
          active,
          labels,
          JSON.parse(await readFile(planPath, "utf8")),
        );
      }
    }
    if (values.apply) {
      let reviewed = 0;
      for (const item of bundle.items) {
        const entry = plan.entries[item.sourceId];
        await request("rpc/policy_review_labels", {
          p_payload: {
            observationId: entry.observationId,
            expectedReviewId: entry.expectedReviewId,
            expectedSnapshotId: item.snapshotId,
            expectedNormalized: item.normalized,
            reviewKey: `${bundle.reviewRun}:${item.sourceId}`,
            reviewer: item.reviewer,
            reviewKind: "AI_ASSISTED",
            reason: item.reason,
            assessment: item.assessment,
          },
        });
        if (++reviewed % 100 === 0)
          console.log(JSON.stringify({ stage: "review", reviewed }));
      }
      labels = await list("policy_current_labels", "*");
    }
  }
  const counts: Record<string, number> = {},
    categories: Record<string, number> = {};
  for (const label of labels) {
    const a = label.assessment;
    counts[a.status] = (counts[a.status] ?? 0) + 1;
    for (const c of a.categories) categories[c] = (categories[c] ?? 0) + 1;
  }
  const labeled = new Set(labels.map((l) => l.source_id));
  const missing = active
    .filter((p) => !labeled.has(p.source_id))
    .map((p) => p.source_id);
  const report = {
    at: new Date().toISOString(),
    project: base.hostname,
    applied: Boolean(values.apply),
    active: active.length,
    labeled: labels.length,
    counts,
    categories,
    missing,
    items: labels,
  };
  await mkdir(".local/policy-labeling", { recursive: true, mode: 0o700 });
  await writeFile(values.output!, JSON.stringify(report, null, 2), {
    mode: 0o600,
  });
  console.log(
    JSON.stringify({ ...report, items: undefined, missing: missing.length }),
  );
  if (values.apply && missing.length)
    throw Error("active-policies-missing-labels");
}
main().catch((error) => {
  const code =
    error instanceof Error &&
    /^(writes-disabled|invalid-|database-http-|stale-review-|review-plan-conflict|duplicate-review-source|active-policies-missing-labels)/.test(
      error.message,
    )
      ? error.message
      : "labeling-failed";
  console.error(code);
  process.exitCode = 1;
});
