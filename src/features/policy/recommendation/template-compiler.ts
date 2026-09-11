import { createHash } from "node:crypto";
import bank from "../../../../docs/fixtures/policy-recommendation/category-question-bank-v1.json" with { type: "json" };
import { hashJson } from "../server/normalize.ts";
import { validateCatalog } from "./engine.ts";
import {
  expandConditionTemplate,
  type TemplateCondition,
} from "./condition-templates.ts";
import type {
  Catalog,
  Expression,
  Policy,
  Predicate,
  QuestionDefinition,
  Subject,
} from "./types.ts";

export type TemplateSource = {
  id: string;
  title: string;
  version: string;
  fields: Record<string, string | null>;
  evidenceDocuments?: Record<string, { url: string; text: string }>;
};
export type TemplateRecipe = {
  sampleId: string;
  policyId: string;
  category: string;
  disposition: string;
  notes: string[];
  paths: {
    id: string;
    purpose: string;
    subject?: Subject["kind"];
    conditions: TemplateCondition[];
    gaps: string[];
  }[];
};
export type PreparationIssue = {
  policyId: string;
  sampleId: string;
  status: "PREPARED_DRAFT" | "HELD" | "INVALID";
  codes: string[];
  details: string[];
  ruleCount: number;
  questionCount: number;
};
const evidenceFields = new Set([
  "name",
  "summary",
  "provider_name",
  "purpose_text",
  "target_text",
  "criteria_text",
  "benefit_text",
  "application_period_text",
  "application_method_text",
  "required_documents_text",
]);
const categories = new Set([
  "pregnancy",
  "childcare",
  "care",
  "health",
  "education",
  "housing",
]);
const documentSlug = /^[a-z][a-z0-9-]{0,47}$/;
function safeDocumentSlug(value: string): boolean {
  return (
    documentSlug.test(value) && !["constructor", "prototype"].includes(value)
  );
}
function validateDocuments(value: unknown): void {
  if (value === undefined) return;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    Object.keys(value).length > 100
  )
    fail("INVALID_EVIDENCE_DOCUMENTS");
  for (const [slug, candidate] of Object.entries(value)) {
    if (!safeDocumentSlug(slug)) fail("INVALID_EVIDENCE_DOCUMENT_SLUG");
    if (
      candidate &&
      typeof candidate === "object" &&
      ![Object.prototype, null].includes(Object.getPrototypeOf(candidate))
    )
      fail("INVALID_EVIDENCE_DOCUMENT");
    const doc = record(candidate, ["url", "text"]);
    const url = text(doc.url, 4096);
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      fail("INVALID_EVIDENCE_DOCUMENT_URL");
    }
    if (
      !url.startsWith("https://") ||
      /[\s\\]/u.test(url) ||
      parsed.protocol !== "https:" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      url.trim() !== url
    )
      fail("INVALID_EVIDENCE_DOCUMENT_URL");
    text(doc.text, 2_000_000);
  }
}
function fail(code: string): never {
  throw new Error(code);
}
function record(value: unknown, allowed: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail("INVALID_OBJECT");
  const r = value as Record<string, unknown>;
  if (Object.keys(r).some((key) => !allowed.includes(key)))
    fail("UNSUPPORTED_FIELD");
  return r;
}
function text(value: unknown, max = 5000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    fail("INVALID_TEXT");
  return value;
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100) fail("INVALID_LIST");
  return value.map((item) => text(item));
}
function validateBankSubject(
  condition: TemplateCondition,
  subject: Subject["kind"],
  category: string,
) {
  if (!["BANK_CODE", "BANK_NUMBER_RANGE"].includes(condition.template)) return;
  const q = bank.questions.find((q) => q.id === condition.params.questionId);
  if (!q?.fact || !q.categories.includes(category))
    fail("BANK_PATH_SUBJECT_MISMATCH");
  // Household facts bind the shared household, independently of the path beneficiary.
  if (q.fact.subject === "HOUSEHOLD") {
    if (condition.subject !== "HOUSEHOLD") fail("BANK_PATH_SUBJECT_MISMATCH");
    return;
  }
  if (q.fact.subject === "SELECTED_SCOPE") {
    const expected = category === "housing" ? "HOUSEHOLD" : "BENEFICIARY";
    if (condition.subject !== expected) fail("BANK_PATH_SUBJECT_MISMATCH");
  }
  const allowed =
    q.fact.subject === "EACH_CHILD"
      ? ["CHILD"]
      : ["PREGNANCY_EVENT", "BIRTH_EVENT"].includes(q.fact.subject)
        ? ["EVENT"]
        : q.fact.subject === "SELECTED_PERSON"
          ? category === "health"
            ? ["PERSON", "CHILD"]
            : ["PERSON"]
          : q.fact.subject === "SELECTED_SCOPE"
            ? category === "pregnancy"
              ? ["PERSON"]
              : category === "health"
                ? ["PERSON", "CHILD"]
                : category === "housing"
                  ? ["HOUSEHOLD"]
                  : ["CHILD"]
            : [];
  if (!allowed.includes(subject)) fail("BANK_PATH_SUBJECT_MISMATCH");
}
function recipeShape(input: unknown): TemplateRecipe {
  const r = record(input, [
    "sampleId",
    "policyId",
    "category",
    "disposition",
    "notes",
    "paths",
  ]);
  const category = text(r.category, 64);
  if (!categories.has(category)) fail("INVALID_CATEGORY");
  if (!Array.isArray(r.paths) || r.paths.length > 50) fail("INVALID_PATHS");
  const paths = r.paths.map((value) => {
    const path = record(value, [
      "id",
      "purpose",
      "subject",
      "conditions",
      "gaps",
    ]);
    const subject =
      path.subject ??
      (["education", "childcare", "care"].includes(category)
        ? "CHILD"
        : undefined);
    if (!["CHILD", "PERSON", "EVENT", "HOUSEHOLD"].includes(subject as string))
      fail("MISSING_PATH_SUBJECT");
    if (!Array.isArray(path.conditions) || path.conditions.length > 100)
      fail("INVALID_CONDITIONS");
    const conditions = path.conditions.map((value) => {
      const c = record(value, ["template", "subject", "params", "evidence"]);
      if (!["BENEFICIARY", "HOUSEHOLD"].includes(c.subject as string))
        fail("INVALID_SUBJECT");
      if (!c.params || typeof c.params !== "object" || Array.isArray(c.params))
        fail("INVALID_PARAMS");
      if (
        !Array.isArray(c.evidence) ||
        !c.evidence.length ||
        c.evidence.length > 30
      )
        fail("MISSING_EVIDENCE");
      return {
        template: text(c.template, 64),
        subject: c.subject as TemplateCondition["subject"],
        params: c.params as Record<string, unknown>,
        evidence: c.evidence.map((value) => {
          const e = record(value, ["field", "quote"]);
          const field = text(e.field, 64);
          if (
            !evidenceFields.has(field) &&
            !(field.startsWith("official.") && safeDocumentSlug(field.slice(9)))
          )
            fail("UNSUPPORTED_EVIDENCE_FIELD");
          return { field, quote: text(e.quote, 100000) };
        }),
      };
    });
    return {
      id: text(path.id, 256),
      purpose: text(path.purpose, 256),
      subject: subject as Subject["kind"],
      conditions,
      gaps: strings(path.gaps),
    };
  });
  if (new Set(paths.map((p) => p.id)).size !== paths.length)
    fail("DUPLICATE_PATH");
  return {
    sampleId: text(r.sampleId, 256),
    policyId: text(r.policyId, 256),
    category,
    disposition: text(r.disposition, 64),
    notes: strings(r.notes),
    paths,
  };
}

