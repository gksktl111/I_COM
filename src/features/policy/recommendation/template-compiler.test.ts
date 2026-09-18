import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  compilePolicyTemplates,
  type TemplateRecipe,
  type TemplateSource,
} from "./template-compiler.ts";
import { evaluateRecommendation } from "./engine.ts";
import { educationRequest } from "./education.fixture.ts";
const source: TemplateSource = {
  id: "source-a",
  title: "Test education",
  version: "a".repeat(64),
  fields: {
    target_text: "Support for HIGH school students.",
    benefit_text: "Learning materials.",
  },
};
function recipe(id = "source-a"): TemplateRecipe {
  return {
    sampleId: id,
    policyId: id,
    category: "education",
    disposition: "CANDIDATE",
    notes: [],
    paths: [
      {
        id: "school",
        purpose: "learning",
        conditions: [
          {
            template: "SCHOOL_STAGE",
            subject: "BENEFICIARY",
            params: { values: ["HIGH"] },
            evidence: [{ field: "target_text", quote: "HIGH school students" }],
          },
        ],
        gaps: ["Exceptions not reviewed"],
      },
    ],
  };
}
test("one reusable template compiles independent policies while never creating public approval or complete eligibility", () => {
  const second = { ...source, id: "source-b", version: "b".repeat(64) };
  const original = [recipe(), recipe("source-b")];
  const before = structuredClone(original);
  const result = compilePolicyTemplates([source, second], original);
  assert.equal(result.catalog.policies.length, 2);
  assert.equal(result.catalog.questions.length, 1);
  assert(
    result.catalog.policies.every(
      (p) =>
        p.release === "HIDDEN" &&
        !p.completePaths &&
        p.rules.every((r) => r.review === "UNREVIEWED"),
    ),
  );
  assert(
    result.catalog.policies.every((p) =>
      p.paths.every(
        (path) =>
          path.expression.kind === "ALL" &&
          path.expression.children.some((e) => e.kind === "UNRESOLVED"),
      ),
    ),
  );
  assert.deepEqual(original, before);
  const response = evaluateRecommendation(result.catalog, {
    ...educationRequest,
    mode: "PUBLIC",
    phase: "RESULTS",
  });
  assert.equal(response.cards.length, 0);
  assert.equal(
    result.queue.filter((q) => q.status === "PREPARED_DRAFT").length,
    2,
  );
});
test("stale quotes and unsupported recipe authority quarantine only the affected policy", () => {
  const invalid = recipe();
  invalid.paths[0].conditions[0].evidence[0].quote = "an invented rule";
  const other = { ...source, id: "source-b" };
  const result = compilePolicyTemplates(
    [source, other],
    [invalid, recipe("source-b")],
  );
  assert.deepEqual(
    result.catalog.policies.map((p) => p.id),
    ["source-b"],
  );
  assert.equal(result.queue[0].codes[0], "EVIDENCE_NOT_IN_SOURCE");
  assert.equal(
    compilePolicyTemplates([source], [{ ...recipe(), release: "HUMAN" }])
      .queue[0].status,
    "INVALID",
  );
  assert.equal(
    compilePolicyTemplates([source], [{ ...recipe(), disposition: "HOLD" }])
      .queue[0].status,
    "HELD",
  );
});
test("recipe duplicates cannot override each other and changed source versions invalidate the compiled catalog", () => {
  const dup = compilePolicyTemplates([source], [recipe(), recipe()]);
  assert.equal(dup.catalog.policies.length, 0);
  assert(dup.queue.every((q) => q.codes.includes("DUPLICATE_RECIPE")));
  assert.throws(
    () => compilePolicyTemplates([source, source], [recipe()]),
    /DUPLICATE_SOURCE/,
  );
  const first = compilePolicyTemplates([source], [recipe()]);
  const changed = compilePolicyTemplates(
    [{ ...source, version: "b".repeat(64) }],
    [recipe()],
  );
  assert.notEqual(first.catalog.version, changed.catalog.version);
  assert.notEqual(
    first.catalog.policies[0].rules[0].evidenceRefs[0],
    changed.catalog.policies[0].rules[0].evidenceRefs[0],
  );
});
test("unresolved reference periods create no precision question or inferred current-period fact", () => {
  const r = recipe();
  r.paths[0].conditions = [
    {
      template: "RECOGNIZED_INCOME_RATIO",
      subject: "HOUSEHOLD",
      params: { max: 50, reference: "POLICY_REFERENCE_UNCONFIRMED" },
      evidence: [{ field: "target_text", quote: "HIGH school students" }],
    },
  ];
  const out = compilePolicyTemplates([source], [r]);
  assert.equal(out.catalog.questions.length, 0);
  assert.equal(out.catalog.policies[0].rules[0].fact.subject, "HOUSEHOLD");
  assert.equal(
    out.catalog.policies[0].rules[0].fact.reference,
    "POLICY_REFERENCE_UNCONFIRMED",
  );
});

function officialFixture() {
  const s: TemplateSource = {
    ...structuredClone(source),
    evidenceDocuments: {
      "school-notice": {
        url: "https://example.go.kr/notice",
        text: "Official: HIGH school students. Further terms.",
      },
    },
  };
  const r = recipe();
  r.paths[0].conditions[0].evidence[0].field = "official.school-notice";
  return { s, r };
}

