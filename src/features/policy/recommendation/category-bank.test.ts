import test from "node:test";
import assert from "node:assert/strict";
import {
  activeBankAnswers,
  getBankQuestions,
  type BankAnswer,
  type BankContext,
} from "./category-bank.ts";
const context: BankContext = {
  category: "education",
  needs: ["uniform"],
  childProfiles: [
    { id: "a", sex: null, birthYear: null },
    { id: "b", sex: null, birthYear: 2015 },
  ],
};
const answer = (
  questionId: string,
  subjectId: string,
  value: string,
): BankAnswer => ({ questionId, subjectId, state: "PROVIDED", value });
test("school branches and grade validity stay isolated to their child", () => {
  const answers = [
    answer("E01", "a", "ENROLLED"),
    answer("E02", "a", "ELEMENTARY"),
    answer("E03", "a", "G6"),
    answer("E01", "b", "OUT_OF_SCHOOL"),
  ];
  assert(getBankQuestions(context, answers).some((q) => q.key === "E03:a"));
  assert(!getBankQuestions(context, answers).some((q) => q.key === "E03:b"));
  assert.equal(
    getBankQuestions(context, answers).filter((q) => q.id === "C-TIMING")
      .length,
    2,
  );
  assert(
    !activeBankAnswers(
      context,
      answers.map((a) =>
        a.questionId === "E02" ? { ...a, value: "HIGH" } : a,
      ),
    ).some((a) => a.questionId === "E03"),
  );
  assert(
    !activeBankAnswers(
      context,
      answers.map((a) =>
        a.questionId === "E01"
          ? { ...a, state: "DONT_KNOW", value: undefined }
          : a,
      ),
    ).some((a) => a.questionId === "E02" || a.questionId === "E03"),
  );
});
test("scope selection binds pregnancy person and health children; unknown has no inferred person", () => {
  assert(
    !getBankQuestions({ ...context, category: "pregnancy" }, []).some(
      (q) => q.id === "P02",
    ),
  );
  const pregnancy = getBankQuestions({ ...context, category: "pregnancy" }, [
    answer("P01", "HOUSEHOLD", "PARTNER"),
    answer("P02", "PARTNER", "PREGNANT"),
  ]);
  assert(pregnancy.some((q) => q.key === "P03:PARTNER"));
  const health = getBankQuestions(
    { ...context, category: "health", needs: ["medical-costs"] },
    [answer("H01", "HOUSEHOLD", "CHILD")],
  );
  assert.deepEqual(
    health.filter((q) => q.id === "H03").map((q) => q.subjectId),
    ["a", "b"],
  );
  assert(
    !getBankQuestions({ ...context, category: "health", childProfiles: [] }, [])
      .find((q) => q.id === "H01")!
      .options.some((o) => o.value === "CHILD"),
  );
});
test("need branches and region values are validated without losing unknown responses", () => {
  const answers = [
    answer("E01", "a", "ENROLLED"),
    answer("E04", "a", "서울특별시|강남구"),
    answer("E05", "a", "FIRST"),
  ];
  assert.equal(activeBankAnswers(context, answers).length, 3);
  assert.equal(activeBankAnswers({ ...context, needs: [] }, answers).length, 2);
  assert.equal(
    activeBankAnswers(context, [
      ...answers.slice(0, 1),
      answer("E04", "a", "서울특별시|부산"),
    ]).length,
    1,
  );
  for (const category of [
    "pregnancy",
    "childcare",
    "care",
    "health",
    "education",
    "housing",
  ])
    assert(
      getBankQuestions({ ...context, category, needs: ["housing-costs"] }, [])
        .length > 0,
    );
});
