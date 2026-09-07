import { createHash } from "node:crypto";
import { Parser } from "htmlparser2";
import type { Row, Capture } from "./gov24/probe.ts";

export type RawBundle = {
  externalId: string;
  apiVersion: "v3";
  list: Row;
  detail: Row[];
  conditions: Row[];
  evidence: Capture[];
};
export type FieldSource = {
  endpoint: string;
  field: string;
  emptyKind: string | null;
  fallback: false;
};
export type UrlMetadata = {
  raw: string | null;
  value: string | null;
  status: "empty" | "valid" | "invalid";
  endpoint: string;
  field: string;
};
export type ModifiedMetadata = {
  raw: unknown;
  status: "empty" | "valid" | "invalid";
  format: "YYYYMMDDHHmmss" | "YYYY-MM-DD";
  day: string | null;
};
export type NormalizedBundle = {
  display: Record<string, string | null>;
  fieldSources: Record<string, FieldSource>;
  urls: Record<string, UrlMetadata>;
  modified: { list: ModifiedMetadata; detail: ModifiedMetadata };
  warnings: string[];
  rawHash: string;
  displayHash: string;
  conditionsHash: string;
  normalizerVersion: string;
  hashVersion: string;
};

export function hashJson(value: unknown): string {
  function stable(v: unknown): unknown {
    if (v === null || typeof v === "string" || typeof v === "boolean") return v;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (Array.isArray(v)) return v.map(stable);
    if (
      v &&
      typeof v === "object" &&
      Object.getPrototypeOf(v) === Object.prototype
    )
      return Object.fromEntries(
        Object.keys(v)
          .sort()
          .map((k) => [k, stable((v as Row)[k])]),
      );
    throw new Error("Non-JSON raw value");
  }
  return createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
}

function plainText(raw: string): string | null {
  let out = "",
    hidden = 0;
  const lists: (number | null)[] = [];
  const block = new Set([
    "p",
    "div",
    "section",
    "article",
    "h1",
    "h2",
    "h3",
    "h4",
    "tr",
    "blockquote",
    "ul",
    "ol",
    "li",
  ]);
  const parser = new Parser(
    {
      onopentag(name, attrs) {
        if (name === "script" || name === "style") hidden++;
        if (hidden) return;
        if (block.has(name) || name === "br") out += "\n";
        if (name === "ol")
          lists.push(
            /^-?\d+$/.test(attrs.start ?? "") ? Number(attrs.start) : 1,
          );
        if (name === "ul") lists.push(null);
        if (name === "li" && lists.length && lists[lists.length - 1] !== null) {
          if (/^-?\d+$/.test(attrs.value ?? ""))
            lists[lists.length - 1] = Number(attrs.value);
          out += `${lists[lists.length - 1]}. `;
          lists[lists.length - 1]!++;
        }
      },
      ontext(text) {
        if (!hidden) out += text;
      },
      onclosetag(name) {
        if (name === "script" || name === "style") {
          hidden--;
          return;
        }
        if (hidden) return;
        if (block.has(name)) out += "\n";
        if (name === "ul" || name === "ol") lists.pop();
      },
    },
    { decodeEntities: true },
  );
  parser.end(raw.replace(/\r\n?/g, "\n"));
  return (
    out
      .split("\n")
      .map((line) => line.trim())
      .join("\n")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim() || null
  );
}
function emptyKind(row: Row, field: string): string | null {
  if (!Object.hasOwn(row, field)) return "missing";
  const v = row[field];
  if (v === null) return "null";
  if (typeof v !== "string") throw new Error(`Invalid text type: ${field}`);
  return v === "" ? "empty" : !v.trim() ? "whitespace" : null;
}
function dateMetadata(
  raw: unknown,
  format: ModifiedMetadata["format"],
): ModifiedMetadata {
  const result: ModifiedMetadata = {
    raw: raw ?? null,
    format,
    status: raw == null || raw === "" ? "empty" : "invalid",
    day: null,
  };
  const match =
    typeof raw === "string"
      ? raw.match(
          format === "YYYY-MM-DD"
            ? /^(\d{4})-(\d{2})-(\d{2})$/
            : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/,
        )
      : null;
  if (!match) return result;
  const [, y, m, d, h = "0", min = "0", s = "0"] = match;
  const year = Number(y),
    month = Number(m),
    day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day >
      [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ||
    Number(h) > 23 ||
    Number(min) > 59 ||
    Number(s) > 59
  )
    return result;
  return { ...result, status: "valid", day: `${y}-${m}-${d}` };
}
const fields: Record<string, string> = {
  name: "서비스명",
  purpose_text: "서비스목적",
  target_text: "지원대상",
  criteria_text: "선정기준",
  benefit_text: "지원내용",
  application_method_text: "신청방법",
  application_period_text: "신청기한",
  required_documents_text: "구비서류",
  provider_name: "소관기관명",
  reception_text: "접수기관명",
  contact_text: "문의처",
};
const knownConditions = new Set(
  "JA0101 JA0102 JA0110 JA0111 JA0201 JA0202 JA0203 JA0204 JA0205 JA0301 JA0302 JA0303 JA0313 JA0314 JA0315 JA0316 JA0317 JA0318 JA0319 JA0320 JA0322 JA0326 JA0327 JA0328 JA0329 JA0330 JA0401 JA0402 JA0403 JA0404 JA0410 JA0411 JA0412 JA0413 JA0414 JA1101 JA1102 JA1103 JA1201 JA1202 JA1299 JA2101 JA2102 JA2103 JA2201 JA2202 JA2203 JA2299".split(
    " ",
  ),
);

