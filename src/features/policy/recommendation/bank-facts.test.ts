import test from "node:test";
import assert from "node:assert/strict";
import { projectBankFacts } from "./bank-facts.ts";
import type { BankAnswer, BankContext } from "./category-bank.ts";
const now = "2026-09-11T00:00:00.000Z";
const context: BankContext = {
  category: "education",
  needs: ["uniform"],
  childProfiles: [
    { id: "a", sex: null, birthYear: 2014 },
    { id: "b", sex: "FEMALE", birthYear: null },
  ],
  residence: {
    region: "서울특별시",
    district: "관악구",
    basis: "REGISTERED_RESIDENCE",
    reference: "CURRENT",
  },
};
const answer = (
  questionId: string,
  subjectId: string,
  value: string,
): BankAnswer => ({ questionId, subjectId, state: "PROVIDED", value });
test("bank facts keep school, child birth precision and historical residence separate", () => {
  const p = projectBankFacts(
    context,
    [
      answer("E01", "a", "ENROLLED"),
      answer("E02", "a", "HIGH"),
      answer("E04", "a", "부산광역시|"),
    ],
    now,
  );
  const birth = p.answers.find((a) => a.key.attribute === "person.birthDate")!;
  assert.equal(birth.key.subject.id, "a");
  assert.deepEqual(birth.state === "PROVIDED" && birth.value, {
    kind: "DATE_RANGE",
    earliest: "2014-01-01",
    latest: "2014-12-31",
  });
  assert.equal(
    p.answers.find((a) => a.key.attribute === "education.schoolRegion.district")
      ?.state,
    "UNASKED",
  );
  assert(
    p.answers
      .filter((a) => a.key.attribute.startsWith("residence."))
      .every(
        (a) =>
          a.key.subject.kind === "HOUSEHOLD" && a.key.reference === "CURRENT",
      ),
  );
  assert(
    !p.answers.some((a) =>
      ["person.age", "household.childCount"].includes(a.key.attribute),
    ),
  );
});
test("pregnancy weeks bind to selected person's event and retain interval precision", () => {
  const p = projectBankFacts(
    { category: "pregnancy", needs: [], childProfiles: [] },
    [
      answer("P01", "HOUSEHOLD", "PARTNER"),
      answer("P02", "PARTNER", "PREGNANT"),
      answer("P03", "PARTNER", "W28_TO_36"),
    ],
    now,
  );
  const weeks = p.answers.find(
    (a) => a.key.attribute === "pregnancy.gestationalWeeks",
  )!;
  assert.deepEqual(weeks.key.subject, {
    kind: "EVENT",
    id: "pregnancy:PARTNER",
  });
  assert.deepEqual(weeks.state === "PROVIDED" && weeks.value, {
    kind: "NUMBER_RANGE",
    min: 28,
    max: 37,
    minInclusive: true,
    maxInclusive: false,
    unit: "GESTATIONAL_WEEKS",
  });
  assert(!p.answers.some((a) => a.key.subject.id === "SELF"));
});
test("changed prerequisite discards stale bank facts; uncertainty is retained", () => {
  const p = projectBankFacts(
    context,
    [
      answer("E01", "a", "OUT_OF_SCHOOL"),
      answer("E02", "a", "HIGH"),
      { questionId: "C-TIMING", subjectId: "b", state: "DONT_KNOW" },
    ],
    now,
  );
  assert(!p.answers.some((a) => a.key.attribute === "education.schoolStage"));
  assert.equal(
    p.answers.find((a) => a.key.attribute === "support.desiredTiming")?.state,
    "DONT_KNOW",
  );
});
test("health scope selects only the intended beneficiaries, even before detail answers", () => {
  for (const value of ["SELF", "OTHER_FAMILY"]) {
    const p = projectBankFacts(
      { ...context, category: "health" },
      [answer("H01", "HOUSEHOLD", value)],
      now,
    );
    assert.deepEqual(p.selectedChildren, []);
    assert.deepEqual(p.selectedSubjects, [{ kind: "PERSON", id: value }]);
    assert(!p.answers.some((a) => a.key.subject.kind === "CHILD"));
  }
  const children = projectBankFacts(
    { ...context, category: "health" },
    [answer("H01", "HOUSEHOLD", "CHILD")],
    now,
  );
  assert.deepEqual(children.selectedChildren, ["a", "b"]);
  assert.deepEqual(children.selectedSubjects, []);
  const unknown = projectBankFacts({ ...context, category: "health" }, [], now);
  assert.deepEqual(unknown.selectedChildren, []);
});
test("pregnancy scope exists without a detail answer and excludes unrelated children", () => {
  const p = projectBankFacts(
    { ...context, category: "pregnancy" },
    [answer("P01", "HOUSEHOLD", "PARTNER")],
    now,
  );
  assert.deepEqual(p.selectedSubjects, [{ kind: "PERSON", id: "PARTNER" }]);
  assert.deepEqual(p.selectedChildren, []);
  assert(!p.answers.some((a) => a.key.subject.kind === "CHILD"));
});
