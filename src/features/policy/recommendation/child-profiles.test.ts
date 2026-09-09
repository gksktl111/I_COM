import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyChildProfile, withChildProfiles } from "./child-profiles.ts";
import { educationRequest } from "./education.fixture.ts";
import type { Answer, Request } from "./types.ts";

const answer = (id: string, kind: "CHILD" | "HOUSEHOLD" = "CHILD"): Answer => ({
  key: {
    attribute: "test.fact",
    basis: "TEST",
    reference: "2026",
    subject: { id, kind },
  },
  recordedAt: "2026-09-09T00:00:00Z",
  state: "DONT_KNOW",
});
const request = (): Request => ({
  ...structuredClone(educationRequest),
  selectedChildren: ["child-1", "child-2"],
  childProfiles: [
    emptyChildProfile("child-1"),
    { id: "child-2", sex: "FEMALE", birthYear: 2020 },
  ],
  answers: [
    answer("child-1"),
    answer("child-2"),
    answer(educationRequest.householdId, "HOUSEHOLD"),
  ],
});

test("deleting a row keeps the remaining child's identity and answers", () => {
  const before = request();
  const remaining = before.childProfiles![1];
  const after = withChildProfiles(before, [remaining]);
  assert.deepEqual(after.selectedChildren, ["child-2"]);
  assert.deepEqual(
    after.answers.map((a) => a.key.subject.id),
    ["child-2", before.householdId],
  );
  assert.equal(before.answers.length, 3);
  const added = withChildProfiles(after, [
    remaining,
    emptyChildProfile("child-3"),
  ]);
  assert.deepEqual(added.answers, after.answers);
  assert.deepEqual(added.selectedChildren, ["child-2", "child-3"]);
});

test("editing one profile invalidates only that child's old detailed answers", () => {
  const before = request();
  for (const patch of [{ birthYear: 2019 }, { sex: "MALE" as const }]) {
    const profiles = before.childProfiles!.map((p) =>
      p.id === "child-2" ? { ...p, ...patch } : p,
    );
    const after = withChildProfiles(before, profiles);
    assert.deepEqual(
      after.answers.map((a) => a.key.subject.id),
      ["child-1", before.householdId],
    );
    assert.deepEqual(after.selectedChildren, before.selectedChildren);
  }
});

test("unknown demographics and deleting the last child do not invent age or household totals", () => {
  const before = request();
  const same = withChildProfiles(before, before.childProfiles!);
  assert.deepEqual(same.answers, before.answers);
  const empty = withChildProfiles(before, []);
  assert.deepEqual(empty.selectedChildren, []);
  assert.deepEqual(empty.childProfiles, []);
  assert.deepEqual(empty.answers, [answer(before.householdId, "HOUSEHOLD")]);
});
