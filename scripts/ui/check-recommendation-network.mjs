// Live React/API contract check. Only this browser's recommendation requests are
// intercepted. The HUMAN values below belong to an isolated synthetic test;
// they never register, approve or modify any production policy/release.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRecommendationService } from "../../src/features/policy/server/recommendation-service.ts";
import { educationFixture } from "../../src/features/policy/recommendation/education.fixture.ts";

const origin = process.env.UI_TEST_ORIGIN || "http://localhost:3000";
const debug = "http://localhost:9242";
const chromePath =
  process.env.UI_TEST_CHROME ||
  "/home/minku/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const catalog = structuredClone(educationFixture);
for (const policy of catalog.policies) {
  policy.release = "HUMAN";
  for (const rule of policy.rules) rule.review = "HUMAN";
}
const policies = catalog.policies.map((policy) => ({
  id: policy.id,
  name: policy.title,
  summary: "브라우저 네트워크 검증 전용 자료",
  provider_name: "테스트 제공 기관",
  purpose_text: null,
  target_text: "네트워크 검증용 지원 대상",
  criteria_text: "실제 자격 기준이 아닌 테스트 표시",
  benefit_text: "네트워크 응답에서 전달한 지원 내용",
  application_method_text: "테스트 신청 방법",
  application_period_text: null,
  required_documents_text: "네트워크 검증용 서류",
  reception_text: null,
  contact_text: null,
  source_url: null,
  application_url: null,
  updated_at: null,
}));
const recommend = createRecommendationService({
  loadCatalog: async () => ({ catalog, policies, coverage: "READY" }),
  now: () => new Date("2026-09-09T00:00:00Z"),
});

let browser, ws, held, interceptionError;
let mode = "success";
let sequence = 0;
const pending = new Map();
const requests = [];
const profile = await mkdtemp(join(tmpdir(), "icom-recommendation-network-"));
let exited = false;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 15000);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
    ws.send(JSON.stringify({ id, method, params }));
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
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (interceptionError) throw interceptionError;
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(
    `Timed out: ${expression}; body=${await evaluate("document.body.innerText")}`,
  );
}
async function click(label) {
  await evaluate(
    `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('missing/enabled button: '+${JSON.stringify(label)});b.click()})()`,
  );
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
  assert.equal("mode" in input, false);
  assert.equal("evaluatedAt" in input, false);
  requests.push(input);
  const action = mode;
  mode = "success";
  if (action === "unavailable") {
    await fulfill(requestId, 503, { error: "recommendation-data-unavailable" });
    return;
  }
  const response = await recommend(input);
  if (action === "hold-results") {
    assert.equal(input.phase, "RESULTS");
    held = { requestId, response };
    return;
  }
  if (action === "wrong-revision") response.result.revision += 1;
  await fulfill(requestId, 200, response);
}

