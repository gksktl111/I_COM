import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import {
  ProbeClient,
  collectPages,
  observations,
  redact,
} from "../../src/features/policy/server/gov24/probe.ts";
import type { Row } from "../../src/features/policy/server/gov24/probe.ts";

const usage = `Manual Gov24 probe (Node 24):
  node --experimental-strip-types scripts/policy/probe-gov24.ts search --keyword 양육 [--agency 서울] [--page 1] [--per-page 5] [--budget 1]
  node --experimental-strip-types scripts/policy/probe-gov24.ts collect --samples selection.json [--per-page 5] [--max-pages 3] [--budget 40]
selection.json: {"samples":[{"id":"actual ID","reason":"selection reason","listRecord":{ "서비스ID":"actual ID" },"provenance":{"artifact":".local/policy-probe/<run>/request-001.json","rowIndex":0}}]}
Select 5–10 distinct IDs from saved search responses. All artifacts are local, sanitized observations; completeness and code meanings require review.`;
function integer(value: string | undefined, fallback: number, max: number) {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max)
    throw new Error("Invalid numeric option");
  return n;
}
async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean" },
      keyword: { type: "string" },
      agency: { type: "string" },
      page: { type: "string" },
      "per-page": { type: "string" },
      budget: { type: "string" },
      samples: { type: "string" },
      "max-pages": { type: "string" },
    },
  });
  if (values.help) {
    console.log(usage);
    return;
  }
  const mode = positionals[0];
  if (positionals.length !== 1 || !["search", "collect"].includes(mode))
    throw new Error("Expected search or collect; use --help");
  const perPage = integer(values["per-page"], 5, 100);
  const budget = integer(values.budget, mode === "search" ? 1 : 40, 200);
  const page = integer(values.page, 1, 1000);
  const maxPages = integer(values["max-pages"], 3, 20);
  if (
    mode === "search" &&
    (!values.keyword?.trim() || values.samples || values["max-pages"])
  )
    throw new Error("Search requires keyword and rejects samples/max-pages");
  if (
    mode === "collect" &&
    (!values.samples || values.keyword || values.agency || values.page)
  )
    throw new Error("Collect requires samples and rejects search options");
  try {
    process.loadEnvFile(".env.local");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error("Could not load local environment");
  }
  const key = process.env.GOV24_API_KEY;
  if (!key) {
    console.error("GOV24_API_KEY is required");
    process.exitCode = 1;
    return;
  }
  const schema = JSON.parse(
    await readFile("docs/fixtures/gov24/official-schema.json", "utf8"),
  );
  let samples: {
    id: string;
    reason: string;
    listRecord: Row;
    provenance: { artifact: string; rowIndex: number };
  }[] = [];
  if (mode === "collect") {
    const input = JSON.parse(await readFile(values.samples!, "utf8"));
    if (
      !Array.isArray(input.samples) ||
      input.samples.length < 5 ||
      input.samples.length > 10
    )
      throw new Error("Select 5–10 samples");
    samples = input.samples;
    for (const s of samples) {
      if (
        !s ||
        typeof s.id !== "string" ||
        !s.id.trim() ||
        typeof s.reason !== "string" ||
        !s.reason.trim() ||
        s.listRecord?.["서비스ID"] !== s.id ||
        typeof s.provenance?.artifact !== "string" ||
        !Number.isInteger(s.provenance.rowIndex) ||
        s.provenance.rowIndex < 0
      )
        throw new Error("Invalid sample or provenance");
      const saved = JSON.parse(await readFile(s.provenance.artifact, "utf8"));
      if (
        saved.endpoint !== "serviceList" ||
        saved.status !== 200 ||
        typeof saved.at !== "string" ||
        !Number.isInteger(saved.page) ||
        !saved.filters ||
        JSON.stringify(saved.body?.data?.[s.provenance.rowIndex]) !==
          JSON.stringify(s.listRecord)
      )
        throw new Error("Sample does not match stored list response");
    }
    if (new Set(samples.map((s) => s.id)).size !== samples.length)
      throw new Error("Duplicate selected ID");
  }
  const dir = `.local/policy-probe/${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
  await mkdir(dir, { recursive: true, mode: 0o700 });
  let sequence = 0;
  const client = new ProbeClient(key, budget, async (capture) => {
    await writeFile(
      `${dir}/request-${String(++sequence).padStart(3, "0")}.json`,
      JSON.stringify(capture, null, 2),
      { mode: 0o600 },
    );
  });
  const save = async (name: string, data: unknown) =>
    writeFile(
      `${dir}/${name}.json`,
      JSON.stringify(redact(data, client.key), null, 2),
      { mode: 0o600 },
    );
  const result: Record<string, unknown> = {
    mode,
    startedAt: new Date().toISOString(),
    apiVersion: "v3",
    budget,
    perPage,
    maxPages,
    realResponse: true,
    contractStatus: "unverified",
  };
  let failed = false;
  try {
    if (mode === "search") {
      const filters: Record<string, string> = {
        "cond[서비스명::LIKE]": values.keyword!,
      };
      if (values.agency) filters["cond[소관기관명::LIKE]"] = values.agency;
      const rows = await client.request("serviceList", page, perPage, filters);
      result.rows = rows;
      result.observations = observations(rows, schema.models.serviceList);
    } else {
      await save("selection", { samples });
      const policies = [];
      for (const sample of samples) {
        const detail = await collectPages(
          client,
          "serviceDetail",
          sample.id,
          perPage,
          maxPages,
        );
        const conditions = await collectPages(
          client,
          "supportConditions",
          sample.id,
          perPage,
          maxPages,
        );
        if (
          detail.error ||
          conditions.error ||
          detail.duplicates ||
          conditions.duplicates ||
          detail.envelopeAnomalies ||
          conditions.envelopeAnomalies ||
          detail.quarantined ||
          conditions.quarantined ||
          detail.termination === "page-cap" ||
          conditions.termination === "page-cap"
        )
          failed = true;
        policies.push({
          ...sample,
          detail,
          conditions,
          observations: {
            serviceList: observations(
              [sample.listRecord],
              schema.models.serviceList,
            ),
            serviceDetail: observations(
              detail.rows,
              schema.models.serviceDetail,
            ),
            supportConditions: observations(
              conditions.rows,
              schema.models.supportConditions,
            ),
          },
        });
      }
      result.policies = policies;
    }
  } catch {
    failed = true;
    result.error = "Probe stopped; inspect sanitized request artifacts";
  }
  if (client.anomalyCount) failed = true;
  result.envelopeAnomalies = client.anomalyCount;
  result.calls = client.calls;
  result.finishedAt = new Date().toISOString();
  result.reviewRequired = true;
  result.incompleteOrAnomalous = failed;
  await save("summary", result);
  console.log(`Saved probe artifacts: ${dir}`);
  if (failed) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Probe failed: check options, environment, and input provenance. Use --help.",
  );
  process.exitCode = 1;
});
