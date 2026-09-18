// Browser-only guided-response fixtures. No real policy publication, server
// catalog mutation or eligibility certification. Owns Chromium port 9247.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin = process.env.UI_TEST_ORIGIN || "http://localhost:3000";
const debug = "http://localhost:9247";
const chromePath =
  process.env.UI_TEST_CHROME ||
  "/home/minku/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = await mkdtemp(join(tmpdir(), "icom-guided-ui-"));
const pending = new Map();
const requests = [];
let browser, ws, interceptionError, held;
let sequence = 0,
  exited = false,
  mode = "success",
  method = "VERIFIED";

function send(command, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${command}`));
    }, 15000);
    pending.set(id, {
      resolve: (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
    ws.send(JSON.stringify({ id, method: command, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (interceptionError) throw interceptionError;
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(
    `Timed out: ${expression}; diagnostics=${JSON.stringify(
      await evaluate(`({
      readyState: document.readyState,
      buttonKeys: Object.getOwnPropertyNames(document.querySelector('button') ?? {}),
      scripts: [...document.scripts].filter(s => s.src).map(s => s.src),
      resources: performance.getEntriesByType('resource').map(r => ({name:r.name,duration:r.duration}))
    })`),
    )}; body=${await evaluate("document.body.innerText")}`,
  );
}
async function click(label) {
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)});
    if (!b || b.disabled) throw Error('missing/enabled button: ' + ${JSON.stringify(label)});
    b.click();
  })()`);
}
async function noCards() {
  assert.equal(
    await evaluate('document.querySelectorAll("main ol > li").length'),
    0,
    "questioning never shows policy cards",
  );
}
async function atQuestion(index) {
  await until(
    `document.querySelector('h1')?.textContent === '검증 전용 추가 질문 ${index + 1}'`,
  );
  await noCards();
}
function keyFor(input) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        input.category,
        input.needs,
        input.childProfiles,
        input.residence,
        [...input.bankAnswers].sort((a, b) =>
          `${a.questionId}:${a.subjectId}`.localeCompare(
            `${b.questionId}:${b.subjectId}`,
          ),
        ),
      ]),
    )
    .digest("hex");
}
const display = (index) => ({
  id: `guided-fixture-${index}`,
  name: `브라우저 모의 정책 ${index}`,
  summary: "실제 지원이나 공개 승인이 아닌 브라우저 검증용 자료입니다.",
  provider_name: "테스트 기관",
  purpose_text: null,
  target_text: "검증용 대상",
  criteria_text: null,
  benefit_text: "검증용 내용",
  application_method_text: null,
  application_period_text: null,
  required_documents_text: null,
  reception_text: null,
  contact_text: null,
  source_url: null,
  application_url: null,
  updated_at: null,
});
function responseFor(input) {
  assert.equal(input.flow, "CATEGORY_BANK_V1");
  assert.ok(["QUESTIONING", "RESULTS"].includes(input.phase));
  assert.equal("mode" in input, false);
  assert.ok(input.questionCount >= 0 && input.questionCount <= 5);
  const answers = input.ruleAnswers ?? [];
  const contextKey = keyFor(input);
  if (answers.length) {
    assert.equal(input.catalogVersion, "browser-fixture-1");
    assert.equal(
      input.contextKey,
      contextKey,
      "supplemental answers retain their base context",
    );
    for (const answer of answers) {
      assert.equal(answer.version, "1");
      assert.deepEqual(answer.subject, {
        kind: "CHILD",
        id: input.childProfiles[0].id,
      });
      assert.ok(["PROVIDED", "DONT_KNOW", "SKIPPED"].includes(answer.state));
      assert.equal("value" in answer, answer.state === "PROVIDED");
    }
  }
  const next = Array.from({ length: 7 }, (_, i) => i).find(
    (i) => !answers.some((a) => a.questionId === `supplemental-${i}`),
  );
  const question =
    method === "VERIFIED" &&
    input.phase === "QUESTIONING" &&
    input.questionCount < 5 &&
    next !== undefined
      ? {
          key: `fixture-question-${next}`,
          id: `supplemental-${next}`,
          version: "1",
          subject: { kind: "CHILD", id: input.childProfiles[0].id },
          subjectLabel: "자녀 1",
          prompt: `검증 전용 추가 질문 ${next + 1}`,
          whyAsked: "입력 기준 조건을 비교하기 위한 모의 질문입니다.",
          options: [
            { value: "0", label: "검증용 예" },
            { value: "1", label: "검증용 아니요" },
          ],
        }
      : null;
  const policies =
    input.phase === "RESULTS"
      ? Array.from({ length: method === "MIXED" ? 20 : 3 }, (_, i) => i + 1).map((i) => ({
          policy: display(i),
          score: 0,
          ...(method === "MIXED"
            ? { reviewStatus: i % 2 ? "REVIEWED" : "CHECK_REQUIRED" }
            : {}),
          reasons: ["브라우저 모의 응답의 추천 이유"],
          tags: [
            method === "MIXED"
              ? i % 2 ? "검증용 조건 비교" : "직접 확인 필요"
              : method === "VERIFIED" ? "자녀 1 · 추가 확인 필요" : "잠정 추천",
          ],
        }))
      : [];
  return {
    flow: "CATEGORY_BANK_V1",
    revision: input.revision,
    policies,
    candidateCount: input.phase === "RESULTS" ? policies.length : 7,
    method,
    catalogVersion: "browser-fixture-1",
    contextKey,
    nextQuestion: question,
    stopReason:
      input.phase === "RESULTS"
        ? "RESULTS_REQUESTED"
        : input.questionCount >= 5
          ? "QUESTION_LIMIT"
          : question
            ? null
            : "NO_USEFUL_QUESTION",
    top5: policies.slice(0, 5).map((item) => item.policy.id),
  };
}
async function fulfill(requestId, status, data) {
  await send("Fetch.fulfillRequest", {
    requestId,
    responseCode: status,
    responseHeaders: [
      { name: "Content-Type", value: "application/json" },
      { name: "Cache-Control", value: "private, no-store" },
    ],
    body: Buffer.from(JSON.stringify(data)).toString("base64"),
  });
}
async function intercept({ requestId, request }) {
  assert.equal(request.method, "POST");
  const input = JSON.parse(request.postData);
  requests.push(input);
  const action = mode;
  mode = "success";
  if (action === "unavailable")
    return fulfill(requestId, 503, { error: "fixture-unavailable" });
  if (action === "context-changed")
    return fulfill(requestId, 409, {
      error: "recommendation-context-changed",
    });
  const response = responseFor(input);
  if (action === "hold") {
    held = { requestId, response };
    return;
  }
  if (action === "wrong-revision") response.revision += 1000;
  await fulfill(requestId, 200, response);
}
async function finishBasicQuestions() {
  let count = 0;
  while (
    !(await evaluate(
      `document.querySelector('h1')?.textContent === '입력한 정보를 확인해 주세요'`,
    ))
  ) {
    assert.ok(++count <= 25, "basic bank terminates");
    await noCards();
    await click("건너뛰기");
    await delay(75);
  }
}
const withoutRevision = (input) => {
  const copy = { ...input };
  delete copy.revision;
  return copy;
};

