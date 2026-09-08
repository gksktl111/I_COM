import { hashJson, plainText } from "./normalize.ts";
import type { NormalizedBundle, RawBundle } from "./normalize.ts";
import type { BokjiRaw, normalizeBokji } from "./bokjiro.ts";

type Normalized = NormalizedBundle | ReturnType<typeof normalizeBokji>;
export type QualityIssue = {
  code: string;
  severity: "INFO" | "WARNING" | "ERROR";
  field: string | null;
  kind:
    | "SOURCE_MISSING"
    | "NORMALIZATION"
    | "SOURCE_VALIDITY"
    | "CHANGE"
    | "UNVERIFIED";
  message: string;
};
export type QualityAssessment = {
  version: "policy-quality-1";
  status: "PASS" | "REVIEW" | "ERROR";
  metrics: { required: number; present: number; missing: number };
  issues: QualityIssue[];
  comparisonReady: false;
};
const required = [
  "name",
  "summary",
  "target_text",
  "benefit_text",
  "provider_name",
  "source_url",
];
const optional = [
  "criteria_text",
  "application_method_text",
  "application_period_text",
  "required_documents_text",
  "contact_text",
];
const hasText = (v: unknown): v is string =>
  typeof v === "string" && Boolean(v.trim());
function sourceStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object")
    return Object.values(value).flatMap(sourceStrings);
  return [];
}

/** Failure codes are an allowlist: exception text and provider payloads never enter reports. */
export function failureQuality(code: string): QualityAssessment {
  const safe = [
    "COLLECTION_FAILED",
    "NORMALIZATION_FAILED",
    "IDENTITY_MISMATCH",
    "INCOMPLETE_BUNDLE",
    "INVALID_RAW",
    "INGESTION_FAILED",
  ].includes(code)
    ? code
    : "INGESTION_FAILED";
  return {
    version: "policy-quality-1",
    status: "ERROR",
    metrics: { required: 0, present: 0, missing: 0 },
    issues: [
      {
        code: safe,
        severity: "ERROR",
        field: null,
        kind: "NORMALIZATION",
        message: "Policy ingestion failed; no quality assessment is available.",
      },
    ],
    comparisonReady: false,
  };
}