try {
  // Refuse to attach to or stop somebody else's browser on the assigned port.
  let occupied = false;
  try {
    occupied = (
      await fetch(`${debug}/json/version`, { signal: AbortSignal.timeout(500) })
    ).ok;
  } catch {
    /* not listening */
  }
  assert.equal(occupied, false, "dedicated CDP port 9242 is unused");
  browser = spawn(
    chromePath,
    [
      "--headless",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--remote-debugging-port=9242",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  browser.once("exit", () => {
    exited = true;
  });
  let startupError;
  browser.once("error", (error) => {
    startupError = error;
  });
  const startupDeadline = Date.now() + 15000;
  let target;
  while (Date.now() < startupDeadline) {
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
    }
  };
  await send("Page.enable");
  await send("Runtime.enable");
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
  await send("Page.navigate", { url: `${origin}/policy/match` });
  await until(
    `document.body.innerText.includes('상세 정보 입력하기') && [...document.querySelectorAll('button')].some(b=>Object.keys(b).some(k=>k.startsWith('__reactProps')))`,
  );
  assert.equal(
    await evaluate("document.body.innerText.includes('검증용 정책 · 테스트')"),
    false,
  );
  await click("아동 교육");
  await click("상세 정보 입력하기");
  await click("남");
  await evaluate(`document.getElementById('child-1-birth-year').click()`);
  await until(`!!document.querySelector(':popover-open [role=option]')`);
  await evaluate(
    `[...document.querySelectorAll(':popover-open [role=option]')].find(o=>o.textContent.trim()==='2020년').click()`,
  );
  await click("질문 시작하기");
  await until(`!!document.querySelector('[aria-label="답변 선택지"]')`);
  await delay(100);
  assert.equal(
    await evaluate(
      `document.activeElement === document.querySelector('main h1')`,
    ),
    true,
    "server question receives keyboard focus after loading",
  );
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].childProfiles, [
    { id: "child-1", sex: "MALE", birthYear: 2020 },
  ]);
  assert.equal(
    await evaluate("document.querySelectorAll('article').length"),
    0,
  );

  // Accepted answer survives an actual failed response and the retry POST.
  mode = "unavailable";
  await evaluate(
    `document.querySelector('[aria-label="답변 선택지"] button').click()`,
  );
  await click("선택한 답변으로 다음");
  await until(`document.body.innerText.includes('답변은 유지되니')`);
  const failed = structuredClone(requests.at(-1));
  assert.equal(failed.answers.length, 1);
  assert.equal(failed.answers[0].state, "PROVIDED");
  await click("다시 시도");
  await until(`!!document.querySelector('[aria-label="답변 선택지"]')`);
  await delay(100);
  assert.equal(
    await evaluate(
      `document.activeElement === document.querySelector('main h1')`,
    ),
    true,
    "retried question receives keyboard focus",
  );
  assert.deepEqual(
    requests.at(-1),
    failed,
    "retry preserves revision, selected children and answer value",
  );
  assert.equal(requests.at(-1).questionCount, 1);

  // Keep the results response pending beyond the UI animation duration.
  mode = "hold-results";
  await click("질문 마치기");
  await until(
    `document.body.innerText.includes('우리 아이에게 맞는 지원을 정리하고 있어요')`,
  );
  const holdDeadline = Date.now() + 10000;
  while (!held && Date.now() < holdDeadline) {
    if (interceptionError) throw interceptionError;
    await delay(50);
  }
  assert.ok(held, "RESULTS request intercepted");
  await delay(2700);
  assert.equal(
    await evaluate("document.querySelectorAll('article').length"),
    0,
    "no early cards while network result is pending",
  );
  assert.equal(
    await evaluate(
      "document.body.innerText.includes('우리 가족에게 맞는 정책을 모았어요')",
    ),
    false,
  );
  await fulfill(held.requestId, 200, held.response);
  held = null;
  await until(
    `document.body.innerText.includes('우리 가족에게 맞는 정책을 모았어요') && document.querySelectorAll('article').length>0`,
  );
  await click("상세보기");
  await until(`!!document.querySelector('dialog[open]')`);
  assert.equal(
    await evaluate(
      `document.querySelector('dialog').innerText.includes('네트워크 검증용 지원 대상')`,
    ),
    true,
  );
  await click("구비 서류");
  assert.equal(
    await evaluate(
      `document.querySelector('dialog').innerText.includes('네트워크 검증용 서류')`,
    ),
    true,
  );
  await evaluate(
    `document.querySelector('[aria-label="정책 상세 닫기"]').click()`,
  );
  await until(`!document.querySelector('dialog[open]')`);

  // A well-formed response for another revision is never accepted as current.
  await click("처음부터");
  await click("아동 교육");
  await click("상세 정보 입력하기");
  mode = "wrong-revision";
  await click("질문 시작하기");
  await until(`document.body.innerText.includes('답변은 유지되니')`);
  assert.equal(
    await evaluate(`!!document.querySelector('[aria-label="답변 선택지"]')`),
    false,
  );
  assert.equal(
    await evaluate("document.querySelectorAll('article').length"),
    0,
  );
  await click("다시 시도");
  await until(`!!document.querySelector('[aria-label="답변 선택지"]')`);
  // Leaving the preparation screen cancels the scheduled result transition.
  mode = "hold-results";
  await click("질문 마치기");
  await until(`document.body.innerText.includes('입력 화면으로 돌아가기')`);
  const cancelDeadline = Date.now() + 10000;
  while (!held && Date.now() < cancelDeadline) await delay(50);
  assert.ok(held, "second result request intercepted");
  await fulfill(held.requestId, 200, held.response);
  held = null;
  await click("입력 화면으로 돌아가기");
  await until(`document.body.innerText.includes('질문 시작하기')`);
  await delay(2500);
  assert.equal(
    await evaluate(`document.body.innerText.includes('질문 시작하기')`),
    true,
  );
  assert.equal(
    await evaluate(`document.querySelectorAll('article').length`),
    0,
  );
  assert.equal(interceptionError, undefined);
  console.log(
    JSON.stringify({
      passed: true,
      interceptedRequests: requests.length,
      flow: [
        "live-public-wire",
        "answer-next-question",
        "503-retry-preserves-answer",
        "results-pending-no-early-cards",
        "server-policy-detail-modal",
        "mismatched-revision-rejected-and-retried",
        "cancel-preparation-keeps-setup",
      ],
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
      const killDeadline = Date.now() + 5000;
      while (!exited && Date.now() < killDeadline) await delay(50);
    }
    assert.equal(exited, true, "owned Chromium has exited");
  }
  await rm(profile, { recursive: true, force: true });
  console.log(
    JSON.stringify({
      chromiumStopped: !browser || exited,
      debugPort: 9242,
      profileRemoved: true,
    }),
  );
}
