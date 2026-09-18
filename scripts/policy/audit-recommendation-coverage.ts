import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { auditRecommendationCoverage } from "../../src/features/policy/server/recommendation-coverage.ts";
import {
  sixFieldPreparedCatalog,
  sixFieldSourceVersions,
} from "../../src/features/policy/server/catalogs/six-field-prepared.ts";
const { values } = parseArgs({
  strict: true,
  options: {
    input: { type: "string" },
    "out-dir": { type: "string", default: "/tmp/icom-recommendation-coverage" },
  },
});
if (!values.input)
  throw new Error(
    "--input requires a saved ACTIVE recommendation source inventory",
  );
const result = auditRecommendationCoverage(
  JSON.parse(await readFile(resolve(values.input), "utf8")),
  {
    catalog: sixFieldPreparedCatalog,
    sourceVersions: sixFieldSourceVersions,
  },
);
const output = resolve(values["out-dir"]!);
await mkdir(output, { recursive: true });
await writeFile(
  join(output, "coverage.json"),
  JSON.stringify(result, null, 2) + "\n",
);
const { rows, ...summary } = result;
await writeFile(
  join(output, "summary.json"),
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    output,
    ...result.summary,
    queueCount: rows.length,
    fields: result.fields,
  }),
);
