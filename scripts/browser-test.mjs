#!/usr/bin/env node
/**
 * End-to-end test in real headless Chrome, driven over the DevTools
 * protocol (no extra dependencies - Node 22 has WebSocket built in).
 *
 *   [AS=email] node scripts/browser-test.mjs [base-url] [screenshot-dir] [receipt-photo...]
 *
 * Needs the local preview login (DEV_LOGIN=true, seeded demo accounts).
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
const RECEIPTS = process.argv.slice(4).map((p) => resolve(p));
const RECEIPT = RECEIPTS[0];
const AS = process.env.AS ?? "mazuromarcin@gmail.com";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const PAGES = ["/", "/together", "/expenses", "/expenses/new", "/scan", "/reports", "/products", "/categories", "/recurring", "/settings", "/admin"];
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
  // A view transition cut short (the test resizes the window mid-navigation) only skips an animation
  if (JSON.stringify(msg.params ?? "").includes("Transition was aborted")) return;
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
const fillNth = (selector, n, value) => evaluate(`(() => {
  const el = document.querySelectorAll(${JSON.stringify(selector)})[${n}];
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
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
const signInAs = async (email) => {
  await send("Network.clearBrowserCookies");
  await goto("/login");
  await evaluate(`([...document.querySelectorAll("form[action='/api/auth/dev'] button")].find((b) => b.innerText.includes(${JSON.stringify(email)})).click(), true)`);
  await waitFor(`location.pathname === "/" && document.body.innerText.includes("Twoje wydatki")`, 30000);
};
const pageText = () => evaluate("document.body.innerText");
const step = (name) => console.log(`- ${name}`);

let failed = false;
let receiptList = "/expenses";
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("DOM.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  step("Google sign-in without a configured client explains itself");
  await goto("/api/auth/google");
  await waitFor(`location.pathname === "/login" && document.body.innerText.includes("nie jest jeszcze skonfigurowane")`);
  await shot("login-phone");

  step(`sign in as ${AS} (local preview login)`);
  await evaluate(`([...document.querySelectorAll("form[action='/api/auth/dev'] button")].find((b) => b.innerText.includes(${JSON.stringify(AS)})).click(), true)`);
  await waitFor(`location.pathname === "/" && document.body.innerText.includes("Twoje wydatki")`);

  step("shared view");
  await goto("/together");
  await waitFor(`document.body.innerText.includes("Wyścig miesiąca") || document.body.innerText.includes("nikt jeszcze")`);

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

  step("shared expense with lines typed by hand");
  await goto("/expenses/new");
  await fill("input[name=merchant]", "Test Kaufland wspólny");
  await fill("select[name=categoryId]", await evaluate(`[...document.querySelectorAll("select[name=categoryId] option")].find((o) => o.textContent.includes("Spożywcze")).value`));
  await clickText("Pozycje i ilości");
  await waitFor(`!!document.querySelector("input[aria-label='Nazwa pozycji']")`);
  await fill("input[aria-label='Nazwa pozycji']", "Marchew myta");
  await fill("input[aria-label='Ilość']", "1,5");
  await fill("select[aria-label='Jednostka']", "kg");
  await fill("input[aria-label='Cena pozycji']", "6,00");
  await clickText("+ Dodaj pozycję");
  await fillNth("input[aria-label='Nazwa pozycji']", 1, "Mleko 2%");
  await fillNth("input[aria-label='Ilość']", 1, "2");
  await fillNth("select[aria-label='Jednostka']", 1, "l");
  await fillNth("input[aria-label='Cena pozycji']", 1, "8,01");
  await waitFor(`document.querySelector("input[name=amount]").value === "14,01"`);
  await click("input[name=shared]");
  await waitFor(`document.body.innerText.replace(/\\s+/g, " ").includes("Ty 7,01 zł")`);
  await shot("shared-form-phone");
  await click("form button[type=submit]:not([name])");
  await waitFor(`location.pathname === "/expenses" && document.body.innerText.includes("Test Kaufland wspólny")`, 40000);
  const row = await evaluate(`[...document.querySelectorAll("main a")].find((a) => a.innerText.includes("Test Kaufland wspólny")).innerText.replace(/\\s+/g, " ")`);
  console.log(`    list: ${row}`);
  if (!row.includes("7,01") || !row.includes("14,01") || !row.includes("wspólny")) throw new Error("shared expense should show my 7,01 of 14,01");

  step("edit the shared expense - change a line price");
  await evaluate(`([...document.querySelectorAll("main a")].find((a) => a.innerText.includes("Test Kaufland wspólny")).click(), true)`);
  await waitFor(`document.querySelectorAll("input[aria-label='Cena pozycji']").length === 2`);
  await fillNth("input[aria-label='Cena pozycji']", 1, "10,00");
  await waitFor(`document.querySelector("input[name=amount]").value === "16,00"`);
  await click("form button[type=submit]:not([name])");
  await waitFor(`location.pathname === "/expenses" && document.body.innerText.replace(/\\s+/g, " ").includes("8,00 zł")`, 40000);
  await goto("/together");
  const feed = await evaluate(`[...document.querySelectorAll("main li")].find((li) => li.innerText.includes("Test Kaufland wspólny"))?.innerText.replace(/\\s+/g, " ") ?? ""`);
  console.log(`    together: ${feed}`);
  if (!feed.includes("16,00")) throw new Error("the shared view should show the whole 16,00");
  await shot("together-after-edit");

  step("full access to the other person's expenses: view, edit, delete");
  await goto("/expenses");
  await evaluate(`([...document.querySelectorAll("[role=tablist] a")].find((a) => !a.innerText.includes("Moje")).click(), true)`);
  await waitFor(`location.search.includes("u=")`);
  const other = await evaluate(`new URLSearchParams(location.search).get("u")`);
  await waitFor(`!!document.querySelector("main a[href*='/expenses/'][href*='u=']")`);
  await shot("other-person-list");
  await evaluate(`(document.querySelector("main a[href*='/expenses/'][href*='u=']").click(), true)`);
  await waitFor(`/^\\/expenses\\/[^/]+$/.test(location.pathname) && document.body.innerText.includes("Wydatek z konta")`);
  const theirId = await evaluate("location.pathname.split('/').pop()");
  await fill("textarea[name=note]", "poprawione przez test");
  await click("form button[type=submit]:not([name])");
  await waitFor(`location.pathname === "/expenses" && location.search.includes("u=${other}")`, 40000);
  await goto(`/expenses/${theirId}?u=${other}`);
  await waitFor(`document.body.innerText.includes("ostatnio zmienił(a)") && document.querySelector("textarea[name=note]").value === "poprawione przez test"`);
  await shot("other-person-expense");
  // Delete it (accept the confirm dialog)
  await send("Runtime.evaluate", { expression: "window.confirm = () => true" });
  await clickText("Usuń");
  await waitFor(`location.pathname === "/expenses" && location.search.includes("u=")`, 30000);
  const gone = await evaluate(`![...document.querySelectorAll("main a")].some((a) => a.getAttribute("href")?.startsWith("/expenses/${theirId}"))`);
  if (!gone) throw new Error("the deleted expense is still listed");

  step("the app is called Wydatki");
  await goto("/");
  if (!(await pageText()).includes("Wydatki") || (await pageText()).includes("ExpenseTracker")) throw new Error("wrong app name");

  step("hidden expense: the other person sees no trace of it");
  const OTHER = "agnieszkabielawa03@gmail.com";
  const SECRET = "Test tajny zakup";
  const addHidden = async (merchant, until) => {
    await goto("/expenses/new");
    await fill("input[name=amount]", "123,45");
    await fill("input[name=merchant]", merchant);
    await fill("select[name=categoryId]", await evaluate(`[...document.querySelectorAll("select[name=categoryId] option")].find((o) => o.textContent.includes("Prezenty")).value`));
    await click("input[name=hidden]");
    await waitFor(`!!document.querySelector("input[name=hiddenMode]")`);
    if (until) {
      await click("input[name=hiddenMode][value=time]");
      await waitFor(`!!document.querySelector("input[name=hiddenUntil]")`);
      await fill("input[name=hiddenUntil]", until);
    }
    await shot("hidden-form");
    await click("form button[type=submit]:not([name])");
    await waitFor(`location.pathname === "/expenses" && document.body.innerText.includes(${JSON.stringify(merchant)})`, 40000);
    return evaluate(`[...document.querySelectorAll("main a")].find((a) => a.innerText.includes(${JSON.stringify(merchant)})).getAttribute("href").split("/").pop()`);
  };
  const secretId = await addHidden(SECRET);
  const ownerId = await evaluate(`fetch("/expenses/${secretId}").then((r) => r.ok)`);
  if (!ownerId) throw new Error("the owner should open their hidden expense");
  await shot("hidden-owner-list");
  const month = await evaluate(`new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date()).slice(0, 7)`);
  const assertNoTrace = async (secret, id) => {
    const OWNER = "marcin";
    for (const path of [`/expenses?month=${month}&u=${OWNER}`, `/together?month=${month}`, `/reports?u=${OWNER}`, `/products?month=${month}&u=${OWNER}`, "/"]) {
      await goto(path);
      if ((await pageText()).includes(secret)) throw new Error(`${secret} leaked on ${path}`);
    }
    const csv = await evaluate(`fetch("/api/export?month=${month}&u=${OWNER}").then((r) => r.text())`);
    if (csv.includes(secret)) throw new Error(`${secret} leaked in the CSV`);
    // fetch().text() strips the BOM. A real export with other rows, not an empty or error response
    if (!csv.startsWith("Data;") || csv.trim().split("\n").length < 2) throw new Error(`unexpected CSV: ${csv.slice(0, 80)}`);
    // The loading screen streams first, so "not found" arrives with status 200 - judge by what is shown
    await goto(`/expenses/${id}?u=${OWNER}`);
    await waitFor(`document.body.innerText.includes("Nie ma takiej strony")`, 15000);
    if ((await evaluate("document.documentElement.innerHTML")).includes(secret)) throw new Error(`${secret} leaked on its direct link`);
  };
  await signInAs(OTHER);
  await assertNoTrace(SECRET, secretId);
  // Seeded examples: hers is visible to her, his timed one is not
  await goto(`/expenses?month=${month}`);
  if (!(await pageText()).includes("Perfumy dla Marcina")) throw new Error("the owner should see their own hidden expense");
  await assertNoTrace("Apart - niespodzianka", "does-not-matter");

  step("hidden expense: revealed by the owner's click");
  await signInAs(AS);
  await goto("/settings");
  if (!(await pageText()).includes(SECRET)) throw new Error("the hidden list in Settings should have it");
  await shot("settings-hidden-themes");
  await goto(`/expenses/${secretId}`);
  await clickText("Odkryj teraz");
  await waitFor(`!document.body.innerText.includes("Odkryj teraz")`, 20000);
  await signInAs(OTHER);
  await goto(`/expenses?month=${month}&u=marcin`);
  if (!(await pageText()).includes(SECRET)) throw new Error("revealed expense should be visible");

  step("hidden expense: revealed by itself at the set time (waits for real)");
  await signInAs(AS);
  // At least 30 s ahead, on a whole minute - that is what the input can express
  const revealAt = new Date(Math.ceil((Date.now() + 30_000) / 60_000) * 60_000);
  const wall = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw", dateStyle: "short", timeStyle: "short" }).format(revealAt).replace(" ", "T");
  const TIMED = "Test zakup z czasem";
  const timedId = await addHidden(TIMED, wall);
  await signInAs(OTHER);
  if (Date.now() < revealAt.getTime()) {
    const early = await evaluate(`fetch("/expenses/${timedId}?u=marcin").then((r) => r.text())`);
    if (early.includes(TIMED)) throw new Error("timed expense visible too early");
  }
  await wait(Math.max(0, revealAt.getTime() - Date.now()) + 1500);
  await goto(`/expenses?month=${month}&u=marcin`);
  if (!(await pageText()).includes(TIMED)) throw new Error("timed expense should have revealed itself");

  step("custom split: 70/30, a line for one person, a hidden line");
  await signInAs(AS);
  const SPLIT_NAME = "Test podział";
  const HIDDEN_LINE = "Sekretny prezent";
  await goto("/expenses/new");
  await fill("input[name=merchant]", SPLIT_NAME);
  await fill("select[name=categoryId]", await evaluate(`[...document.querySelectorAll("select[name=categoryId] option")].find((o) => o.textContent.includes("Spożywcze")).value`));
  await clickText("Pozycje i ilości");
  await waitFor(`!!document.querySelector("input[aria-label='Nazwa pozycji']")`);
  for (const [n, [name, price]] of [["Sok dla niej", "10,00"], ["Chleb wspólny", "20,00"], [HIDDEN_LINE, "30,00"]].entries()) {
    if (n > 0) await clickText("+ Dodaj pozycję");
    await waitFor(`document.querySelectorAll("input[aria-label='Nazwa pozycji']").length === ${n + 1}`);
    await fillNth("input[aria-label='Nazwa pozycji']", n, name);
    await fillNth("input[aria-label='Cena pozycji']", n, price);
  }
  await click("input[name=shared]");
  await waitFor(`document.querySelectorAll("button[aria-label^='Czyja pozycja']").length === 3`);
  await clickText("70/30");
  // First line: wspólna -> moja -> hers
  const chip = (n) => `document.querySelectorAll("button[aria-label^='Czyja pozycja']")[${n}]`;
  await evaluate(`(${chip(0)}.click(), true)`);
  await waitFor(`${chip(0)}.innerText.includes("moja")`);
  await evaluate(`(${chip(0)}.click(), true)`);
  await waitFor(`${chip(0)}.innerText.includes("Agnieszka")`);
  // Third line: hidden from her
  await evaluate(`(document.querySelectorAll("button[aria-label^='Ukryj tę pozycję']")[2].click(), true)`);
  // Me: 70% of 20 + the hidden 30 = 44; her: 10 + 30% of 20 = 16
  await waitFor(`document.body.innerText.replace(/\\s+/g, " ").includes("Ty 44,00 zł") && document.body.innerText.replace(/\\s+/g, " ").includes("Agnieszka 16,00 zł")`);
  await shot("split-form-phone");
  await click("form button[type=submit]:not([name])");
  await waitFor(`location.pathname === "/expenses" && document.body.innerText.includes(${JSON.stringify(SPLIT_NAME)})`, 40000);
  await shot("split-saved-toast");
  const splitId = await evaluate(`[...document.querySelectorAll("main a")].find((a) => a.innerText.includes(${JSON.stringify(SPLIT_NAME)})).getAttribute("href").split("/").pop().split("?")[0]`);
  await goto(`/expenses/${splitId}`);
  if (!(await pageText()).includes(HIDDEN_LINE) && !(await evaluate(`[...document.querySelectorAll("input")].some((i) => i.value === ${JSON.stringify(HIDDEN_LINE)})`))) throw new Error("the owner should see their hidden line");
  await shot("split-detail-owner");

  step("hidden line: the other person sees neither the line nor its price");
  await signInAs(OTHER);
  const everything = async () => (await pageText()) + " " + (await evaluate(`[...document.querySelectorAll("input, textarea")].map((i) => i.value).join(" ")`)) + " " + (await evaluate("document.documentElement.innerHTML"));
  for (const path of [`/expenses/${splitId}`, `/expenses/${splitId}?u=marcin`, `/expenses?month=${month}`, `/expenses?month=${month}&u=marcin`, `/together?month=${month}`, `/products?month=${month}&u=marcin`, `/reports?u=marcin`, "/"]) {
    await goto(path);
    const all = await everything();
    if (all.includes(HIDDEN_LINE)) throw new Error(`hidden line leaked on ${path}`);
    // 60,00 is the real total and 44,00 the owner's real part - she may only see 30,00 and 14,00
    if (path.startsWith(`/expenses/${splitId}`) && /(60|44)[,.]00/.test(await pageText())) throw new Error(`hidden price leaked on ${path}`);
  }
  for (const who of ["marcin", "agnieszka"]) {
    const csv = await evaluate(`fetch("/api/export?month=${month}&u=${who}").then((r) => r.text())`);
    if (csv.includes(HIDDEN_LINE)) throw new Error(`hidden line leaked in the CSV of ${who}`);
  }
  await goto(`/expenses?month=${month}`);
  const herRow = await evaluate(`[...document.querySelectorAll("main a")].find((a) => a.innerText.includes(${JSON.stringify(SPLIT_NAME)})).innerText.replace(/\\s+/g, " ")`);
  console.log(`    her list: ${herRow}`);
  if (!herRow.includes("16,00") || !herRow.includes("30,00") || !herRow.includes("do oddania")) throw new Error("she should owe 16,00 of the visible 30,00");
  await goto(`/expenses/${splitId}`);
  await shot("split-detail-other");

  step("paid back: Oddane and undo");
  await goto("/together");
  if (!(await pageText()).includes(SPLIT_NAME)) throw new Error("the debt should be listed in Razem");
  await shot("together-debts-phone");
  await goto(`/expenses/${splitId}`);
  await click("button[name=settled][value=on]");
  await waitFor(`!!document.querySelector("button[name=settled][value=off]")`, 20000);
  await shot("split-settled");
  await goto("/together");
  const stillOwed = await evaluate(`[...document.querySelectorAll("main form")].some((f) => f.querySelector("button[name=settled]") && f.closest("li")?.innerText.includes(${JSON.stringify(SPLIT_NAME)}))`);
  if (stillOwed) throw new Error("a settled expense should leave the debt list");
  await goto(`/expenses/${splitId}`);
  await click("button[name=settled][value=off]");
  await waitFor(`!!document.querySelector("button[name=settled][value=on]")`, 20000);

  step("themes in Settings");
  await signInAs(AS);
  for (const theme of ["hearts", "christmas", "dark", "light"]) {
    await goto("/settings");
    await click(`button[name=theme][value=${theme}]`);
    await waitFor(`document.documentElement.dataset.theme === ${JSON.stringify(theme)}`, 15000);
    await goto("/");
    if ((await evaluate("document.documentElement.dataset.theme")) !== theme) throw new Error(`${theme} did not survive a reload`);
    await shot(`theme-${theme}`);
    await goto("/together");
    await shot(`theme-${theme}-together`);
    await goto("/settings");
    await shot(`theme-${theme}-settings`);
  }
  await click("button[name=theme][value=auto]");
  await waitFor(`!document.documentElement.dataset.theme`, 15000);

  for (const [index, photo] of RECEIPTS.entries()) {
    step(`scan receipt ${index + 1}`);
    await goto("/scan");
    const { root } = await send("DOM.getDocument");
    const { nodeId } = await send("DOM.querySelector", { nodeId: root.nodeId, selector: "#receipt-photo" });
    await send("DOM.setFileInputFiles", { nodeId, files: [photo] });
    await waitFor(`document.body.innerText.includes("Jak zapisać")`, 90000);
    const read = await evaluate(`[...document.querySelectorAll("main li")].filter((li) => li.querySelector("input[aria-label='Ilość']")).map((li) =>
      li.querySelector("input").value + " -> " + li.querySelector("input[aria-label^='Produkt']").value + " " +
      li.querySelector("input[aria-label='Ilość']").value + " " + li.querySelector("select[aria-label='Jednostka']").value).join(" | ")`);
    console.log(`    ${read.replaceAll(" | ", "\n    ")}`);
    await shot(`scan-review-${index + 1}`);
    await clickText("Zapisz");
    await waitFor(`location.pathname === "/expenses"`, 30000);
    // The app lands on the month of the receipt date
    if (index === 0) receiptList = await evaluate("location.pathname + location.search");
  }

  if (RECEIPTS.length > 1) {
    step("product statistics");
    await goto("/products?period=year");
    await waitFor(`document.body.innerText.toLowerCase().includes("marchew")`);
    const rows = await evaluate(`[...document.querySelectorAll("tbody tr")].map((tr) => tr.innerText.replace(/\\s+/g, " ")).join(" | ")`);
    console.log(`    ${rows.replaceAll(" | ", "\n    ")}`);
    await shot("products");
    await click("tbody a");
    await waitFor(`location.pathname.startsWith("/products/")`);
    await wait(500);
    await shot("product-detail");
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
