// Settings v2 pass verification: layout assertions + a real save round-trip
// + as-built shots (390px phone and 1280 desktop). Local stack only.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const pw = require_("/Users/mitchell/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");

const BASE = "http://localhost:3123";
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "shots-v2");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const consoleErrors = [];
function check(name, actual, expected) {
  const pass = actual === expected;
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${actual}${pass ? "" : ` (expected ${expected})`}`);
}

const run = async () => {
  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  await ctx.route(/supabase\.co/, (route) => route.abort());
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  if (await page.locator('input[type="email"]').count()) {
    await page.locator('input[type="email"]').fill("reviewer@local.test");
    await page.locator('input[type="password"]').fill("review-pass-1234");
    await page.locator("button.primary-btn").click();
    await page.waitForSelector(".today-head, .tonight-card, .tonight-card-empty", { timeout: 15000 });
  }

  // ---- layout assertions at 390px ----
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".settings-row", { timeout: 15000 });
  await page.waitForTimeout(900);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

  check("page title present", await page.locator(".settings-head h1").textContent(), "Settings");
  check("card labels", (await page.locator(".settings-card-label").allTextContents()).join("|"), "Account|Planning defaults");
  check("4 setting rows", String(await page.locator(".settings-row").count()), "4");
  const rowGrid = await page.locator(".settings-row").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  check("row is 2-col grid", String(rowGrid), "2");
  const ctlH = await page.locator(".settings-row select").first().evaluate((el) => el.getBoundingClientRect().height);
  check("controls >= 44px", ctlH >= 44 ? "yes" : `no (${ctlH}px)`, "yes");
  const saveW = await page.locator(".settings-save").evaluate((el) => {
    const b = el.getBoundingClientRect(); const p = el.closest("form").getBoundingClientRect();
    return Math.abs(b.width - p.width) < 2 ? "full" : `partial (${b.width}/${p.width})`;
  });
  check("save is full-width", saveW, "full");
  const saveBg = await page.locator(".settings-save").evaluate((el) => getComputedStyle(el).backgroundColor);
  check("save is teal (--brand)", saveBg, "rgb(18, 105, 94)");
  const signoutH = await page.locator(".settings-signout").evaluate((el) => el.getBoundingClientRect().height);
  check("sign-out >= 44px", signoutH >= 44 ? "yes" : `no (${signoutH}px)`, "yes");
  const colW = await page.locator(".page-col").evaluate((el) => getComputedStyle(el).maxWidth);
  check("page-col cap", colW, "640px");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUT, "AB-settings.jpg"), type: "jpeg", quality: 85 });

  // ---- functional round-trip: change plan length 7 -> 9, save, reload, revert ----
  const planLen = page.locator(".settings-row input[type=number]");
  const before = await planLen.inputValue();
  await planLen.fill("9");
  await page.locator(".settings-save").click();
  await page.waitForSelector("text=Settings saved.", { timeout: 10000 });
  check("save confirms", "Settings saved.", "Settings saved.");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".settings-row input[type=number]", { timeout: 15000 });
  await page.waitForTimeout(600);
  check("value persists after reload", await planLen.inputValue(), "9");
  await planLen.fill(before);
  await page.locator(".settings-save").click();
  await page.waitForSelector("text=Settings saved.", { timeout: 10000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".settings-row input[type=number]", { timeout: 15000 });
  await page.waitForTimeout(600);
  check("reverted to original", await planLen.inputValue(), before);

  await ctx.close();

  // ---- desktop sanity shot ----
  const desk = await browser.newContext({ viewport: { width: 1280, height: 832 }, deviceScaleFactor: 2 });
  const dpage = await desk.newPage();
  dpage.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  await dpage.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await dpage.waitForTimeout(1200);
  if (await dpage.locator('input[type="email"]').count()) {
    await dpage.locator('input[type="email"]').fill("reviewer@local.test");
    await dpage.locator('input[type="password"]').fill("review-pass-1234");
    await dpage.locator("button.primary-btn").click();
    await dpage.waitForSelector(".settings-row", { timeout: 15000 });
  }
  await dpage.waitForTimeout(800);
  await dpage.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  check("desktop renders rows", String(await dpage.locator(".settings-row").count()), "4");
  await dpage.screenshot({ path: path.join(OUT, "AB-settings-desktop.jpg"), type: "jpeg", quality: 85 });
  await desk.close();
  await browser.close();

  const failed = results.filter((r) => !r).length;
  console.log(`\n=== ${results.length - failed}/${results.length} passed, ${consoleErrors.length} console errors ===`);
  if (consoleErrors.length) console.log("CONSOLE:", consoleErrors.join("\n"));
  if (failed || consoleErrors.length) process.exitCode = 1;
};

run().catch((e) => { console.error("VERIFY FAILED:", e); process.exitCode = 1; });
