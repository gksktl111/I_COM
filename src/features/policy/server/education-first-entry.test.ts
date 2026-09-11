import assert from "node:assert/strict";
import test from "node:test";
import { educationDraftCatalog } from "./catalogs/education-2026.ts";
import { educationRequest } from "../recommendation/education.fixture.ts";
import { evaluateRecommendation } from "../recommendation/engine.ts";
import { bindFact } from "../recommendation/facts.ts";
import type {
  Answer,
  Catalog,
  Context,
  FactValue,
  Request,
} from "../recommendation/types.ts";

function fixture() {
  const catalog: Catalog = structuredClone(educationDraftCatalog);
  catalog.policies = catalog.policies.filter(
    (p) => p.id === "065aebae-110a-41a6-9c07-c816be1209b9",
  );
  const policy = catalog.policies[0];
  policy.release = "FIXTURE";
  policy.rules.forEach((r) => {
    r.review = "FIXTURE";
  });
  const context: Context = {
    mode: "FIXTURE",
    sourceVersion: policy.sourceVersion,
    beneficiary: { kind: "CHILD", id: "child-1" },
    household: { kind: "HOUSEHOLD", id: "household-1" },
    answers: [],
  };
  const answers: Answer[] = policy.rules
    .filter(
      (r) => !r.id.startsWith("gwanak-stage-") || r.id.endsWith("elementary"),
    )
    .map((r) => {
      assert.equal(r.operator, "EQ");
      if (r.operator !== "EQ") throw new Error("unexpected-predicate");
      const expected = r.id === "gwanak-school-seoul" ? "경기도" : r.expected;
      const value: FactValue =
        typeof expected === "boolean"
          ? { kind: "BOOLEAN", value: expected }
          : { kind: "CODE", value: expected as string };
      const q = catalog.questions.find(
        (q) => JSON.stringify(q.fact) === JSON.stringify(r.fact),
      );
      return {
        questionId: q?.id,
        questionVersion: q?.version,
        key: bindFact(r.fact, context),
        state: "PROVIDED",
        source: "USER_DECLARED",
        recordedAt: "2026-09-11T00:00:00Z",
        value,
      };
    });
  const request: Request = {
    ...educationRequest,
    selectedChildren: ["child-1"],
    phase: "RESULTS",
    needs: ["entry-preparation"],
    answers,
  };
  return { catalog, request };
}

function setValue(request: Request, attribute: string, value: FactValue) {
  const answer = request.answers.find((a) => a.key.attribute === attribute);
  assert.ok(answer?.state === "PROVIDED");
  answer.value = value;
}

test("ordinary first entry can match while exception coverage and availability remain unknown", () => {
  const before = JSON.stringify(educationDraftCatalog);
  const { catalog, request } = fixture();
  const result = evaluateRecommendation(catalog, request);
  const card = result.cards[0];
  assert.ok(card);
  assert.equal(card.eligibility, "ELIGIBLE");
  assert.ok(
    card.pathResults.some(
      (t) =>
        t.pathId === "gwanak-2026-first-elementary" &&
        t.eligibility.value === "ELIGIBLE",
    ),
  );
  assert.equal(catalog.policies[0].completePaths, false);
  assert.equal(card.representative.availability, "UNKNOWN");
  assert.equal(JSON.stringify(educationDraftCatalog), before);
  assert.deepEqual(
    evaluateRecommendation(educationDraftCatalog, {
      ...request,
      mode: "PUBLIC",
    }).cards,
    [],
  );
});

test("missing same-event confirmation or a different entry event cannot produce a positive match or reject all exceptions", () => {
  for (const kind of [
    "missing-confirmation",
    "transfer",
    "different-child",
    "not-yet",
  ] as const) {
    const { catalog, request } = fixture();
    if (kind === "missing-confirmation")
      request.answers = request.answers.filter(
        (a) => !a.key.attribute.endsWith("gwanakSameActualFirstEntry"),
      );
    if (kind === "transfer")
      setValue(request, "education.entryType", {
        kind: "CODE",
        value: "TRANSFER",
      });
    if (kind === "different-child")
      request.answers.find((a) =>
        a.key.attribute.endsWith("gwanakSameActualFirstEntry"),
      )!.key.subject = { kind: "CHILD", id: "child-2" };
    if (kind === "not-yet")
      setValue(request, "education.enrollmentYear", {
        kind: "CODE",
        value: "NOT_YET",
      });
    const result = evaluateRecommendation(catalog, request);
    assert.ok(result.cards.length, kind);
    assert.ok(
      result.cards.every((c) => c.eligibility === "UNKNOWN"),
      kind,
    );
  }
});

test("a matching alternative for another purpose does not replace the representative's purpose", () => {
  const { catalog, request } = fixture();
  request.needs = [];
  for (const path of catalog.policies[0].paths)
    if (path.id.startsWith("gwanak-2026-first-")) path.purposes = ["learning"];
  const card = evaluateRecommendation(catalog, request).cards[0];
  assert.equal(card.representative.purpose, "entry-preparation");
  assert.equal(card.eligibility, "UNKNOWN");
  assert.ok(
    card.pathResults.some(
      (p) => p.purpose === "learning" && p.eligibility.value === "ELIGIBLE",
    ),
  );
});