/** Explicit recipes only: no natural-language eligibility inference and no release authority.
 * A literal quote match proves provenance, not that an interpretation is correct.
 * One malformed recipe is quarantined without discarding independent valid policies.
 */
export function compilePolicyTemplates(
  sources: TemplateSource[],
  inputs: unknown[],
): { catalog: Catalog; queue: PreparationIssue[] } {
  if (!Array.isArray(inputs) || inputs.length > 10000) fail("INVALID_BATCH");
  const byId = new Map<string, TemplateSource>();
  const documentErrors = new Map<string, string>();
  for (const source of sources) {
    text(source.id, 256);
    text(source.title);
    if (byId.has(source.id)) fail("DUPLICATE_SOURCE");
    if (!/^[a-f0-9]{64}$/.test(source.version)) fail("INVALID_SOURCE_VERSION");
    if (
      !source.fields ||
      Array.isArray(source.fields) ||
      Object.values(source.fields).some(
        (v) => v !== null && typeof v !== "string",
      )
    )
      fail("INVALID_SOURCE_FIELDS");
    try {
      validateDocuments(source.evidenceDocuments);
    } catch (error) {
      documentErrors.set(
        source.id,
        error instanceof Error ? error.message : "INVALID_EVIDENCE_DOCUMENTS",
      );
    }
    byId.set(
      source.id,
      structuredClone(
        documentErrors.has(source.id)
          ? { ...source, evidenceDocuments: undefined }
          : source,
      ),
    );
  }
  const policyIds = inputs.map((r) =>
    r && typeof r === "object" && "policyId" in r ? r.policyId : undefined,
  );
  const policies: Policy[] = [],
    questions = new Map<string, QuestionDefinition>(),
    queue: PreparationIssue[] = [];
  for (let index = 0; index < inputs.length; index++) {
    const identity =
      typeof policyIds[index] === "string"
        ? (policyIds[index] as string)
        : `invalid-${index}`;
    let sampleId = identity;
    try {
      const recipe = recipeShape(inputs[index]);
      sampleId = recipe.sampleId;
      if (policyIds.filter((id) => id === identity).length !== 1)
        fail("DUPLICATE_RECIPE");
      const documentError = documentErrors.get(identity);
      if (documentError) fail(documentError);
      if (recipe.disposition !== "CANDIDATE") {
        queue.push({
          policyId: identity,
          sampleId,
          status: "HELD",
          codes: ["SCOPE_REVIEW_REQUIRED"],
          details: recipe.notes,
          ruleCount: 0,
          questionCount: 0,
        });
        continue;
      }
      const source = byId.get(identity);
      if (!source) fail("MISSING_SOURCE");
      if (!recipe.paths.length) fail("MISSING_PATHS");
      const rules: Predicate[] = [],
        localQuestions = new Map<string, QuestionDefinition>();
      const evidenceFor = (condition: TemplateCondition) =>
        condition.evidence.map((e) => {
          if (e.field.startsWith("official.")) {
            const slug = e.field.slice(9);
            const document = source.evidenceDocuments?.[slug];
            if (!document) fail("MISSING_EVIDENCE_DOCUMENT");
            if (!document.text.includes(e.quote))
              fail("EVIDENCE_NOT_IN_DOCUMENT");
            const digest = createHash("sha256")
              .update(document.text, "utf8")
              .digest("hex");
            return `${source.id}@${source.version}:${e.field}@${encodeURIComponent(document.url)}#sha256=${digest}:quote=${hashJson(e.quote)}`;
          }
          if (!source.fields[e.field]?.includes(e.quote))
            fail("EVIDENCE_NOT_IN_SOURCE");
          return `${source.id}@${source.version}:${e.field}#${hashJson(e.quote)}`;
        });
      const paths = recipe.paths.map((path) => {
        const children: Expression[] = [];
        for (let i = 0; i < path.conditions.length; i++) {
          const c = path.conditions[i],
            refs = evidenceFor(c);
          validateBankSubject(c, path.subject!, recipe.category);
          const expanded = expandConditionTemplate(c, recipe.policyId);
          const { fact, negate, question, ...predicate } = expanded;
          const id = `${path.id}:condition-${i + 1}`;
          rules.push({
            ...predicate,
            id,
            fact,
            label: question?.prompt ?? `${c.template}: ${path.purpose}`,
            evidenceRefs: refs,
            review: "UNREVIEWED",
            sourceVersion: source.version,
          } as Predicate);
          const expression: Expression = { kind: "PREDICATE", ruleId: id };
          children.push(
            negate ? { kind: "NOT", child: expression } : expression,
          );
          if (question) {
            const content = { ...question, fact, prerequisites: [] };
            const key = `template-${hashJson(content)}`;
            localQuestions.set(key, {
              ...content,
              id: key,
              version: hashJson(content),
            });
          }
        }
        // A partial extraction never establishes completeness, even if all found clauses match.
        children.push({ kind: "UNRESOLVED" });
        return {
          id: path.id,
          subject: path.subject!,
          complete: false,
          expression: { kind: "ALL" as const, children },
          purposes: [path.purpose],
          purposesComplete: false,
          purposeEvidence: path.conditions.flatMap(evidenceFor),
          availability: "UNKNOWN" as const,
          availabilityEvidence: [],
        };
      });
      policies.push({
        id: source.id,
        title: source.title,
        category: recipe.category,
        sourceVersion: source.version,
        release: "HIDDEN",
        releaseSourceVersion: source.version,
        completePaths: false,
        rules,
        paths,
      });
      for (const [id, q] of localQuestions) questions.set(id, q);
      queue.push({
        policyId: identity,
        sampleId,
        status: "PREPARED_DRAFT",
        codes: ["HUMAN_REVIEW_REQUIRED", "INCOMPLETE_PATHS"],
        details: [...recipe.notes, ...recipe.paths.flatMap((p) => p.gaps)],
        ruleCount: rules.length,
        questionCount: localQuestions.size,
      });
    } catch (error) {
      queue.push({
        policyId: identity,
        sampleId,
        status: "INVALID",
        codes: [error instanceof Error ? error.message : "INVALID_RECIPE"],
        details: [],
        ruleCount: 0,
        questionCount: 0,
      });
    }
  }
  policies.sort((a, b) => a.id.localeCompare(b.id));
  const questionList = [...questions.values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const catalog = {
    version: hashJson({
      compiler: "condition-template-1",
      policies,
      questions: questionList,
    }),
    policies,
    questions: questionList,
  };
  validateCatalog(catalog);
  return { catalog, queue };
}
