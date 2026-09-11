// Run against a local Next server and Chromium --remote-debugging-port=9225.
// Map fixtures replace external services only for deterministic UI regression checks.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
async function capture(name) {
  if (!process.env.UI_TEST_SCREENSHOTS) return;
  await mkdir(process.env.UI_TEST_SCREENSHOTS, { recursive: true });
  const result = await send("Page.captureScreenshot", { format: "png" });
  await writeFile(
    `${process.env.UI_TEST_SCREENSHOTS}/${name}.png`,
    Buffer.from(result.data, "base64"),
  );
}
const origin = process.env.UI_TEST_ORIGIN || "http://localhost:3000";
const debug = process.env.UI_TEST_DEBUG || "http://localhost:9225";
const targets = await (await fetch(`${debug}/json`)).json();
const target = targets.find((item) => item.type === "page");
assert.ok(target, "Chromium page target exists");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let id = 0;
const pending = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const handler = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) handler?.reject(new Error(message.error.message));
    else handler?.resolve(message.result);
  }
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const sequence = ++id;
    const timeout = setTimeout(() => {
      pending.delete(sequence);
      reject(new Error(`CDP timeout: ${method}`));
    }, 20000);
    pending.set(sequence, {
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });
    ws.send(JSON.stringify({ id: sequence, method, params }));
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
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out: ${expression}`);
}

async function click(text) {
  await evaluate(
    `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('missing button');b.focus();b.click()})()`,
  );
}
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await send("Page.navigate", { url: origin + "/" });
await until(
  `!![...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='맞춤 진단 시작하기')`,
);
await evaluate(
  `[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='맞춤 진단 시작하기').click()`,
);
await until(
  `document.body?.innerText.includes('상세 정보 입력하기') && [...document.querySelectorAll('button')].some(b=>Object.keys(b).some(k=>k.startsWith('__reactProps')))`,
);
assert.equal(
  await evaluate(
    `document.querySelectorAll('[aria-label="지원 분야 선택"] button').length`,
  ),
  6,
);
assert.equal(
  await evaluate(`document.body.innerText.includes('교복 구입')`),
  false,
);
assert.equal(
  await evaluate(
    `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('상세 정보 입력하기')).disabled`,
  ),
  true,
);
await click("아동 교육");
await click("아동 교육");
assert.equal(
  await evaluate(
    `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('상세 정보 입력하기')).disabled`,
  ),
  true,
);
async function pickLocation(id, label) {
  await evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
  await until(`!!document.querySelector(':popover-open [role=option]')`);
  await evaluate(
    `[...document.querySelectorAll(':popover-open [role=option]')].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`,
  );
}
await pickLocation("recommendation-region", "서울특별시");
await pickLocation("recommendation-district", "강남구");
await pickLocation("recommendation-region", "부산광역시");
assert.equal(
  await evaluate(
    `document.getElementById('recommendation-district').textContent.includes('강남구')`,
  ),
  false,
);
await capture("recommendation-intake-mobile");
for (const category of [
  "임신·출산",
  "양육·보육",
  "돌봄",
  "의료·건강",
  "주거·생활지원",
  "아동 교육",
]) {
  await click(category);
  await click("상세 정보 입력하기");
  assert.equal(
    await evaluate(`document.body.innerText.includes('교복 구입')`),
    category === "아동 교육",
  );
  if (["임신·출산", "의료·건강", "주거·생활지원"].includes(category)) {
    assert.equal(
      await evaluate(
        `!!document.querySelector('section[aria-label="자녀 1 정보"]')`,
      ),
      false,
    );
    assert.equal(
      await evaluate(
        `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('질문 시작하기')).disabled`,
      ),
      false,
    );
  }
  if (category !== "아동 교육") await click("거주지·분야 변경");
}
await click("질문 시작하기");
await until(`document.body?.innerText.includes('지금 확인할 질문을 마쳤어요')`);
await click("추천 결과 보기");
await until(`document.body?.innerText.includes('맞춤 추천을 준비하고 있어요')`);
assert.equal(await evaluate("document.querySelectorAll('article').length"), 0);
assert.equal(
  await evaluate(
    "document.body.innerText.includes('받을 수 있는 지원이 없다는 뜻은 아니에요')",
  ),
  true,
);
await capture("recommendation-live-awaiting-review");
await send("Page.navigate", { url: origin + "/policy/match/test" });
await until(
  `document.body?.innerText.includes('검증용 정책 · 테스트') && [...document.querySelectorAll('button')].some(b=>Object.keys(b).some(k=>k.startsWith('__reactProps')))`,
);
await capture("recommendation-setup-mobile");
assert.equal(
  await evaluate(
    'document.querySelectorAll("section[aria-label^=자녀]").length',
  ),
  1,
);
await click("남");
await click("남");
assert.equal(
  await evaluate(
    'document.querySelectorAll("section[aria-label^=자녀] [aria-pressed=true]").length',
  ),
  0,
);
await click("여");
await pickLocation("child-1-birth-year", "2020년");
await click("자녀 추가");
await pickLocation("child-2-birth-year", "2023년");
await evaluate(
  'document.querySelector("[aria-label=\\"자녀 1 삭제\\"]").click()',
);
assert.equal(
  await evaluate(
    'document.getElementById("child-2-birth-year").textContent.includes("2023년")',
  ),
  true,
);
await evaluate(
  'document.querySelector("[aria-label=\\"자녀 1 삭제\\"]").click()',
);
assert.equal(
  await evaluate(
    '[...document.querySelectorAll("button")].find(b=>b.textContent.includes("질문 시작하기")).disabled',
  ),
  true,
);
await click("자녀 추가");
assert.equal(
  await evaluate(
    'document.getElementById("child-3-birth-year").textContent.includes("모름")',
  ),
  true,
);
await evaluate(
  `document.querySelectorAll('fieldset')[1].querySelector('input').click()`,
);
assert.equal(
  await evaluate(
    `document.querySelectorAll('fieldset')[1].querySelectorAll('input:checked').length`,
  ),
  0,
);
await evaluate(
  `document.querySelectorAll('fieldset')[1].querySelectorAll('input').forEach(b=>b.click())`,
);
assert.equal(
  await evaluate(
    `document.querySelectorAll('fieldset')[1].querySelectorAll('input:checked').length`,
  ),
  2,
);
assert.equal(
  await evaluate("document.documentElement.scrollWidth <= innerWidth"),
  true,
);
await click("자녀 추가");
await capture("recommendation-child-profiles-mobile");
await click("질문 시작하기");
await until(`!!document.querySelector('[aria-label="답변 선택지"]')`);
assert.equal(await evaluate("document.querySelectorAll('article').length"), 0);
await capture("recommendation-question-mobile");
assert.equal(
  await evaluate(
    `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('선택한 답변으로 다음')).disabled`,
  ),
  true,
);
await evaluate(
  `document.querySelector('[aria-label="답변 선택지"] button').click()`,
);
assert.equal(
  await evaluate(
    `document.querySelectorAll('[aria-label="답변 선택지"] [aria-pressed="true"]').length`,
  ),
  1,
);
await evaluate(
  `document.querySelector('[aria-label="답변 선택지"] button').click()`,
);
assert.equal(
  await evaluate(
    `[...document.querySelectorAll('button')].find(b=>b.textContent.includes('선택한 답변으로 다음')).disabled`,
  ),
  true,
);
await click("잘 모르겠어요");
await until(`document.body?.innerText.includes('이번 묶음 2 / 5')`);
await click("← 이전");
await until(`document.body?.innerText.includes('이번 묶음 1 / 5')`);
await click("건너뛰기");
await until(`document.body?.innerText.includes('이번 묶음 2 / 5')`);
await click("질문 마치기");
await until(
  `document.body?.innerText.includes('우리 아이에게 맞는 지원을 정리하고 있어요')`,
);
assert.equal(
  await evaluate(
    "document.querySelector('[role=status] [aria-hidden=true]').querySelectorAll(':scope > span').length",
  ),
  3,
);
assert.equal(await evaluate("document.querySelectorAll('article').length"), 0);
await capture("recommendation-preparing-mobile");
await until(
  `document.body?.innerText.includes('우리 가족에게 맞는 정책을 모았어요')`,
);
assert.equal(await evaluate("document.querySelectorAll('article').length"), 2);
assert.equal(
  await evaluate(
    "document.querySelectorAll('article')[0].innerText.includes('자녀 2')",
  ),
  true,
);
await evaluate(
  `[...document.querySelectorAll('button')].find(b=>b.textContent.startsWith('내 답변 확인·수정')).click()`,
);
await click("수정");
await until(`document.body?.innerText.includes('답변 수정')`);
await evaluate(
  `document.querySelector('[aria-label="답변 선택지"] button').click()`,
);
await click("선택한 답변으로 다음");
await until(
  `document.body?.innerText.includes('우리 가족에게 맞는 정책을 모았어요')`,
);
await click("상세보기");
await until(`!!document.querySelector('dialog[open]')`);
assert.equal(await evaluate(`document.body.style.overflow`), "hidden");
assert.equal(
  await evaluate(
    `document.querySelector('dialog').innerText.includes('실제 신청 가능한 정책이 아니에요')`,
  ),
  true,
);
await click("구비 서류");
assert.equal(
  await evaluate(
    `[...document.querySelectorAll('dialog button')].find(b=>b.textContent==='구비 서류').getAttribute('aria-expanded')`,
  ),
  "true",
);
await capture("recommendation-detail-mobile");
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
await until(`!document.querySelector('dialog[open]')`);
assert.equal(await evaluate(`document.body.style.overflow`), "");
assert.equal(await evaluate(`document.activeElement.textContent`), "상세보기");
await capture("recommendation-results-mobile");
assert.equal(
  await evaluate("document.documentElement.scrollWidth <= innerWidth"),
  true,
);
await send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await capture("recommendation-results-desktop");
await click("처음부터");
await click("질문 시작하기");
for (let count = 1; count <= 5; count++) {
  await until(`document.body.innerText.includes('이번 묶음 ${count} / 5')`);
  await click("잘 모르겠어요");
}
await until(`document.body.innerText.includes('다섯 가지 답변을 확인했어요')`);
assert.equal(await evaluate(`document.querySelectorAll('article').length`), 0);
await click("추가 질문 계속하기");
await until(`document.body.innerText.includes('이번 묶음 1 / 5')`);
// Real catalog integration: read-only public API, no fixture interception.
await send("Page.navigate", { url: origin + "/policy" });
await until(
  `!!document.querySelector('article h2 button') && [...document.querySelectorAll('button')].some(b=>Object.keys(b).some(k=>k.startsWith('__reactProps')))`,
);
const realTitle = await evaluate(
  `document.querySelector('article h2 button').textContent`,
);
await evaluate(
  `(()=>{const b=document.querySelector('article h2 button');b.focus();b.click()})()`,
);
await until(`!!document.querySelector('dialog[open]')`);
assert.equal(
  await evaluate(`document.querySelector('dialog[open] h2').textContent`),
  realTitle,
);
assert.equal(await evaluate(`location.pathname`), "/policy");
assert.equal(
  await evaluate(
    `document.querySelector('dialog[open]').contains(document.activeElement)`,
  ),
  true,
);
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await capture("real-policy-detail-mobile");
assert.equal(
  await evaluate(
    `document.querySelector('dialog[open]').scrollWidth <= document.querySelector('dialog[open]').clientWidth`,
  ),
  true,
);
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
await until(`!document.querySelector('dialog[open]')`);
assert.equal(await evaluate(`document.activeElement.textContent`), realTitle);
console.log(
  JSON.stringify({
    passed: true,
    flow: [
      "live-server-awaiting-review",
      "residence-and-six-categories-first",
      "district-reset-on-region-change",
      "category-specific-detail-options",
      "required-child",
      "child-sex-year-add-delete-preserve-identity",
      "optional-multi-interest",
      "single-select-deselect",
      "detail-modal-escape-focus",
      "real-catalog-detail-modal",
      "five-question-limit-and-continue",
      "multi-child",
      "question",
      "unknown",
      "back",
      "skip",
      "finish",
      "edit",
    ],
    mobileOverflow: false,
  }),
);
ws.close();