/** Deterministic technical assessment. PASS does not certify publication or eligibility. */
export function evaluatePolicyQuality(
  raw: RawBundle | BokjiRaw,
  normalized: Normalized,
  previous?: Normalized | null,
): QualityAssessment {
  const issues: QualityIssue[] = [];
  const add = (
    code: string,
    severity: QualityIssue["severity"],
    field: string | null,
    kind: QualityIssue["kind"],
    message: string,
  ) => {
    if (!issues.some((i) => i.code === code && i.field === field))
      issues.push({ code, severity, field, kind, message });
  };
  const bokji = "provider" in raw;
  const idField = bokji ? "servId" : "서비스ID";
  const sourceRows = [
    raw.list,
    ...raw.detail,
    ...("conditions" in raw ? raw.conditions : []),
  ];
  if (
    !raw.externalId?.trim() ||
    raw.detail.length !== 1 ||
    ("conditions" in raw && raw.conditions.length !== 1) ||
    sourceRows.some((row) => row[idField] !== raw.externalId)
  ) {
    add(
      "IDENTITY_MISMATCH",
      "ERROR",
      null,
      "SOURCE_VALIDITY",
      "Source rows do not share a complete policy identity.",
    );
  }
  try {
    const expectedRaw = bokji
      ? {
          provider: raw.provider,
          apiVersion: raw.apiVersion,
          externalId: raw.externalId,
          list: raw.list,
          detail: raw.detail,
          xml: raw.xml,
        }
      : {
          apiVersion: raw.apiVersion,
          externalId: raw.externalId,
          list: raw.list,
          detail: raw.detail,
          conditions: raw.conditions,
          complete: true,
        };
    if (hashJson(expectedRaw) !== normalized.rawHash)
      add(
        "RAW_HASH_MISMATCH",
        "ERROR",
        null,
        "NORMALIZATION",
        "Normalized data is not bound to this raw snapshot.",
      );
    if (hashJson(normalized.display) !== normalized.displayHash)
      add(
        "DISPLAY_HASH_MISMATCH",
        "ERROR",
        null,
        "NORMALIZATION",
        "Display content does not match its recorded hash.",
      );
  } catch {
    add(
      "INVALID_RAW",
      "ERROR",
      null,
      "SOURCE_VALIDITY",
      "Source evidence is not valid JSON.",
    );
  }

  for (const field of [...required, ...optional]) {
    if (hasText(normalized.display[field])) continue;
    if (normalized.urls[field]?.status === "invalid") continue;
    const source = normalized.fieldSources[field];
    if (source && source.emptyKind === null) {
      add(
        "DISPLAY_CONTENT_LOST",
        "ERROR",
        field,
        "NORMALIZATION",
        "A supplied source field has no display content.",
      );
      continue;
    }
    // These markers only locate retained procedural text. They do not extract rules,
    // dates or document requirements, nor establish completeness of that information.
    const marker =
      field === "required_documents_text"
        ? /서류|준비물/
        : field === "application_period_text"
          ? /신청\s*(기간|기한)|접수\s*(기간|기한)|상시\s*신청/
          : null;
    const retainedElsewhere =
      marker &&
      sourceStrings([raw.list, raw.detail]).some((value) =>
        marker.test(value),
      ) &&
      Object.entries(normalized.display).some(
        ([key, value]) =>
          key.endsWith("_text") && hasText(value) && marker.test(value),
      );
    add(
      retainedElsewhere
        ? "DEDICATED_FIELD_MISSING_TEXT_RETAINED"
        : "SOURCE_FIELD_MISSING",
      "WARNING",
      field,
      "SOURCE_MISSING",
      retainedElsewhere
        ? "Dedicated field is absent; related text is retained elsewhere and needs review for completeness."
        : `Source field is ${source?.emptyKind ?? "missing"}; no value or absence of restrictions is inferred.`,
    );
  }

  for (const [field, meta] of Object.entries(normalized.urls)) {
    if (meta.status === "invalid")
      add(
        "INVALID_URL",
        "WARNING",
        field,
        "NORMALIZATION",
        "Source URL has invalid syntax; raw evidence is retained.",
      );
  }
  const link = normalized.display.source_url;
  if (hasText(link)) {
    try {
      const url = new URL(link);
      const syntax =
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !/[\s\\]/u.test(link);
      if (!syntax) throw new Error();
      const domain = bokji ? "bokjiro.go.kr" : "gov.kr";
      const expectedHost =
        url.hostname === domain || url.hostname === `www.${domain}`;
      const identity = bokji
        ? url.pathname === "/ssis-tbu/twataa/wlfareInfo/moveTWAT52011M.do" &&
          url.searchParams.getAll("wlfareInfoId").length === 1 &&
          url.searchParams.get("wlfareInfoId") === raw.externalId &&
          url.searchParams.get("wlfareInfoReldBztpCd") ===
            (raw.provider === "BOKJIRO_CENTRAL" ? "01" : "02")
        : url.pathname === `/portal/rcvfvrSvc/dtlEx/${raw.externalId}`;
      if (!expectedHost || !identity || url.port)
        add(
          "SOURCE_LINK_MISMATCH",
          "WARNING",
          "source_url",
          "SOURCE_VALIDITY",
          "Source link does not match the expected provider host, policy path and identifier.",
        );
    } catch {
      add(
        "INVALID_URL",
        "WARNING",
        "source_url",
        "NORMALIZATION",
        "Source URL has invalid syntax; raw evidence is retained.",
      );
    }
  }

  for (const warning of normalized.warnings) {
    if (
      warning.startsWith("invalid-url:") ||
      warning.startsWith("unverified-modified:")
    )
      continue;
    const code = warning.startsWith("application-url-possible-truncation")
      ? "POSSIBLE_URL_TRUNCATION"
      : warning.startsWith("UNKNOWN-condition:")
        ? "UNKNOWN_CONDITION_CODE"
        : warning.startsWith("list-detail-")
          ? "SOURCE_CONFLICT"
          : "NORMALIZER_WARNING";
    add(
      code,
      "WARNING",
      code === "POSSIBLE_URL_TRUNCATION" ? "application_url" : null,
      code === "UNKNOWN_CONDITION_CODE" || code === "SOURCE_CONFLICT"
        ? "SOURCE_VALIDITY"
        : "NORMALIZATION",
      "Normalizer reported an unresolved source or transformation concern; review retained evidence.",
    );
  }
  if ("modified" in normalized) {
    for (const [endpoint, meta] of Object.entries(normalized.modified)) {
      if (meta.status !== "valid")
        add(
          meta.status === "invalid"
            ? "INVALID_MODIFIED_DATE"
            : "MODIFIED_DATE_MISSING",
          "WARNING",
          `modified.${endpoint}`,
          meta.status === "invalid" ? "NORMALIZATION" : "SOURCE_MISSING",
          "Source modification date is missing or malformed; freshness is unverified.",
        );
    }
  } else {
    for (const endpoint of ["list", "detail"] as const) {
      const value = normalized.sourceModified[endpoint];
      if (value == null || value === "")
        add(
          "MODIFIED_DATE_MISSING",
          "WARNING",
          `modified.${endpoint}`,
          "SOURCE_MISSING",
          "Source modification date is unavailable; freshness is unverified.",
        );
      else {
        const text = typeof value === "string" ? value : "";
        const compact = text.replace(/-/g, "");
        const iso = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
        const date = new Date(`${iso}T00:00:00Z`);
        if (
          !/^(\d{8}|\d{4}-\d{2}-\d{2})$/.test(text) ||
          !Number.isFinite(date.getTime()) ||
          date.toISOString().slice(0, 10) !== iso
        )
          add(
            "INVALID_MODIFIED_DATE",
            "WARNING",
            `modified.${endpoint}`,
            "NORMALIZATION",
            "Source modification date is malformed; freshness is unverified.",
          );
      }
    }
  }
  // Compare numeric tokens against mapped source text without deriving eligibility.
  for (const [field, source] of Object.entries(normalized.fieldSources)) {
    if (field.endsWith("_url")) continue;
    const row = /list$/i.test(source.endpoint) ? raw.list : raw.detail[0];
    const value = row?.[source.field];
    if (typeof value !== "string" || !hasText(normalized.display[field]))
      continue;
    const tokens = (text: string) => text.match(/\d+(?:[.,]\d+)*/g) ?? [];
    if (
      JSON.stringify(tokens(plainText(value) ?? "")) !==
      JSON.stringify(tokens(normalized.display[field]!))
    )
      add(
        "NUMERIC_CONTENT_MISMATCH",
        "ERROR",
        field,
        "NORMALIZATION",
        "Numeric content differs between source text and display; review before use.",
      );
  }
  if (previous) {
    if (
      previous.normalizerVersion !== normalized.normalizerVersion ||
      previous.hashVersion !== normalized.hashVersion
    )
      add(
        "TRANSFORMATION_VERSION_CHANGED",
        "WARNING",
        null,
        "CHANGE",
        "Transformation version changed; review differences before attributing them to the source.",
      );
    if (previous.rawHash !== normalized.rawHash)
      add(
        "RAW_SOURCE_CHANGED",
        "WARNING",
        null,
        "CHANGE",
        "Raw snapshot changed; impact is unreviewed and is not an eligibility change verdict.",
      );
    if (previous.conditionsHash !== normalized.conditionsHash)
      add(
        "CONDITION_EVIDENCE_CHANGED",
        "WARNING",
        null,
        "CHANGE",
        "Condition evidence changed; eligibility impact requires review.",
      );
  }
  add(
    "SOURCE_OFFICIALITY_UNVERIFIED",
    "INFO",
    "source_url",
    "UNVERIFIED",
    "Expected URL shape does not verify official content or policy identity on the destination page.",
  );
  add(
    "SOURCE_ACCESS_UNVERIFIED",
    "INFO",
    "source_url",
    "UNVERIFIED",
    "Source availability and current page content have not been checked over HTTP.",
  );
  add(
    "ELIGIBILITY_UNVERIFIED",
    "INFO",
    null,
    "UNVERIFIED",
    "Eligibility rules, exceptions and completeness have not been reviewed for comparison.",
  );
  const present = required.filter((field) =>
    hasText(normalized.display[field]),
  ).length;
  issues.sort((a, b) =>
    a.code < b.code
      ? -1
      : a.code > b.code
        ? 1
        : (a.field ?? "") < (b.field ?? "")
          ? -1
          : (a.field ?? "") > (b.field ?? "")
            ? 1
            : 0,
  );
  return {
    version: "policy-quality-1",
    status: issues.some((i) => i.severity === "ERROR")
      ? "ERROR"
      : issues.some((i) => i.severity === "WARNING")
        ? "REVIEW"
        : "PASS",
    metrics: {
      required: required.length,
      present,
      missing: required.length - present,
    },
    issues,
    comparisonReady: false,
  };
}