export function normalizeBundle(bundle: RawBundle): NormalizedBundle {
  if (
    !bundle ||
    bundle.apiVersion !== "v3" ||
    typeof bundle.externalId !== "string" ||
    !bundle.externalId.trim()
  )
    throw new Error("Invalid bundle identity");
  if (
    !Array.isArray(bundle.detail) ||
    bundle.detail.length !== 1 ||
    !Array.isArray(bundle.conditions) ||
    bundle.conditions.length !== 1
  )
    throw new Error("Expected exactly one detail and conditions row");
  for (const row of [bundle.list, ...bundle.detail, ...bundle.conditions])
    if (
      !row ||
      typeof row !== "object" ||
      Array.isArray(row) ||
      row["서비스ID"] !== bundle.externalId
    )
      throw new Error("Invalid row or service ID mismatch");
  const detail = bundle.detail[0];
  if (
    typeof detail["서비스명"] !== "string" ||
    detail["서비스명"] !== bundle.list["서비스명"]
  )
    throw new Error("Service name mismatch");
  const display: NormalizedBundle["display"] = {},
    fieldSources: NormalizedBundle["fieldSources"] = {},
    urls: NormalizedBundle["urls"] = {},
    warnings: string[] = [];
  for (const [key, field] of Object.entries({
    ...fields,
    summary: "서비스목적요약",
    source_url: "상세조회URL",
    application_url: "온라인신청사이트URL",
  })) {
    const endpoint =
      key === "summary" || key === "source_url"
        ? "serviceList"
        : "serviceDetail";
    const row = endpoint === "serviceList" ? bundle.list : detail;
    const kind = emptyKind(row, field);
    fieldSources[key] = { endpoint, field, emptyKind: kind, fallback: false };
    if (key.endsWith("_url")) {
      const raw =
        typeof row[field] === "string" ? (row[field] as string) : null;
      const meta: UrlMetadata = {
        raw,
        value: null,
        status: kind ? "empty" : "invalid",
        endpoint,
        field,
      };
      if (
        !kind &&
        raw &&
        /^https?:\/\//i.test(raw) &&
        !/[\s\\]/u.test(raw) &&
        !/https?:\/\//i.test(raw.slice(raw.indexOf("://") + 3))
      ) {
        try {
          const url = new URL(raw);
          if (url.hostname && !url.username && !url.password) {
            meta.status = "valid";
            meta.value = raw;
          }
        } catch {
          /* Invalid URLs remain raw evidence. */
        }
      }
      urls[key] = meta;
      display[key] = meta.value;
      if (meta.status === "invalid") warnings.push(`invalid-url:${key}`);
    } else display[key] = kind ? null : plainText(row[field] as string);
  }
  if (!display.name) throw new Error("Required service name is empty");
  for (const field of ["지원내용", "신청방법", "소관기관명"])
    if (
      Object.hasOwn(bundle.list, field) &&
      Object.hasOwn(detail, field) &&
      bundle.list[field] !== detail[field]
    )
      warnings.push(`list-detail-conflict:${field}`);
  const applicationRaw = urls.application_url.raw;
  if (applicationRaw)
    for (const value of Object.values(detail))
      if (typeof value === "string")
        for (const candidate of value.match(/https?:\/\/[^\s<>"']+/g) ?? [])
          if (
            candidate !== applicationRaw &&
            candidate.startsWith(applicationRaw) &&
            !/^[)\],.;]+$/.test(candidate.slice(applicationRaw.length))
          )
            warnings.push("application-url-possible-truncation:no-repair");
  for (const [code, value] of Object.entries(bundle.conditions[0])) {
    if (["서비스ID", "서비스명"].includes(code)) continue;
    if (
      !knownConditions.has(code) ||
      !(
        value === null ||
        (["JA0110", "JA0111"].includes(code)
          ? Number.isInteger(value)
          : value === "Y")
      )
    )
      warnings.push(`UNKNOWN-condition:${code}`);
  }
  const modified = {
    list: dateMetadata(bundle.list["수정일시"], "YYYYMMDDHHmmss"),
    detail: dateMetadata(detail["수정일시"], "YYYY-MM-DD"),
  };
  for (const [endpoint, value] of Object.entries(modified))
    if (value.status !== "valid")
      warnings.push(`unverified-modified:${endpoint}`);
  if (
    modified.list.day &&
    modified.detail.day &&
    modified.list.day !== modified.detail.day
  )
    warnings.push("list-detail-modified-day-conflict");
  return {
    display,
    fieldSources,
    urls,
    modified,
    warnings: [...new Set(warnings)].sort(),
    rawHash: hashJson({
      apiVersion: bundle.apiVersion,
      externalId: bundle.externalId,
      list: bundle.list,
      detail: bundle.detail,
      conditions: bundle.conditions,
      complete: true,
    }),
    displayHash: hashJson(display),
    conditionsHash: hashJson(bundle.conditions),
    normalizerVersion: "1",
    hashVersion: "sha256-sorted-json-v1",
  };
}
export function compareNormalized(
  current: NormalizedBundle | null,
  next: NormalizedBundle,
) {
  return {
    changedFields: [
      ...new Set([
        ...Object.keys(current?.display ?? {}),
        ...Object.keys(next.display),
      ]),
    ]
      .filter((key) => !current || current.display[key] !== next.display[key])
      .sort(),
    rawChanged: current?.rawHash !== next.rawHash,
    displayChanged: current?.displayHash !== next.displayHash,
    conditionsChanged: current?.conditionsHash !== next.conditionsHash,
  };
}
