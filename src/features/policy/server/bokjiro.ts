import { hashJson, plainText } from "./normalize.ts";
import type { FieldSource, UrlMetadata } from "./normalize.ts";
import type { Row } from "./gov24/probe.ts";

export type BokjiProvider = "BOKJIRO_CENTRAL" | "BOKJIRO_LOCAL";
export type BokjiRaw = {
  provider: BokjiProvider;
  apiVersion: "v1";
  externalId: string;
  list: Row;
  detail: Row[];
  xml: { list: string; detail: string };
  evidence: unknown[];
};
const malformed = () => new Error("Invalid XML");
function decode(text: string): string {
  return text.replace(/&([^;]*);|&/g, (whole, entity: string | undefined) => {
    const named: Record<string, string> = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
    };
    if (entity && Object.hasOwn(named, entity)) return named[entity];
    if (!entity || !/^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(entity))
      throw malformed();
    const n =
      entity[1] === "x"
        ? parseInt(entity.slice(2), 16)
        : Number(entity.slice(1));
    if (
      !(
        n === 9 ||
        n === 10 ||
        n === 13 ||
        (n >= 32 && n <= 0xd7ff) ||
        (n >= 0xe000 && n <= 0xfffd) ||
        (n >= 0x10000 && n <= 0x10ffff)
      )
    )
      throw malformed();
    return String.fromCodePoint(n);
  });
}
/** Strict, bounded XML subset used by these element-only public API schemas. */
export function parseXml(xml: string): Record<string, unknown> {
  if (
    Buffer.byteLength(xml) > 2 * 1024 * 1024 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(xml)
  )
    throw malformed();
  type Node = { name: string; children: Row; text: string };
  const stack: Node[] = [];
  let root: unknown,
    roots = 0,
    pos = 0;
  const append = (text: string) => {
    if (stack.length) stack[stack.length - 1].text += text;
    else if (text.trim()) throw malformed();
  };
  while (pos < xml.length) {
    const rest = xml.slice(pos);
    if (rest.startsWith("<!--")) {
      const end = rest.indexOf("-->");
      if (end < 0 || rest.slice(4, end).includes("--")) throw malformed();
      pos += end + 3;
      continue;
    }
    if (rest.startsWith("<![CDATA[")) {
      const end = rest.indexOf("]]>");
      if (end < 0 || !stack.length) throw malformed();
      append(rest.slice(9, end));
      pos += end + 3;
      continue;
    }
    if (rest.startsWith("<?xml ") && pos === 0) {
      const match = rest.match(
        /^<\?xml\s+version=(?:"1\.0"|'1\.0')(?:\s+encoding=(?:"UTF-8"|'UTF-8'))?(?:\s+standalone=(?:"(?:yes|no)"|'(?:yes|no)'))?\s*\?>/,
      );
      if (!match) throw malformed();
      pos += match[0].length;
      continue;
    }
    if (rest[0] !== "<") {
      const end = rest.indexOf("<");
      const t = end < 0 ? rest : rest.slice(0, end);
      if (t.includes("]]>")) throw malformed();
      append(decode(t));
      pos += t.length;
      continue;
    }
    const close = rest.match(/^<\/([A-Za-z_][\w.:-]*)\s*>/);
    if (close) {
      const node = stack.pop();
      if (!node || node.name !== close[1]) throw malformed();
      const value = Object.keys(node.children).length
        ? {
            ...node.children,
            ...(node.text.trim() ? { "#text": node.text } : {}),
          }
        : node.text;
      if (stack.length) {
        const target = stack[stack.length - 1].children;
        if (Object.hasOwn(target, node.name)) {
          const prev = target[node.name];
          target[node.name] = Array.isArray(prev)
            ? [...prev, value]
            : [prev, value];
        } else
          Object.defineProperty(target, node.name, {
            value,
            writable: true,
            enumerable: true,
            configurable: true,
          });
      } else root = value;
      pos += close[0].length;
      continue;
    }
    const open = rest.match(
      /^<([A-Za-z_][\w.:-]*)((?:\s+[A-Za-z_][\w.:-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>/,
    );
    if (!open || stack.length >= 128) throw malformed();
    const attrs = new Set<string>();
    for (const a of open[2].matchAll(
      /([A-Za-z_][\w.:-]*)\s*=\s*("[^"]*"|'[^']*')/g,
    )) {
      if (attrs.has(a[1])) throw malformed();
      attrs.add(a[1]);
      decode(a[2].slice(1, -1));
    }
    if (!stack.length && ++roots !== 1) throw malformed();
    stack.push({ name: open[1], children: {}, text: "" });
    pos += open[0].length;
    if (open[3]) {
      // Process self-closing elements with the same attachment rules.
      const node = stack.pop()!;
      if (stack.length) {
        const target = stack[stack.length - 1].children;
        const prev = target[node.name];
        Object.defineProperty(target, node.name, {
          value: Object.hasOwn(target, node.name)
            ? Array.isArray(prev)
              ? [...prev, ""]
              : [prev, ""]
            : "",
          writable: true,
          enumerable: true,
          configurable: true,
        });
      } else root = "";
    }
  }
  if (root === "" && roots === 1 && !stack.length) return {};
  if (
    stack.length ||
    roots !== 1 ||
    !root ||
    typeof root !== "object" ||
    Array.isArray(root)
  )
    throw malformed();
  return root as Row;
}
export type BokjiCapture = {
  capturedAt: string;
  provider: BokjiProvider;
  kind: "list" | "detail";
  params: Record<string, string>;
  status: number;
  xml: string;
};
const endpoints = {
  BOKJIRO_CENTRAL: {
    list: "NationalWelfareInformationsV001/NationalWelfarelistV001",
    detail: "NationalWelfareInformationsV001/NationalWelfaredetailedV001",
  },
  BOKJIRO_LOCAL: {
    list: "LocalGovernmentWelfareInformations/LcgvWelfarelist",
    detail: "LocalGovernmentWelfareInformations/LcgvWelfaredetailed",
  },
};
export class BokjiClient {
  calls = 0;
  private blocked = false;
  private key: string;
  private provider: BokjiProvider;
  private budget: number;
  private capture?: (capture: BokjiCapture) => Promise<void>;
  private fetcher: typeof fetch;
  constructor(
    key: string,
    provider: BokjiProvider,
    budget: number,
    capture?: (capture: BokjiCapture) => Promise<void>,
    fetcher: typeof fetch = fetch,
  ) {
    if (
      !Object.hasOwn(endpoints, provider) ||
      !Number.isSafeInteger(budget) ||
      budget < 1 ||
      budget > 100
    )
      throw new Error("Invalid client configuration");
    try {
      this.key = decodeURIComponent(key);
    } catch {
      throw new Error("Invalid service key encoding");
    }
    if (!this.key.trim()) throw new Error("Missing service key");
    this.provider = provider;
    this.budget = budget;
    this.capture = capture;
    this.fetcher = fetcher;
  }
  async request(
    kind: "list" | "detail",
    params: Record<string, string>,
  ): Promise<{ xml: string; data: Record<string, unknown> }> {
    if (this.blocked)
      throw new Error("Bokjiro client blocked after access or quota failure");
    if (this.calls >= this.budget)
      throw new Error("Bokjiro request budget exhausted");
    if (kind !== "list" && kind !== "detail")
      throw new Error("Invalid request kind");
    const safe = Object.fromEntries(
      Object.entries(params).filter(([k]) => k.toLowerCase() !== "servicekey"),
    );
    const url = new URL(
      `https://apis.data.go.kr/B554287/${endpoints[this.provider][kind]}`,
    );
    for (const [k, v] of Object.entries(safe)) url.searchParams.set(k, v);
    url.searchParams.set("serviceKey", this.key);
    this.calls++;
    let response: Response, xml: string;
    try {
      response = await this.fetcher(url, {
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
      if ([401, 403, 429].includes(response.status)) this.blocked = true;
      if (!response.body) throw new Error();
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          size += next.value.byteLength;
          if (size > 2 * 1024 * 1024) throw new Error();
          chunks.push(next.value);
        }
      } catch {
        await reader.cancel();
        throw new Error();
      } finally {
        reader.releaseLock();
      }
      xml = new TextDecoder("utf-8", { fatal: true }).decode(
        Buffer.concat(chunks),
      );
    } catch {
      throw new Error("Bokjiro transport or response-size failure");
    }
    const redact = (s: string) =>
      [this.key, encodeURIComponent(this.key)]
        .reduce((v, k) => v.split(k).join("[REDACTED]"), s)
        .replace(
          /(<serviceKey\b[^>]*>)[\s\S]*?(<\/serviceKey>)/gi,
          "$1[REDACTED]$2",
        )
        .replace(/(serviceKey(?:=|%3D))[^&\s<]+/gi, "$1[REDACTED]");
    xml = redact(xml);
    if (this.capture) {
      try {
        await this.capture({
          provider: this.provider,
          kind,
          params: Object.fromEntries(
            Object.entries(safe).map(([k, v]) => [k, redact(v)]),
          ),
          capturedAt: new Date().toISOString(),
          status: response.status,
          xml,
        });
      } catch {
        throw new Error("Bokjiro capture failed");
      }
    }
    if (!response.ok)
      throw new Error(`Bokjiro HTTP failure (${response.status})`);
    const data = parseXml(xml);
    if (["20", "22", "23", "30", "31"].includes(String(data.resultCode)))
      this.blocked = true;
    if (data.resultCode !== "0")
      throw new Error("Bokjiro business response failure");
    return { xml, data };
  }
}
export function normalizeBokji(raw: BokjiRaw) {
  if (
    raw.apiVersion !== "v1" ||
    !Object.hasOwn(endpoints, raw.provider) ||
    !raw.externalId?.trim() ||
    raw.detail.length !== 1
  )
    throw new Error("Invalid Bokjiro bundle identity");
  const d = raw.detail[0],
    l = raw.list,
    central = raw.provider === "BOKJIRO_CENTRAL";
  if (!l || !d || l.servId !== raw.externalId || d.servId !== raw.externalId)
    throw new Error("Service ID mismatch");
  if (typeof d.servNm !== "string" || d.servNm !== l.servNm)
    throw new Error("Service name mismatch");
  const display: Record<string, string | null> = {},
    fieldSources: Record<string, FieldSource> = {},
    urls: Record<string, UrlMetadata> = {},
    warnings: string[] = [];
  const mapping: Record<string, [Row, string, string]> = {
    name: [d, "servNm", "detail"],
    summary: [l, "servDgst", "list"],
    purpose_text: [{}, "purpose", "detail"],
    target_text: [d, central ? "tgtrDtlCn" : "sprtTrgtCn", "detail"],
    criteria_text: [d, "slctCritCn", "detail"],
    benefit_text: [d, "alwServCn", "detail"],
    application_method_text: [
      d,
      central ? "applmetList" : "aplyMtdCn",
      "detail",
    ],
    application_period_text: [{}, "applicationPeriod", "detail"],
    required_documents_text: [{}, "requiredDocuments", "detail"],
    provider_name: [d, central ? "jurMnofNm" : "bizChrDeptNm", "detail"],
    reception_text: [{}, "reception", "detail"],
    contact_text: [d, central ? "rprsCtadr" : "inqplCtadrList", "detail"],
    source_url: [l, "servDtlLink", "list"],
    application_url: [{}, "applicationUrl", "detail"],
  };
  for (const [key, [row, field, endpoint]] of Object.entries(mapping)) {
    let value = row[field];
    if (field === "applmetList" || field === "inqplCtadrList")
      value = rows(value)
        .map((v) =>
          [
            v[central ? "servSeDetailNm" : "wlfareInfoReldNm"],
            v[central ? "servSeDetailLink" : "wlfareInfoReldCn"],
          ]
            .map((x) => {
              if (x != null && typeof x !== "string")
                throw new Error("Invalid Bokjiro nested text field");
              return x;
            })
            .filter((x) => x != null)
            .join(" "),
        )
        .join("\n");
    if (value != null && typeof value !== "string")
      throw new Error("Invalid Bokjiro text field");
    const text = value as string | null | undefined;
    const emptyKind = !Object.hasOwn(row, field)
      ? "missing"
      : text == null
        ? "null"
        : text === ""
          ? "empty"
          : !text.trim()
            ? "whitespace"
            : null;
    fieldSources[key] = { endpoint, field, emptyKind, fallback: false };
    if (key.endsWith("_url")) {
      const meta: UrlMetadata = {
        raw: text ?? null,
        value: null,
        status: emptyKind ? "empty" : "invalid",
        endpoint,
        field,
      };
      if (text && /^https?:\/\//i.test(text) && !/[\s\\]/u.test(text)) {
        try {
          const u = new URL(text);
          if (u.hostname && !u.username && !u.password) {
            meta.value = text;
            meta.status = "valid";
          }
        } catch {}
      }
      urls[key] = meta;
      display[key] = meta.value;
      if (meta.status === "invalid") warnings.push(`invalid-url:${key}`);
    } else display[key] = emptyKind ? null : plainText(text!);
  }
  if (!display.name) throw new Error("Required service name is empty");
  const classification = Object.fromEntries(
    Object.entries(d).filter(([k]) => /Array$/.test(k)),
  );
  const additional = Object.fromEntries(
    Object.entries(d).filter(([k]) => /List$/.test(k)),
  );
  const dates = Object.fromEntries(
    ["crtrYr", "svcfrstRegTs", "lastModYmd", "enfcBgngYmd", "enfcEndYmd"].map(
      (k) => [k, { list: l[k] ?? null, detail: d[k] ?? null }],
    ),
  );
  const sourceModified = {
    list: l.lastModYmd ?? null,
    detail: d.lastModYmd ?? null,
  };
  return {
    display,
    fieldSources,
    urls,
    warnings,
    classification,
    additional,
    dates,
    sourceModified,
    rawHash: hashJson({
      provider: raw.provider,
      apiVersion: raw.apiVersion,
      externalId: raw.externalId,
      list: l,
      detail: raw.detail,
      xml: raw.xml,
    }),
    displayHash: hashJson(display),
    conditionsHash: hashJson({
      list: conditionEvidence(l),
      detail: conditionEvidence(d),
    }),
    normalizerVersion: "bokjiro-2",
    hashVersion: "sha256-sorted-json-v1",
  };
}
/**
 * Conservative review signal, not an eligibility verdict: benefits, procedures,
 * dates and nested legal/form/link context can all carry conditions. Include new
 * source fields by default; exclude only known view counts and response metadata.
 * Whole-page XML and capture telemetry are not evidence for this policy's rules.
 */
function conditionEvidence(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => !["inqNum", "resultCode", "resultMessage"].includes(key),
    ),
  );
}
function rows(value: unknown): Row[] {
  if (value == null || value === "") return [];
  const all = Array.isArray(value) ? value : [value];
  if (all.some((v) => !v || typeof v !== "object" || Array.isArray(v)))
    throw new Error("Invalid Bokjiro list");
  return all as Row[];
}