try {
  let occupied = false;
  try {
    occupied = (
      await fetch(`${debug}/json/version`, { signal: AbortSignal.timeout(500) })
    ).ok;
  } catch {
    /* unused */
  }
  assert.equal(occupied, false, "dedicated CDP port 9247 must be unused");
  browser = spawn(
    chromePath,
    [
      "--headless",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--remote-debugging-port=9247",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  browser.once("exit", () => {
    exited = true;
  });
  let startupError, target;
  browser.once("error", (error) => {
    startupError = error;
  });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (startupError) throw startupError;
    if (exited) throw new Error("Owned Chromium exited during startup");
    try {
      target = (await (await fetch(`${debug}/json`)).json()).find(
        (item) => item.type === "page",
      );
    } catch {
      /* starting */
    }
    if (target) break;
    await delay(100);
  }
  assert.ok(target, "owned Chromium page started");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const handler = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) handler?.reject(new Error(message.error.message));
      else handler?.resolve(message.result);
    } else if (message.method === "Fetch.requestPaused") {
      void intercept(message.params).catch((error) => {
        interceptionError = error;
      });
    } else if (message.method === "Runtime.exceptionThrown") {
      console.error(
        "Browser exception:",
        JSON.stringify(message.params.exceptionDetails),
      );
    } else if (
      message.method === "Network.responseReceived" &&
      message.params.response.status >= 400
    ) {
      console.error(
        "Browser HTTP error:",
        message.params.response.status,
        message.params.response.url,
      );
    }
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Fetch.enable", {
    patterns: [
      {
        urlPattern: `${origin}/api/policy-recommendations`,
        requestStage: "Request",
      },
    ],
  });
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await send("Page.navigate", { url: `${origin}/policy/match` });
  await until(
    `document.readyState === 'complete' && document.body.innerText.includes('상세 정보 입력하기')`,
  );
  await click("아동 교육");
  await until(
    `![...document.querySelectorAll('button')].find(b => b.textContent.trim() === '상세 정보 입력하기')?.disabled`,
  );
  await click("상세 정보 입력하기");
  await click("상세 질문 시작하기");
  await finishBasicQuestions();
  await click("추가 조건 확인하기");
  await atQuestion(0);
  assert.equal(requests.at(-1).questionCount, 0);
  assert.deepEqual(requests.at(-1).ruleAnswers, []);

  for (let i = 0; i < 5; i++) {
    await atQuestion(i);
    if (i === 1) await click("잘 모르겠어요");
    else if (i === 2) await click("건너뛰기");
    else {
      await click("검증용 예");
      await click("선택한 답변으로 다음");
    }
  }
  await until(
    `document.querySelector('h1')?.textContent === '추가 조건 5개를 확인했어요'`,
  );
  await noCards();
  assert.equal(requests.at(-1).questionCount, 5);
  assert.deepEqual(
    requests.at(-1).ruleAnswers.map((a) => a.state),
    ["PROVIDED", "DONT_KNOW", "SKIPPED", "PROVIDED", "PROVIDED"],
  );
  await click("추가 질문 계속하기");
  await atQuestion(5);
  assert.equal(requests.at(-1).questionCount, 0);
  assert.equal(requests.at(-1).ruleAnswers.length, 5);
  await click("질문 마치고 결과 보기");
  await until(`document.querySelector('h1')?.textContent === '맞춤 정책 추천'`);
  assert.equal(
    await evaluate('document.querySelectorAll("main ol > li").length'),
    3,
  );
  assert.equal(
    await evaluate(
      `document.body.innerText.includes('확인된 정책 조건과 비교한 결과')`,
    ),
    true,
  );

  // Changing a basic preference invalidates all supplemental state and context.
  await click("기본 정보 변경");
  await evaluate(
    `document.querySelector('main fieldset input[type=checkbox]').click()`,
  );
  await click("상세 질문 시작하기");
  await finishBasicQuestions();
  await click("추가 조건 확인하기");
  await atQuestion(0);
  assert.deepEqual(requests.at(-1).ruleAnswers, []);
  assert.equal("catalogVersion" in requests.at(-1), false);
  assert.equal("contextKey" in requests.at(-1), false);

  // A failed submitted answer survives retry with the same count/base/context.
  mode = "unavailable";
  await click("검증용 예");
  await click("선택한 답변으로 다음");
  await until(`!!document.querySelector('[role=alert]')`);
  const failed = structuredClone(requests.at(-1));
  assert.equal(failed.ruleAnswers.length, 1);
  await noCards();
  await click("다시 시도");
  await atQuestion(1);
  assert.deepEqual(withoutRevision(requests.at(-1)), withoutRevision(failed));

  // A changed server context requires a fresh questioning request, not a stale retry.
  mode = "context-changed";
  await click("검증용 예");
  await click("선택한 답변으로 다음");
  await until(
    `!!document.querySelector('[role=alert]') && [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '최신 조건으로 다시 확인')`,
  );
  const staleContext = structuredClone(requests.at(-1));
  const beforeRecovery = requests.length;
  assert.equal(staleContext.ruleAnswers.length, 2);
  assert.equal(staleContext.questionCount, 2);
  assert.equal(staleContext.catalogVersion, "browser-fixture-1");
  assert.equal(staleContext.contextKey, keyFor(staleContext));
  assert.ok(
    staleContext.bankAnswers.length > 0,
    "basic answers exist before recovery",
  );
  await noCards();
  await click("최신 조건으로 다시 확인");
  await atQuestion(0);
  assert.equal(
    requests.length,
    beforeRecovery + 1,
    "one fresh request follows the single 409",
  );
  const recovered = requests.at(-1);
  const expectedRecovery = {
    ...withoutRevision(staleContext),
    phase: "QUESTIONING",
    questionCount: 0,
    ruleAnswers: [],
  };
  delete expectedRecovery.catalogVersion;
  delete expectedRecovery.contextKey;
  assert.deepEqual(
    withoutRevision(recovered),
    expectedRecovery,
    "recovery preserves category, needs, children, residence and basic answers while clearing supplemental answers and context",
  );
  assert.equal(
    await evaluate(`!!document.querySelector('[role=alert]')`),
    false,
    "successful recovery clears the context error",
  );
  // The new question can be answered normally, independently of stale answers.
  await click("검증용 예");
  await click("선택한 답변으로 다음");
  await atQuestion(1);
  assert.equal(requests.at(-1).ruleAnswers.length, 1);
  assert.equal(requests.at(-1).questionCount, 1);

  // Cancel a held response; a late result must never overwrite the question.
  mode = "hold";
  await click("질문 마치고 결과 보기");
  const heldDeadline = Date.now() + 10000;
  while (!held && Date.now() < heldDeadline) await delay(50);
  assert.ok(held, "result request held by this test");
  const cancelled = structuredClone(requests.at(-1));
  await click("답변으로 돌아가기");
  await atQuestion(1);
  try {
    await fulfill(held.requestId, 200, held.response);
  } catch (error) {
    assert.match(
      error.message,
      /Invalid InterceptionId|Invalid interception|Invalid requestId/i,
    );
  }
  await delay(800);
  await atQuestion(1);

  mode = "wrong-revision";
  await click("질문 마치고 결과 보기");
  await until(`!!document.querySelector('[role=alert]')`);
  await noCards();
  await click("다시 시도");
  await until(`document.querySelector('h1')?.textContent === '맞춤 정책 추천'`);
  assert.deepEqual(
    withoutRevision(requests.at(-1)),
    withoutRevision(cancelled),
  );
  assert.equal(
    await evaluate("document.documentElement.scrollWidth <= innerWidth"),
    true,
    "mobile layout fits",
  );

  // Profile edits also invalidate scope; provisional coverage ends questioning.
  await click("기본 정보 변경");
  await click("남");
  await click("상세 질문 시작하기");
  await finishBasicQuestions();
  method = "PROVISIONAL";
  await click("추가 조건 확인하기");
  await until(
    `document.querySelector('h1')?.textContent === '추가로 확인할 질문이 없어요'`,
  );
  await noCards();
  assert.deepEqual(requests.at(-1).ruleAnswers, []);
  assert.equal("contextKey" in requests.at(-1), false);
  await click("질문 마치고 결과 보기");
  await until(`document.querySelector('h1')?.textContent === '맞춤 정책 추천'`);
  assert.equal(
    await evaluate(
      `document.body.innerText.includes('관련성을 바탕으로 한 잠정 추천')`,
    ),
    true,
  );

  // Mixed coverage preserves reviewed and check-required cards in one ranked list.
  await click("기본 정보 변경");
  await click("상세 질문 시작하기");
  await finishBasicQuestions();
  method = "MIXED";
  await click("추가 조건 확인하기");
  await until(
    `document.querySelector('h1')?.textContent === '추가로 확인할 질문이 없어요'`,
  );
  await noCards();
  await click("질문 마치고 결과 보기");
  await until(`document.querySelector('h1')?.textContent === '맞춤 정책 추천'`);
  const mixed = await evaluate(`({
    note: document.querySelector('[aria-label="정책 신청 전 확인 안내"]')?.innerText,
    cards: [...document.querySelectorAll('main ol > li')].map(li => ({
      title: li.querySelector('h2')?.textContent.trim(),
      rank: li.querySelector('article > div > span')?.textContent.trim(),
      warning: li.querySelector(':scope > p')?.textContent.replace(/\\s+/g, ' ').trim() ?? '',
      tags: [...li.querySelectorAll('article > div:first-child > span')].slice(1).map(s => s.textContent.trim())
    }))
  })`);
  assert.ok(mixed.note.includes("조건을 비교한 정책과 아직 검토 중인 정책"));
  assert.equal(mixed.cards.length, 20, "mixed coverage keeps all twenty results");
  assert.equal(mixed.cards.filter(c => c.rank.startsWith("우선 추천 ")).length, 5);
  for (const [index, card] of mixed.cards.entries()) {
    const rank = index + 1;
    assert.equal(card.title, `브라우저 모의 정책 ${rank}`);
    assert.equal(card.rank, rank <= 5 ? `우선 추천 ${rank}` : `추천 ${rank}`);
    if (rank % 2) {
      assert.equal(card.warning, "", "reviewed cards have no check-required warning");
      assert.ok(card.tags.includes("검증용 조건 비교"));
    } else {
      assert.ok(card.tags.includes("직접 확인 필요"));
      assert.match(card.warning, /직접 확인 필요/);
      assert.match(card.warning, /거주 요건·지원 대상·신청 기간/);
      assert.match(card.warning, /공식 안내에서 직접 확인/);
    }
  }
  console.log(
    JSON.stringify({
      guidedMock: "pass",
      fiveQuestionLimit: "pass",
      continueAndEarlyFinish: "pass",
      baseAndProfileInvalidation: "pass",
      retryCancellationRevision: "pass",
      contextChangedRecovery: "pass",
      provisionalCoverage: "pass",
      mixedCoverageAndTopFive: "pass",
      requests: requests.length,
    }),
  );
} finally {
  ws?.close();
  for (const handler of pending.values())
    handler.reject(new Error("Browser check cleanup"));
  pending.clear();
  if (browser && !exited) {
    browser.kill("SIGTERM");
    const deadline = Date.now() + 5000;
    while (!exited && Date.now() < deadline) await delay(50);
    if (!exited) {
      browser.kill("SIGKILL");
      const deadline = Date.now() + 5000;
      while (!exited && Date.now() < deadline) await delay(50);
    }
    assert.equal(exited, true, "owned Chromium exited");
  }
  await rm(profile, { recursive: true, force: true });
  console.log(
    JSON.stringify({
      chromiumStopped: !browser || exited,
      debugPort: 9247,
      profileRemoved: true,
    }),
  );
}
