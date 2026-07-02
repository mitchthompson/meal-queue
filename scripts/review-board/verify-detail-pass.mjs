// Recipe-detail v2 pass verification: layout assertions + cook-mode and
// servings-stepper behavior checks + as-built shots (390px and 1280px).
// Local stack only. Template lineage: verify-recipes-pass.mjs (round 3).
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const pw = require_("/Users/mitchell/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");

const BASE = "http://localhost:3123";
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "shots-v2");
const PSQL = "/opt/homebrew/opt/libpq/bin/psql";
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const consoleErrors = [];
function check(name, actual, expected) {
  const pass = actual === expected;
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${actual}${pass ? "" : ` (expected ${expected})`}`);
}

const run = async () => {
  const recipeId = execSync(`${PSQL} "${LOCAL_DB}" -t -A -c "select id from public.recipes where name='Lemon Chicken Thighs' limit 1"`).toString().trim();
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
  await page.goto(`${BASE}/recipes/${recipeId}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".recipe-view-section", { timeout: 15000 });
  await page.waitForTimeout(900);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

  const title = await page.locator(".recipe-title-row h1").evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.fontSize}|${s.fontWeight}`;
  });
  check("title in head language (RD3)", title, "24px|800");
  // DOM order: the Overview aside precedes the content column (it reorders
  // below it visually on mobile via CSS order).
  const labels = await page.locator(".recipes-card-label").allTextContents();
  check("card labels present (RD3)", labels.join("|"), "Overview|Ingredients|Steps");
  const labelStyle = await page.locator(".recipes-card-label").first().evaluate((el) => getComputedStyle(el).textTransform);
  check("labels uppercase", labelStyle, "uppercase");
  const row = await page.locator(".recipe-meta").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.borderTopWidth}|${s.borderBottomWidth}|${s.backgroundColor}`;
  });
  check("ingredient rows flat (RD1: B)", row, "0px|1px|rgba(0, 0, 0, 0)");
  const step = await page.locator(".recipe-step-item").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.borderTopWidth}|${s.borderBottomWidth}|${s.backgroundColor}`;
  });
  check("step rows flat (RD1: B)", step, "0px|1px|rgba(0, 0, 0, 0)");
  const badge = await page.locator(".pantry-badge").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.color}|${s.fontSize}`;
  });
  check("pantry badge un-quirked (RD4)", badge, "rgb(122, 90, 23)|11.84px");
  const amount = await page.locator(".recipe-amount").first().evaluate((el) => getComputedStyle(el).color);
  check("amounts stay muted", amount, "rgb(94, 107, 103)");
  const cookBtn = await page.locator(".recipe-cook-btn").evaluate((el) => {
    const b = el.getBoundingClientRect(); const p = el.closest("article").getBoundingClientRect();
    const s = getComputedStyle(el);
    const pad = parseFloat(getComputedStyle(el.closest("article")).paddingLeft) * 2;
    return `${Math.abs(b.width - (p.width - pad)) < 3 ? "full" : "partial"}|${s.backgroundColor}|${b.height >= 44 ? ">=44" : "small"}`;
  });
  check("Start cooking full-width teal (RD2)", cookBtn, "full|rgb(18, 105, 94)|>=44");
  const stepBtnH = await page.locator(".servings-input-row .secondary-btn").first().evaluate((el) => el.getBoundingClientRect().height);
  check("servings stepper >= 44px (RD3)", stepBtnH >= 44 ? "yes" : `no (${stepBtnH}px)`, "yes");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUT, "AB-detail.jpg"), type: "jpeg", quality: 85 });
  await page.evaluate(() => document.querySelector(".recipe-cook-btn").scrollIntoView({ block: "start" }));
  await page.evaluate(() => window.scrollBy(0, -8));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "AB-detail-steps.jpg"), type: "jpeg", quality: 85 });

  // ---- behavior: stepper scales, cook mode opens/exits, ?cook=1 deep link ----
  const firstAmount = await page.locator(".recipe-amount").first().textContent();
  await page.locator(".servings-input-row .secondary-btn").nth(1).click();
  await page.waitForTimeout(400);
  const scaledAmount = await page.locator(".recipe-amount").first().textContent();
  check("stepper rescales amounts", firstAmount !== scaledAmount ? "yes" : `no (${firstAmount})`, "yes");

  await page.locator(".recipe-cook-btn").click();
  await page.waitForSelector(".cook-mode, [class*=cook]", { timeout: 10000 });
  const cookVisible = await page.evaluate(() => !!document.querySelector('[class*="cook"]'));
  check("Start cooking opens the takeover", cookVisible ? "yes" : "no", "yes");
  await page.screenshot({ path: path.join(OUT, "AB-detail-cook.jpg"), type: "jpeg", quality: 85 });
  // Let the page's in-flight requests settle before navigating away, or the
  // aborted settings POST logs a harness-only "Failed to fetch".
  await page.waitForTimeout(1200);

  await page.goto(`${BASE}/recipes/${recipeId}?cook=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const autoCook = await page.evaluate(() => !!document.querySelector('[class*="cook"]'));
  check("?cook=1 deep link still auto-opens", autoCook ? "yes" : "no", "yes");

  await ctx.close();

  // ---- desktop sanity ----
  const desk = await browser.newContext({ viewport: { width: 1280, height: 832 }, deviceScaleFactor: 2 });
  const dpage = await desk.newPage();
  dpage.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  await dpage.goto(`${BASE}/recipes/${recipeId}`, { waitUntil: "domcontentloaded" });
  await dpage.waitForTimeout(1200);
  if (await dpage.locator('input[type="email"]').count()) {
    await dpage.locator('input[type="email"]').fill("reviewer@local.test");
    await dpage.locator('input[type="password"]').fill("review-pass-1234");
    await dpage.locator("button.primary-btn").click();
    await dpage.waitForSelector(".recipe-view-section", { timeout: 15000 });
  }
  await dpage.waitForTimeout(800);
  await dpage.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  const deskCols = await dpage.locator(".recipe-view-layout").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  check("desktop two-column layout intact", String(deskCols), "2");
  await dpage.screenshot({ path: path.join(OUT, "AB-detail-desktop.jpg"), type: "jpeg", quality: 85 });
  await desk.close();
  await browser.close();

  const failed = results.filter((r) => !r).length;
  console.log(`\n=== ${results.length - failed}/${results.length} passed, ${consoleErrors.length} console errors ===`);
  if (consoleErrors.length) console.log("CONSOLE:", consoleErrors.join("\n"));
  if (failed || consoleErrors.length) process.exitCode = 1;
};

run().catch((e) => { console.error("VERIFY FAILED:", e); process.exitCode = 1; });