test("official evidence binds exact quote, URL and full document content without rewriting source identity or approval", () => {
  const { s, r } = officialFixture();
  const before = structuredClone(s);
  const first = compilePolicyTemplates([s], [r]);
  const policy = first.catalog.policies[0];
  const ref = policy.rules[0].evidenceRefs[0];
  const doc = s.evidenceDocuments!["school-notice"];
  assert(ref.includes(`${s.id}@${s.version}`));
  assert(ref.includes(encodeURIComponent(doc.url)));
  assert(ref.includes(createHash("sha256").update(doc.text).digest("hex")));
  assert.equal(policy.sourceVersion, s.version);
  assert.equal(policy.releaseSourceVersion, s.version);
  assert.equal(policy.release, "HIDDEN");
  assert.equal(policy.completePaths, false);
  assert(policy.paths.every((p) => !p.complete && !p.purposesComplete));
  assert(policy.rules.every((rule) => rule.review === "UNREVIEWED"));
  for (const modification of [
    { text: doc.text + " Updated exception." },
    { url: doc.url + "?revision=2" },
  ]) {
    const changed = structuredClone(s);
    Object.assign(changed.evidenceDocuments!["school-notice"], modification);
    const next = compilePolicyTemplates([changed], [r]);
    assert.notEqual(next.catalog.version, first.catalog.version);
    assert.notEqual(next.catalog.policies[0].rules[0].evidenceRefs[0], ref);
    assert.equal(next.catalog.policies[0].sourceVersion, s.version);
  }
  assert.deepEqual(s, before);
});

test("missing and stale official documents quarantine one policy even if original fields contain the quote", () => {
  const { s, r } = officialFixture();
  const other = { ...source, id: "source-b" };
  for (const bad of [
    { ...s, evidenceDocuments: undefined },
    {
      ...s,
      evidenceDocuments: {
        "school-notice": {
          url: "https://example.go.kr/notice",
          text: "HIGH  school students",
        },
      },
    },
  ]) {
    const result = compilePolicyTemplates(
      [bad, other],
      [r, recipe("source-b")],
    );
    assert.equal(result.queue[0].status, "INVALID");
    assert.deepEqual(
      result.catalog.policies.map((p) => p.id),
      ["source-b"],
    );
  }
  const whitespace = structuredClone(r);
  whitespace.paths[0].conditions[0].evidence[0].quote = "high school students";
  assert.equal(
    compilePolicyTemplates([s], [whitespace]).queue[0].codes[0],
    "EVIDENCE_NOT_IN_DOCUMENT",
  );
});

test("every supplemental document is validated, including unreferenced documents", () => {
  for (const documents of [
    { notice: { url: "http://example.go.kr/notice", text: "Text" } },
    {
      notice: { url: "https://user:secret@example.go.kr/notice", text: "Text" },
    },
    { "../notice": { url: "https://example.go.kr/notice", text: "Text" } },
    { notice: { url: "https://example.go.kr/notice", text: " " } },
    {
      notice: {
        url: "https://example.go.kr/notice",
        text: "Text",
        review: "HUMAN",
      },
    },
  ]) {
    const result = compilePolicyTemplates(
      [
        {
          ...source,
          evidenceDocuments:
            documents as unknown as TemplateSource["evidenceDocuments"],
        },
      ],
      [recipe()],
    );
    assert.equal(result.queue[0].status, "INVALID");
    assert.equal(result.catalog.policies.length, 0);
  }
  const { s, r } = officialFixture();
  r.paths[0].conditions[0].evidence[0].field = "official../notice";
  assert.equal(compilePolicyTemplates([s], [r]).queue[0].status, "INVALID");
});

test("bank templates enforce beneficiary kinds while household facts remain usable on person paths", () => {
  const make = (
    category: string,
    subject: "CHILD" | "PERSON" | "EVENT" | "HOUSEHOLD",
    questionId: string,
  ) => {
    const r = recipe();
    r.category = category;
    r.paths[0].subject = subject;
    const numeric = ["P03", "P04"].includes(questionId);
    r.paths[0].conditions[0] = {
      template: numeric ? "BANK_NUMBER_RANGE" : "BANK_CODE",
      subject: questionId.startsWith("L") ? "HOUSEHOLD" : "BENEFICIARY",
      params: numeric
        ? {
            questionId,
            min: 0,
            max: 12,
            minInclusive: true,
            maxInclusive: false,
          }
        : {
            questionId,
            values: [
              questionId === "B01"
                ? "HOME"
                : questionId === "P02"
                  ? "PREGNANT"
                  : questionId === "L01"
                    ? "OWNED"
                    : "HEALTH_INSURANCE",
            ],
          },
      evidence: [{ field: "target_text", quote: "HIGH school students" }],
    };
    return r;
  };
  for (const [category, kind, id] of [
    ["pregnancy", "PERSON", "P03"],
    ["pregnancy", "CHILD", "P04"],
    ["pregnancy", "EVENT", "P02"],
    ["childcare", "PERSON", "B01"],
    ["health", "EVENT", "H03"],
  ] as const)
    assert.equal(
      compilePolicyTemplates([source], [make(category, kind, id)]).queue[0]
        .codes[0],
      "BANK_PATH_SUBJECT_MISMATCH",
    );
  for (const [category, kind, id] of [
    ["pregnancy", "EVENT", "P03"],
    ["pregnancy", "EVENT", "P04"],
    ["pregnancy", "PERSON", "P02"],
    ["health", "CHILD", "H03"],
    ["health", "PERSON", "H03"],
    ["housing", "PERSON", "L01"],
  ] as const)
    assert.equal(
      compilePolicyTemplates([source], [make(category, kind, id)]).queue[0]
        .status,
      "PREPARED_DRAFT",
    );
});
