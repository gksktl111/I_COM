// Read-only real policy/UI smoke check; owns Chromium port 9244.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const origin = process.env.UI_TEST_ORIGIN || "http://localhost:3000";
const debug = "http://localhost:9244";
const chromePath =
  process.env.UI_TEST_CHROME ||
  "/home/minku/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser, ws, interceptionError;

let sequence = 0;
const pending = new Map();
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
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (interceptionError) throw interceptionError;
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(
    `Timed out: ${expression}; body=${await evaluate("document.body.innerText")}`,
  );
}
async function capture(name) {
  if (!process.env.UI_TEST_CAPTURE) return;
  await mkdir("/tmp/icom-readable-ui", { recursive: true });
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  await writeFile(
    `/tmp/icom-readable-ui/${name}.png`,
    Buffer.from(shot.data, "base64"),
  );
}
async function click(label) {
  await evaluate(
    `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});if(!b||b.disabled)throw Error('missing/enabled button: '+${JSON.stringify(label)});b.click()})()`,
  );
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
  assert.equal(occupied, false, "dedicated CDP port 9244 is unused");
  browser = spawn(
    chromePath,
    [
      "--headless",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--remote-debugging-port=9244",
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
    const handler = pending.get(message.id);
    if (handler) {
      pending.delete(message.id);
      if (message.error) handler.reject(new Error(message.error.message));
      else handler.resolve(message.result);
    }
  };
  await send("Page.enable");
  await send("Runtime.enable");

  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  for (const category of process.env.UI_TEST_CATEGORY
    ? [process.env.UI_TEST_CATEGORY]
    : [
        "임신·출산",
        "양육·보육",
        "돌봄",
        "의료·건강",
        "아동 교육",
        "주거·생활지원",
      ]) {
    await send("Page.navigate", { url: `${origin}/policy/match` });
    await until(
      'document.querySelector("h1")?.textContent.includes("어떤 지원")',
    );
    await delay(500);
    await click(category);
    await until(
      '!([...document.querySelectorAll("button")].find(b => b.textContent === "상세 정보 입력하기")?.disabled)',
    );
    await click("상세 정보 입력하기");
    if (category === "주거·생활지원") {
      await evaluate(
        `document.querySelector('main fieldset:last-of-type input[type="checkbox"]').click()`,
      );
      await delay(80);
    }
    await capture("basic");
    await click("상세 질문 시작하기");
    await capture("question");
    if (category === "아동 교육") {
      await click("뒤로가기");
      await until(
        'document.querySelector("h1")?.textContent.includes("필요한 정보를")',
      );
      await click("뒤로가기");
      await until(
        'document.querySelector("h1")?.textContent.includes("어떤 지원")',
      );
      assert.equal(
        await evaluate(
          `document.querySelector('main a')?.getAttribute('href')`,
        ),
        "/",
        "first-step back has safe home destination",
      );
      await click("상세 정보 입력하기");
      await click("상세 질문 시작하기");
      await evaluate(
        `document.querySelector('[aria-label="답변 선택"] button').click()`,
      );
      await click("선택한 답변으로 다음");
      await click("뒤로가기");
      await until(
        'document.querySelector("h1")?.textContent.includes("언제부터")',
      );
      assert.equal(
        await evaluate(
          `document.querySelector('[aria-label="답변 선택"] button[aria-pressed="true"]')?.textContent.trim()`,
        ),
        "지금 필요해요",
        "back preserves previous answer",
      );
      await click("선택한 답변으로 다음");
    }

    let count = 0;
    while (
      !(await evaluate(
        'document.querySelector("h1")?.textContent.includes("입력한 정보를")',
      ))
    ) {
      assert.ok(++count < 20, "bounded question flow");
      const options = await evaluate(
        `document.querySelectorAll('[aria-label="답변 선택"] button').length`,
      );
      if (options) {
        await evaluate(
          `document.querySelector('[aria-label="답변 선택"] button').click()`,
        );
        await delay(50);
        await click("선택한 답변으로 다음");
      } else await click("잘 모르겠어요");
      await delay(80);
    }
    assert.ok(count >= 2, "category detailed questions rendered");
    await capture("review");
    await click("추천 결과 보기");
    await until(
      'document.querySelector("h1")?.textContent.includes("맞춤 정책 추천")',
    );
    assert.equal(
      await evaluate(
        `!!document.querySelector('[aria-label="정책 신청 전 확인 안내"]')`,
      ),
      true,
    );
    await capture("results");
    if (category === "아동 교육") {
      await click("뒤로가기");
      await until(
        'document.querySelector("h1")?.textContent.includes("입력한 정보를")',
      );
      await click("추천 결과 보기");
      await click("뒤로가기");
      await delay(2500);
      assert.equal(
        await evaluate(
          'document.querySelector("h1")?.textContent.includes("입력한 정보를")',
        ),
        true,
        "back cancels preparation",
      );
      await click("추천 결과 보기");
      await until(
        'document.querySelector("h1")?.textContent.includes("맞춤 정책 추천")',
      );
    }

    const cards = await evaluate(
      'document.querySelectorAll("main ol > li").length',
    );
    assert.ok(cards > 0 && cards <= 20, "real policies loaded with maximum20");
    assert.equal(
      await evaluate("document.documentElement.scrollWidth <= innerWidth"),
      true,
      "mobile fits",
    );
    await evaluate(
      `document.querySelector('main button[aria-haspopup="dialog"]').click()`,
    );
    await until('!!document.querySelector("dialog[open]")');
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await until('!document.querySelector("dialog[open]")');
    if (category === "아동 교육") {
      await click("답변 확인·수정");
      await evaluate(
        `document.querySelector('main button[aria-expanded="false"]')?.click()`,
      );
      await evaluate(
        `([...document.querySelectorAll('main button')].find(b => b.textContent.includes('재학 중이거나 입학할 학교급') && b.textContent.includes('수정'))).click()`,
      );
      await click("중학교");
      await click("선택한 답변으로 다음");
      await until(
        'document.querySelector("h1")?.textContent.includes("몇 학년")',
      );
      assert.equal(
        await evaluate(
          `document.querySelector('[aria-label="답변 선택"] button[aria-pressed="true"]') === null`,
        ),
        true,
        "school change clears even previously valid grade",
      );
      assert.equal(
        await evaluate(
          `([...document.querySelectorAll('[aria-label="답변 선택"] button')].some(b => b.textContent === '4학년'))`,
        ),
        false,
        "middle school excludes grade4",
      );
      console.log(JSON.stringify({ schoolChangeClearsGrade: true }));
    }
    console.log(
      JSON.stringify({
        category,
        questions: count,
        realPolicies: cards,
        mobile: "pass",
        modal: "pass",
      }),
    );
  }
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
      debugPort: 9244,
      profileRemoved: true,
    }),
  );
}
