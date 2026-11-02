#!/usr/bin/env node
/**
 * End-to-end test in real headless Chrome, driven over the DevTools
 * protocol (no extra dependencies - Node 22 has WebSocket built in).
 *
 *   EMAIL=... PASSWORD=... node scripts/browser-test.mjs [base-url] [screenshot-dir] [receipt-photo]
 *
 * Logs in, adds an expense by hand, scans a receipt photo (when given),
 * then opens every page on a phone and a laptop screen, failing on any
 * JavaScript error or error page. Run against the "development" database.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const BASE = (process.argv[2] ?? "http://localhost:3002").replace(/\/$/, "");
const SHOTS = process.argv[3];
const RECEIPT = process.argv[4] && resolve(process.argv[4]);
const { EMAIL, PASSWORD } = process.env;
if (!EMAIL || !PASSWORD) {
  console.error("Set EMAIL and PASSWORD of a test account.");
  process.exit(1);
}
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const PAGES = ["/", "/expenses", "/expenses/new", "/scan", "/reports", "/categories", "/recurring", "/settings", "/admin"];
const SCREENS = [
  { name: "phone", width: 390, height: 844, mobile: true, scale: 2 },
  { name: "laptop", width: 1440, height: 900, mobile: false, scale: 1 },
];

const port = 9334;
const chrome = spawn("google-chrome", [
  "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "et-chrome-"))}`,
  "--no-first-run", "--hide-scrollbars", "about:blank",
], { stdio: "ignore" });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) {
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch { await wait(200); }
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let nextId = 0;
const pending = new Map();
const errors = [];
ws.addEventListener("message", ({ data }) => {
  const msg = JSON.parse(data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
  if (msg.method === "Runtime.exceptionThrown") errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") errors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};
const waitFor = async (expression, timeout = 15000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await evaluate(expression).catch(() => false)) return;
    await wait(200);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
};
const goto = async (path) => {
  await send("Page.navigate", { url: BASE + path });
  await waitFor("document.readyState === 'complete'");
  await wait(400);
};
const shot = async (name) => {
  if (!SHOTS) return;
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(data, "base64"));
};
/** Types into a React-controlled input so React sees the change. */
const fill = (selector, value) => evaluate(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)});
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
})()`);
const click = (selector) => evaluate(`(document.querySelector(${JSON.stringify(selector)}).click(), true)`);
const clickText = (text) => evaluate(`(() => {
  const el = [...document.querySelectorAll("button, a")].find((e) => e.textContent.trim().startsWith(${JSON.stringify(text)}));
  if (!el) throw new Error("No button: " + ${JSON.stringify(text)});
  el.click(); return true;
})()`);
const step = (name) => console.log(`- ${name}`);

let failed = false;
let receiptList = "/expenses";
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("DOM.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  step("login page and wrong password");
  await goto("/login");
  await fill("input[name=email]", EMAIL);
  await fill("input[name=password]", "definitely wrong");
  await click("form button[type=submit]");
  await waitFor(`document.body.innerText.includes("Nieprawidłowy e-mail lub hasło")`);

  step("login");
  await fill("input[name=password]", PASSWORD);
  await click("form button[type=submit]");
  await waitFor(`location.pathname === "/" && document.body.innerText.includes("Twoje wydatki")`);

  step("add an expense by hand, with AI category suggestion");
  await goto("/expenses/new");
  await fill("input[name=amount]", "23,50");
  await fill("input[name=merchant]", "Stacja Orlen paliwo");
  await click("button[aria-label='Podpowiedz kategorię']");
  await waitFor(`document.querySelector("select[name=categoryId]").value !== ""`, 30000);
  const suggested = await evaluate(`document.querySelector("select[name=categoryId]").selectedOptions[0].textContent`);
  console.log(`  suggested category: ${suggested}`);
  await fill("input[name=tags]", "auto, test");
  await click("form button[type=submit]:not([name])");
  await waitFor(`location.pathname === "/expenses" && document.body.innerText.includes("Stacja Orlen paliwo")`);

  if (RECEIPT) {
    step("scan a receipt");
    await goto("/scan");
    const { root } = await send("DOM.getDocument");
    const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "#receipt-photo" });
    await send("DOM.setFileInputFiles", { nodeId, files: [RECEIPT] });
    await waitFor(`document.body.innerText.includes("Jak zapisać")`, 90000);
    const summary = await evaluate(`[...document.querySelectorAll("main li")].map((li) => li.innerText.replace(/\\s+/g, " ")).slice(0, 12).join(" | ")`);
    console.log(`  read: ${summary}`);
    await shot("scan-review-phone");
    await clickText("Zapisz");
    await waitFor(`location.pathname === "/expenses"`, 30000);
    // The app lands on the month of the receipt date
    receiptList = await evaluate("location.pathname + location.search");
  }

  for (const screen of SCREENS) {
    await send("Emulation.setDeviceMetricsOverride", { width: screen.width, height: screen.height, deviceScaleFactor: screen.scale, mobile: screen.mobile });
    for (const path of PAGES) {
      step(`${screen.name} ${path}`);
      const before = errors.length;
      await goto(path);
      const status = await evaluate(`document.title + " | " + (document.body.innerText.includes("Application error") ? "APP ERROR" : "ok")`);
      if (status.includes("APP ERROR") || errors.length > before) throw new Error(`${path} on ${screen.name}: ${status} ${errors.slice(before).join("; ")}`);
      await shot(`${screen.name}${path === "/" ? "-dashboard" : path.replace(/\//g, "-")}`);
    }
  }

  step("open the first expense");
  await goto("/expenses");
  await click("main a[href^='/expenses/']:not([href='/expenses/new'])");
  await waitFor(`/^\\/expenses\\/[^/]+$/.test(location.pathname) && !location.pathname.endsWith("/new")`);
  await wait(500);
  await shot("laptop-expense-detail");

  if (RECEIPT) {
    step("receipt photo is shown with its expense");
    await goto(receiptList);
    await click("main a[href^='/expenses/']:not([href='/expenses/new'])");
    await waitFor(`document.querySelector("img[alt='Zdjęcie paragonu']")?.complete && document.querySelector("img[alt='Zdjęcie paragonu']").naturalWidth > 0`);
    await shot("laptop-receipt-expense");
  }

  if (errors.length) throw new Error(`JavaScript errors:\n${errors.join("\n")}`);
  console.log("\nAll good.");
} catch (error) {
  failed = true;
  console.error(`\nFAILED: ${error.message}`);
  await shot("failure").catch(() => {});
} finally {
  ws.close();
  chrome.kill();
  process.exit(failed ? 1 : 0);
}
