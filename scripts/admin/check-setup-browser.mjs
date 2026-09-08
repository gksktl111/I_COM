// Run against a local Next server and Chrome started with --remote-debugging-port=9224.
// Uses only a synthetic token and mismatched passwords; never consumes a real invite.
import assert from "node:assert/strict";
const origin = process.env.ADMIN_TEST_ORIGIN || "http://localhost:3002";
const targets = await (await fetch("http://127.0.0.1:9224/json")).json();
const target = targets.find((item) => item.type === "page");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let id = 0;
const pending = new Map();
const submissions = [];
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const handlers = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) handlers?.reject(new Error(message.error.message));
    else handlers?.resolve(message.result);
  }
  if (message.method === "Network.requestWillBeSent") {
    const request = message.params.request;
    if (request.method === "POST" && request.url === origin + "/admin/setup")
      submissions.push(request.postData || "");
  }
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const sequence = ++id;
    pending.set(sequence, { resolve, reject });
    ws.send(JSON.stringify({ id: sequence, method, params }));
  });
}
async function evaluate(expression) {
  const response = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
  });
  if (response.exceptionDetails) throw new Error("Browser evaluation failed");
  return response.result.value;
}
async function until(expression) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Browser condition timed out");
}
try {
  await send("Network.enable");
  const fragment = "#token_hash=" + "b".repeat(64);
  await send("Page.navigate", { url: origin + "/admin/setup" + fragment });
  await until('!!document.querySelector("#new-password")');
  await new Promise((resolve) => setTimeout(resolve, 1500));
  assert.equal(
    await evaluate("location.hash.length > 0"),
    true,
    "token retained after hydration",
  );
  await send("Page.reload");
  await until('!!document.querySelector("#new-password")');
  await new Promise((resolve) => setTimeout(resolve, 1000));
  assert.equal(
    await evaluate("location.hash.length > 0"),
    true,
    "token retained after reload",
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    await evaluate(
      `document.querySelector('#new-password').value='synthetic-password';document.querySelector('#confirm-password').value='different-password';document.querySelector('form').requestSubmit();true`,
    );
    await until(
      `document.body.innerText.includes('확인란에도 동일하게') && !document.querySelector('button').disabled`,
    );
    await until(`document.querySelector('#new-password').value === ''`);
    assert.equal(
      await evaluate("location.hash.length > 0"),
      true,
      "token retained after validation failure",
    );
  }
  assert.equal(submissions.length, 2);
  assert.ok(
    submissions.every((body) => body.includes("b".repeat(64))),
    "token sent on both initial submission and retry",
  );
  console.log(
    "PASS: hydration, reload, validation failure, and retry preserve and submit the synthetic token.",
  );
} finally {
  ws.close();
}
