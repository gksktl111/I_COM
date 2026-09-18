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
const origin = process.env.UI_TEST_ORIGIN || "http://127.0.0.1:3002";
const debug = process.env.UI_TEST_DEBUG || "http://127.0.0.1:9225";
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
async function navigate(path) {
  await evaluate("window.__previousDocument = true");
  await send("Page.navigate", { url: origin + path });
  await until(
    "!window.__previousDocument && document.readyState === 'complete' && !!document.querySelector('#main-content')",
  );
  await until("!!document.querySelector('header button')");
}
async function click(text) {
  await evaluate(
    `(()=>{ const button = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === ${JSON.stringify(text)}); if (!button) throw Error('Button not found'); button.focus(); button.click(); })()`,
  );
}
async function chooseRegion(name) {
  await evaluate(
    `(()=>{const label=[...document.querySelectorAll('main label')].find(el=>el.textContent==='시·도');const button=document.getElementById(label.htmlFor);button.focus();button.click();})()`,
  );
  await until("!!document.querySelector(':popover-open [role=listbox]')");
  await evaluate(
    `(()=>{const option=[...document.querySelectorAll(':popover-open [role=listbox] [role=option]')].find(el=>el.textContent.trim()===${JSON.stringify(name)});option.click();})()`,
  );
}
async function openDistrict(scope = "main") {
  await evaluate(
    `(()=>{const label=[...document.querySelectorAll('${scope} label')].find(el=>el.textContent==='시·군·구');const button=document.getElementById(label.htmlFor);button.focus();button.click();})()`,
  );
  await until(
    `!!document.querySelector(':popover-open input[placeholder="시·군·구 검색"]') && document.activeElement.tagName==='INPUT'`,
  );
}
async function searchDistrict(text) {
  await evaluate(
    `(()=>{const input=document.querySelector(':popover-open input[placeholder="시·군·구 검색"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(text)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
}
async function viewport(width) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
}
let fixtureScript;
let denialScript;
try {
  await send("Page.enable");
  await send("Network.enable");
  await send("Network.setBlockedURLs", { urls: ["*oapi.map.naver.com*"] });
  denialScript = await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
    window.__geoCalls = 0;
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition(success, failure) { window.__geoCalls++; setTimeout(() => failure({ code: 1, message: "Fixture permission denied" }), 0); } } });
  `,
  });
  await viewport(1280);
  await navigate("/");
  assert.ok(
    await evaluate(
      "document.body.innerText.includes('대한민국 아동 공공 복지 나침반')",
    ),
  );
  assert.equal(
    await evaluate(
      "document.querySelector('main a[href=\"/policy/match\"]').textContent.trim()",
    ),
    "맞춤 진단 시작하기",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('header').textContent.includes('조건 간편 확인')",
    ),
    false,
  );
  await evaluate("window.scrollTo(0, 350)");
  await until("document.querySelector('header').dataset.collapsed === 'true'");
  await until(
    "Math.abs(document.querySelector('#service-navigation').getBoundingClientRect().top) <= 2",
  );
  await evaluate("window.scrollTo(0, 200)");
  await until("document.querySelector('header').dataset.collapsed === 'false'");
  await until(
    "Math.abs(document.querySelector('.header-brand-row').getBoundingClientRect().top) <= 2",
  );
  console.log(
    "PASS: QA 1–4 scroll direction, persistent navigation and header/CTA copy",
  );
  await viewport(390);
  await navigate("/");
  await evaluate(
    "document.querySelector('[aria-label=\"메뉴 열기\"]').click()",
  );
  await until(
    "document.querySelector('[aria-label=\"메뉴 닫기\"]')?.getAttribute('aria-expanded') === 'true'",
  );
  await evaluate(
    "document.querySelector('#service-navigation a[href=\"/community\"]').click()",
  );
  await until(
    "location.pathname === '/community' && !!document.querySelector('h1')?.textContent.includes('커뮤니티')",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[aria-label=\"메뉴 열기\"]').getAttribute('aria-expanded')",
    ),
    "false",
  );
  await click("작성 기능 안내");
  await until("!!document.querySelector('dialog[open]')");
  assert.equal(
    await evaluate(
      "document.querySelector('dialog').contains(document.activeElement)",
    ),
    true,
    "focus enters modal",
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
  await until("!document.querySelector('dialog[open]')");
  assert.equal(
    await evaluate("document.activeElement.textContent.trim()"),
    "작성 기능 안내",
    "focus returns to trigger",
  );
  console.log("PASS: mobile menu and modal focus/Escape");
  await viewport(1280);
  await click("크게");
  assert.equal(
    await evaluate("getComputedStyle(document.documentElement).fontSize"),
    "18.4px",
  );
  await navigate("/login");
  assert.equal(
    await evaluate("getComputedStyle(document.documentElement).fontSize"),
    "18.4px",
    "text-size preference survives navigation",
  );
  await click("기본");
  console.log("PASS: persistent text size");
  await navigate("/map");
  await until("window.__geoCalls > 0");
  await new Promise((resolve) => setTimeout(resolve, 500));
  const deniedCalls = await evaluate("window.__geoCalls");
  assert.ok(
    deniedCalls <= 2,
    "denial does not continuously retry across map consumers",
  );
  await click("내 위치");
  await until(`window.__geoCalls === ${deniedCalls + 1}`);
  console.log("PASS: denied location stops and manual retry remains available");
  for (const width of [320, 390, 768, 1280]) {
    await viewport(width);
    for (const path of ["/", "/login", "/community", "/guide", "/map"]) {
      await navigate(path);
      assert.equal(
        await evaluate("document.documentElement.scrollWidth > innerWidth"),
        false,
        `${path} fits ${width}px`,
      );
    }
  }
  await viewport(390);
  for (const path of [
    "/",
    "/login",
    "/community",
    "/guide",
    "/map",
    "/policy",
    "/policy/match",
  ]) {
    await navigate(path);
    await evaluate("document.documentElement.style.fontSize = '200%'");
    assert.equal(
      await evaluate("document.documentElement.scrollWidth > innerWidth"),
      false,
      `${path} fits 390px at 200% text size`,
    );
  }
  await evaluate("document.documentElement.style.fontSize = '100%'");
  console.log("PASS: 200% text size has no horizontal page overflow");
  await send("Network.enable");
  await send("Network.setBlockedURLs", { urls: ["*oapi.map.naver.com*"] });
  await viewport(390);
  await navigate("/policy/match");
  assert.equal(
    await evaluate(
      "document.querySelector('main [role=group]').getAttribute('aria-label')",
    ),
    "지원 분야 선택",
  );
  assert.equal(
    await evaluate("!!document.querySelector('main select:not([hidden])')"),
    false,
  );
  assert.equal(
    await evaluate(
      "[...document.querySelectorAll('main button')].find(el => el.textContent.trim() === '상세 정보 입력하기').disabled",
    ),
    true,
    "지원 분야를 선택하기 전에는 다음 단계로 갈 수 없음",
  );
  assert.ok(
    await evaluate(
      "document.querySelector('h1').textContent.includes('어떤 지원')",
    ),
  );
  await click("돌봄");
  await until("!!document.querySelector('main select')");
  assert.equal(
    await evaluate(
      "!!document.querySelector('main [role=radiogroup][aria-label=\"현재 가족 상황\"]')",
    ),
    false,
    "general child support skips pregnancy questions",
  );
  await click("임신·출산");
  assert.equal(
    await evaluate(
      "!!document.querySelector('main [aria-label=\"현재 가족 상황\"]')",
    ),
    false,
    "step one only asks interest and residence",
  );

  await evaluate("document.querySelector('main [role=combobox]').focus()");
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "ArrowDown",
    code: "ArrowDown",
    windowsVirtualKeyCode: 40,
  });
  await until("!!document.querySelector(':popover-open [role=listbox]')");
  await evaluate(
    "[...document.querySelectorAll(':popover-open [role=listbox] [role=option]')].find(el=>el.textContent.includes('서울')).click()",
  );
  await until(
    "document.querySelector('main [role=combobox]').textContent.includes('서울')",
  );
  assert.equal(
    await evaluate("document.querySelector('main select').value"),
    "서울특별시",
  );
  console.log(
    "PASS: QA 7/8 custom dropdown keyboard opening and option selection",
  );
  await openDistrict();
  await searchDistrict("강남");
  await until(
    "[...document.querySelectorAll('[role=option]')].filter(el=>el.getClientRects().length).length===1",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await until("document.querySelectorAll('main select')[1].value==='강남구'");
  await chooseRegion("경기도");
  assert.equal(
    await evaluate("document.querySelectorAll('main select')[1].value"),
    "",
    "province change clears district",
  );
  await openDistrict();
  await searchDistrict("없는지역검증");
  await until(
    "![...document.querySelectorAll('[role=option]')].some(el=>el.getClientRects().length)",
  );
  await searchDistrict("수원 영통");
  await until(
    "[...document.querySelectorAll('[role=option]')].some(el=>el.getClientRects().length && el.textContent.includes('영통구'))",
  );
  await evaluate(
    "[...document.querySelectorAll('[role=option]')].find(el=>el.getClientRects().length && el.textContent.includes('영통구')).click()",
  );
  await until(
    "document.querySelectorAll('main select')[1].value==='수원시 영통구'",
  );
  await chooseRegion("세종특별자치시");
  assert.ok(
    await evaluate("document.querySelectorAll('main select')[1].disabled"),
  );
  await chooseRegion("서울특별시");
  await openDistrict();
  await searchDistrict("강남");
  await until(
    "[...document.querySelectorAll('[role=option]')].some(el=>el.getClientRects().length && el.textContent.includes('강남구'))",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await until("document.querySelectorAll('main select')[1].value==='강남구'");
  console.log(
    "PASS: searchable district options, selection, region reset, no matches and Sejong",
  );
  await capture("match-mobile");
  // prettier-ignore
  if (process.env.UI_TEST_LEGACY_RECOMMENDATION === "1") {
  await click("상세 정보 입력하기");
  await until(
    "document.querySelector('h1').textContent.includes('우리 가족에게')",
  );
  await evaluate(
    "document.querySelector('main input[type=radio][value=\"임신 중\"]').click()",
  );
  await evaluate(
    "document.querySelector('main input[type=radio][value=\"자녀 양육 중\"]').click()",
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('main [aria-label=\"현재 가족 상황\"] input[type=radio]:checked').length",
    ),
    1,
  );
  assert.equal(
    await evaluate(
      "document.querySelector('main [aria-label=\"현재 가족 상황\"] input[type=radio]:checked').value",
    ),
    "자녀 양육 중",
  );
  console.log("PASS: family situation single selection");

  assert.equal(
    await evaluate(
      "[...document.querySelectorAll('main button')].find(el=>el.textContent.trim()==='이전 단계').getBoundingClientRect().top < document.querySelector('main h1').getBoundingClientRect().top",
    ),
    true,
    "previous step above heading",
  );
  await click("자녀 추가하기");
  await until("!!document.querySelector('main input[type=date]')");
  assert.ok(
    await evaluate(
      "document.querySelector('h1').textContent.includes('우리 가족에게')",
    ),
    "adding child stays in input step",
  );
  await evaluate(
    "document.querySelector('[aria-label=\"자녀 1 삭제\"]').click()",
  );
  await until("!document.querySelector('main input[type=date]')");
  assert.ok(
    await evaluate(
      "document.querySelector('h1').textContent.includes('우리 가족에게')",
    ),
    "deleting child stays in input step",
  );
  await click("자녀 추가하기");
  await until("!!document.querySelector('main input[type=date]')");
  await evaluate(
    `(()=>{const input=document.querySelector('main input[type=date]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'2024-01-15');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click("입력한 정보로 정책 찾기");
  await until(
    "document.querySelector('h1').textContent.includes('살펴볼 지원 정책')",
  );
  assert.equal(
    await evaluate(
      "[...document.querySelectorAll('button')].some(el=>el.textContent.trim()==='조건 다시 설정')",
    ),
    false,
  );
  console.log(
    "PASS: QA 5/6/9 fixed aligned steps, upper previous button, no duplicate reset",
  );
  await click("분야 변경");
  await until("!!document.querySelector('dialog[open]')");
  await evaluate(
    "document.querySelector('dialog[open] input[aria-label=돌봄]').click()",
  );
  assert.equal(
    await evaluate(
      "document.querySelectorAll('dialog[open] input[type=radio]:checked').length",
    ),
    1,
    "changing interest replaces previous selection",
  );
  await until("!!document.querySelector('dialog[open] select')");
  await evaluate(
    "(()=>{const button=document.querySelector('dialog[open] [role=combobox]');button.focus();button.click();})()",
  );
  await until("!!document.querySelector(':popover-open [role=listbox]')");
  await capture("dropdown-modal");
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
  await until("!document.querySelector(':popover-open [role=listbox]')");
  assert.ok(
    await evaluate("!!document.querySelector('dialog[open]')"),
    "Escape closes dropdown before enclosing dialog",
  );
  assert.equal(
    await evaluate("document.querySelectorAll('dialog[open] select')[1].value"),
    "강남구",
    "district preserved in edit dialog",
  );
  await openDistrict("dialog[open]");
  await searchDistrict("종로");
  await until(
    "[...document.querySelectorAll(':popover-open [role=option]')].some(el=>el.textContent.includes('종로구'))",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await until("!document.querySelector(':popover-open')");
  assert.ok(
    await evaluate("!!document.querySelector('dialog[open]')"),
    "search Escape leaves dialog open",
  );
  await click("맞춤 상세 정보");
  await until("!!document.querySelector('dialog input[type=number]')");
  assert.equal(
    await evaluate("document.querySelector('dialog input[type=date]').value"),
    "2024-01-15",
    "edit modal preserves child input",
  );
  await evaluate(
    `(()=>{const input=document.querySelector('dialog input[type=number]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'-1');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click("기본 및 관심 분야");
  await until("!document.querySelector('dialog input[type=number]')");
  await click("수정한 조건 적용");
  await until("!!document.querySelector('dialog[open] [role=alert]')");
  assert.ok(
    await evaluate(
      "document.querySelector('dialog [role=alert]').textContent.includes('총자녀 수')",
    ),
    "hidden invalid field cannot bypass validation",
  );
  await evaluate(
    `(()=>{const input=document.querySelector('dialog input[type=number]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'1');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await click("수정한 조건 적용");
  await until("!document.querySelector('dialog[open]')");
  console.log(
    "PASS: child add/remove, wizard results, shared edit values and hidden-field validation",
  );
  for (const [interest, section] of [
    ["임신·출산", "출산 예정 시기"],
    ["양육·보육", "보육·교육 이용 현황"],
    ["돌봄", "필요한 돌봄"],
    ["의료·건강", "필요한 의료·건강 지원"],
    ["주거·생활지원", "주거·생활 지원 정보"],
  ]) {
    await navigate("/policy/match");
    await evaluate(
      `document.querySelector('main input[aria-label="${interest}"]').click()`,
    );
    await click("상세 정보 입력하기");
    if (interest === "임신·출산") {
      await evaluate(
        "document.querySelector('main input[value=\"임신 중\"]').click()",
      );
    }
    if (interest === "양육·보육") await click("자녀 추가하기");
    await until(
      `document.querySelector('main').innerText.includes(${JSON.stringify(section)})`,
    );
    if (interest === "임신·출산") {
      assert.equal(
        await evaluate(
          "document.querySelector('main').innerText.includes('자녀 추가하기')",
        ),
        false,
      );
    }
    if (interest === "의료·건강") {
      assert.equal(
        await evaluate(
          "document.querySelector('main').innerText.includes('가족 및 가구 특성')",
        ),
        false,
      );
      assert.equal(
        await evaluate(
          "document.querySelector('main').innerText.includes('필요한 돌봄')",
        ),
        false,
      );
    }
    if (interest === "돌봄") {
      await evaluate(
        "(()=>{const group=[...document.querySelectorAll('main [role=group]')].find(el=>el.getAttribute('aria-label')==='필요한 돌봄');const button=group.querySelector('[role=combobox]');button.focus();button.click();})()",
      );
      await until("!!document.querySelector(':popover-open [role=option]')");
      await evaluate(
        "document.querySelectorAll(':popover-open [role=option]')[1].click()",
      );
      await click("입력한 정보로 정책 찾기");
      await click("분야 변경");
      await click("맞춤 상세 정보");
      await until(
        "document.querySelector('dialog[open]').innerText.includes('필요한 돌봄')",
      );
      assert.notEqual(
        await evaluate(
          "[...document.querySelectorAll('dialog[open] [role=group]')].find(el=>el.getAttribute('aria-label')==='필요한 돌봄').querySelector('select').value",
        ),
        "unknown",
        "category answer survives results and edit",
      );
      await capture("care-questions-mobile");
    }
  }
  console.log("PASS: all five interest question sets and answer preservation");
  }
  fixtureScript = await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
    const fixtures = [
      { id: 'fixture-library', name: '검증용 도서관', category: '도서관', address: '테스트 주소 1', lat: 37.57, lng: 126.98 },
      { id: 'fixture-care', name: '검증용 어린이집', category: '어린이집', address: '테스트 주소 2', lat: 37.58, lng: 126.99 }
    ];
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, options) => {
      const url = String(input);
      if (url.startsWith('/api/places?')) return Promise.resolve(new Response(JSON.stringify({ results: fixtures }), { headers: { 'Content-Type': 'application/json' } }));
      if (url.startsWith('/api/revgeo?')) return Promise.resolve(new Response(JSON.stringify({ emd: '검증용 지역' }), { headers: { 'Content-Type': 'application/json' } }));
      return originalFetch(input, options);
    };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition(success) { setTimeout(() => success({ coords: { latitude: 37.5665, longitude: 126.978 } }), 0); } } });
    window.__mapEvidence = { markers: [], pan: null };
    Object.defineProperty(window, '__naver_maps_loaded', { configurable: true, get: () => true, set: () => {} });
    window.__installNaver = () => { window.naver = { maps: {
      LatLng: class { constructor(lat, lng) { this.lat = lat; this.lng = lng; } },
      Map: class { constructor(element) { this.element = element; } destroy() { this.element.replaceChildren(); } setCenter() {} panTo(position) { window.__mapEvidence.pan = position; } },
      Marker: class { constructor(options) { this.position = options.position; this.element = options.icon.content; this.setMap(options.map); window.__mapEvidence.markers.push(this); } setZIndex(z) { this.element.style.zIndex = z; } setMap(map) { this.map = map; if (map) map.element.append(this.element); else this.element.remove(); } setPosition(position) { this.position = position; } },
      Event: { addListener(marker, name, callback) { return { marker, name, callback }; }, removeListener() {} }
    } }; document.dispatchEvent(new Event("naver-maps-loaded")); };
  `,
  });
  await viewport(390);
  await navigate("/map?q=검증");
  await until(
    "document.body.innerText.includes('검증용 도서관') && document.body.innerText.includes('검증용 어린이집')",
  );
  await evaluate("window.__installNaver()");
  await until("!!document.querySelector('[data-place-id=fixture-library]')");
  await click("시설 유형");
  await until("!!document.querySelector('dialog[open] input[type=checkbox]')");
  await evaluate(
    "[...document.querySelectorAll('dialog label')].find(el=>el.textContent.includes('도서관')).querySelector('input').click()",
  );
  await evaluate(
    "[...document.querySelectorAll('dialog button')].find(el=>el.textContent.includes('선택 적용하기')).click()",
  );
  await until(
    "!document.querySelector('dialog[open]') && !document.body.innerText.includes('검증용 어린이집')",
  );
  assert.equal(
    await evaluate(
      "window.__mapEvidence.markers.filter(marker=>marker.map && marker.position.lat===37.58).length",
    ),
    0,
    "excluded category removes map marker",
  );
  assert.equal(
    await evaluate(
      "window.__mapEvidence.markers.filter(marker=>marker.map && marker.position.lat===37.57).length",
    ),
    1,
    "selected category retains map marker",
  );
  await evaluate(
    "[...document.querySelectorAll('button')].find(el=>el.textContent.includes('검증용 도서관')).click()",
  );
  await until("window.__mapEvidence.pan?.lat === 37.57");
  assert.equal(
    await evaluate(
      "[...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='지도보기').getAttribute('aria-pressed')",
    ),
    "true",
    "result selection switches mobile map",
  );
  await evaluate(
    "document.querySelector('[data-place-id=fixture-library]').click()",
  );
  await until("!!document.querySelector('dialog[open]')");
  assert.ok(
    await evaluate(
      "document.querySelector('dialog[open]').innerText.includes('검증용 도서관')",
    ),
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
  await until("!document.querySelector('dialog[open]')");
  assert.equal(
    await evaluate("document.activeElement.dataset.placeId"),
    "fixture-library",
  );
  console.log(
    "PASS: QA 12/13 custom pin opens facility modal and restores focus",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Enter",
    code: "Enter",
    windowsVirtualKeyCode: 13,
  });
  await until("!!document.querySelector('dialog[open]')");
  assert.ok(
    await evaluate(
      "document.querySelector('dialog[open]').innerText.includes('테스트 주소 1')",
    ),
  );
  await capture("facility-modal");
  await evaluate(
    "document.querySelector('dialog[open] button[aria-label=닫기]').click()",
  );
  await click("목록보기");
  assert.equal(
    await evaluate(
      "[...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='목록보기').getAttribute('aria-pressed')",
    ),
    "true",
  );
  await viewport(1280);
  await navigate("/policy");
  await until("!!document.querySelector('main article')");
  await capture("policy-cards-desktop");
  await viewport(390);
  await capture("policy-cards-mobile");
  assert.equal(
    await evaluate("document.documentElement.scrollWidth > innerWidth"),
    false,
  );
  for (const width of [320, 1280]) {
    await viewport(width);
    await navigate("/policy/match");
    assert.equal(
      await evaluate("document.documentElement.scrollWidth > innerWidth"),
      false,
    );
  }
  console.log(
    "PASS: dropdown in dialog, delayed SDK, keyboard pin activation, policy and step responsive layout",
  );
  console.log(
    "PASS: mobile navigation, dialog Escape/focus return, persistent text size, responsive pages, map category/marker sync and selection pan.",
  );
} finally {
  if (denialScript)
    await send("Page.removeScriptToEvaluateOnNewDocument", {
      identifier: denialScript.identifier,
    });
  if (fixtureScript)
    await send("Page.removeScriptToEvaluateOnNewDocument", {
      identifier: fixtureScript.identifier,
    });
  await send("Network.setBlockedURLs", { urls: [] });
  ws.close();
}
