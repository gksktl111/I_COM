import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { evaluatePolicyRelevance } from "../../src/features/policy/server/relevance.ts";
import { createRepository } from "../../src/features/policy/server/repository.ts";

async function main() {
  const { values } = parseArgs({ options: { apply: { type: "boolean" } } });
  process.loadEnvFile(".env.local");
  if (values.apply && process.env.POLICY_SYNC_ENABLED !== "true")
    throw new Error("writes-disabled");
  const repository = createRepository();
  const items = [];
  let after = "";
  for (;;) {
    const url = new URL("/rest/v1/policies", process.env.SUPABASE_URL);
    url.search = new URLSearchParams({
      select:
        "source_id,applied_snapshot_id,normalized,policy_sources!inner(provider,external_id)",
      order: "source_id.asc",
      limit: "100",
      ...(after ? { source_id: `gt.${after}` } : {}),
    }).toString();
    const response = await fetch(url, {
      headers: { apikey: process.env.SUPABASE_SECRET_KEY! },
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
    if (!response.ok) throw new Error(`database-http-${response.status}`);
    const rows = (await response.json()) as Array<{
      source_id: string;
      applied_snapshot_id: string;
      normalized: {
        display: Record<string, unknown>;
        displayHash: string;
        normalizerVersion: string;
      };
      policy_sources: { provider: string; external_id: string };
    }>;
    if (!rows.length) break;
    for (const row of rows) {
      const relevance = evaluatePolicyRelevance(row.normalized.display);
      if (values.apply)
        await repository.command("relevance_store", {
          sourceId: row.source_id,
          snapshotId: row.applied_snapshot_id,
          displayHash: row.normalized.displayHash,
          normalizerVersion: row.normalized.normalizerVersion,
          relevance,
        });
      items.push({
        sourceId: row.source_id,
        snapshotId: row.applied_snapshot_id,
        ...row.policy_sources,
        name: row.normalized.display.name,
        display: row.normalized.display,
        relevance,
      });
    }
    after = rows.at(-1)!.source_id;
    if (values.apply) console.log(JSON.stringify({ assessed: items.length }));
  }
  const counts = { RELATED: 0, UNRELATED: 0, REVIEW: 0 };
  for (const item of items) counts[item.relevance.status]++;
  const report = {
    assessedAt: new Date().toISOString(),
    applied: Boolean(values.apply),
    total: items.length,
    counts,
    items,
  };
  await mkdir(".local/policy-sync", { recursive: true, mode: 0o700 });
  await writeFile(
    ".local/policy-sync/relevance-report.json",
    JSON.stringify(report, null, 2),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({ total: items.length, counts, applied: report.applied }),
  );
}
main().catch(() => {
  console.error(
    "관련성 재평가 실패: 저장된 진행 상황과 DB 연결을 확인하세요. 인증키와 원본 오류는 출력하지 않습니다.",
  );
  process.exitCode = 1;
});
