// Recipes v2 pass verification: layout assertions (list + editor) + a real
// save_recipe round-trip + as-built shots (390px phone and 1280 desktop).
// Local stack only. Template lineage: verify-settings-pass.mjs (round 2).
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

  // ---- list assertions at 390px (RC1: A, RC2, RC3) ----
  await page.goto(`${BASE}/recipes`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".list-item", { timeout: 15000 });
  await page.waitForTimeout(900);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

  check("page title present", await page.locator(".recipes-head h1").textContent(), "Recipes");
  const label = await page.locator(".recipes-card-label").first().evaluate((el) => `${el.textContent}|${getComputedStyle(el).textTransform}`);
  check("card label uppercase", label, "Your recipes|uppercase");
  check("sample-data button removed (RC3)", String(await page.locator("text=Load sample data").count()), "0");
  check("serves line removed (RC1)", String(await page.locator(".list-item span").count()), "0");
  const cardBorder = await page.locator(".list-item").first().evaluate((el) => getComputedStyle(el).borderTopWidth);
  check("list items stay cards (RC1: A)", cardBorder, "1px");
  const viewLink = await page.locator(".list-item .section-actions a").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.color}|${s.textDecorationLine}|${el.getBoundingClientRect().height >= 44 ? ">=44" : "small"}`;
  });
  check("View link teal, no underline, 44px (RC2)", viewLink, "rgb(18, 105, 94)|none|>=44");
  const editH = await page.locator(".list-item .text-btn").first().evaluate((el) => el.getBoundingClientRect().height);
  check("Edit target >= 44px", editH >= 44 ? "yes" : `no (${editH}px)`, "yes");
  const searchH = await page.locator(".recipes-list-controls input").evaluate((el) => el.getBoundingClientRect().height);
  check("search >= 44px", searchH >= 44 ? "yes" : `no (${searchH}px)`, "yes");
  const sortH = await page.locator(".recipes-list-controls select").evaluate((el) => el.getBoundingClientRect().height);
  check("sort >= 44px", sortH >= 44 ? "yes" : `no (${sortH}px)`, "yes");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUT, "AB-recipes-list.jpg"), type: "jpeg", quality: 85 });

  // ---- editor assertions at 390px (RC4: A, RC5) ----
  await page.locator(".list-item .text-btn").first().click();
  await page.waitForSelector("form.stack .ingredient-row", { timeout: 15000 });
  await page.waitForTimeout(800);

  check("page head hidden in takeover", await page.locator(".recipes-head").evaluate((el) => getComputedStyle(el).display), "none");
  const title = await page.locator(".recipes-editor-title").evaluate((el) => `${el.textContent}|${getComputedStyle(el).fontSize}`);
  check("editor title in head language", title, "Edit recipe|24px");
  const labels = await page.locator("form.stack .recipes-card-label").allTextContents();
  check("editor section labels", labels.join("|"), "Ingredients|Steps|Tags");
  const nameStacked = await page.locator("form.stack > label").first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  check("name field stacked, not 2-col (RC4: A)", String(nameStacked), "1");
  const nameH = await page.locator("form.stack > label input").first().evaluate((el) => el.getBoundingClientRect().height);
  check("editor inputs >= 44px", nameH >= 44 ? "yes" : `no (${nameH}px)`, "yes");
  const addIngH = await page.locator("form.stack .secondary-btn").first().evaluate((el) => el.getBoundingClientRect().height);
  check("Add ingredient >= 44px", addIngH >= 44 ? "yes" : `no (${addIngH}px)`, "yes");
  const saveW = await page.locator(".recipes-save").evaluate((el) => {
    const b = el.getBoundingClientRect(); const p = el.closest("form").getBoundingClientRect();
    return Math.abs(b.width - p.width) < 2 ? "full" : `partial (${b.width}/${p.width})`;
  });
  check("save is full-width (RC5)", saveW, "full");
  const saveBg = await page.locator(".recipes-save").evaluate((el) => getComputedStyle(el).backgroundColor);
  check("save is teal (--brand)", saveBg, "rgb(18, 105, 94)");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUT, "AB-recipes-editor.jpg"), type: "jpeg", quality: 85 });
  await page.evaluate(() => document.querySelector(".recipes-save").scrollIntoView({ block: "center" }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "AB-recipes-editor-save.jpg"), type: "jpeg", quality: 85 });

  // ---- functional round-trip: bump base servings, save, reload, revert ----
  const servings = page.locator('form.stack > label input[type="number"]');
  const before = await servings.inputValue();
  const bumped = String(Number(before) + 1);
  await servings.fill(bumped);
  await page.locator(".recipes-save").click();
  await page.waitForSelector("text=Recipe saved.", { timeout: 10000 });
  check("save confirms", "Recipe saved.", "Recipe saved.");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".list-item", { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.locator(".list-item .text-btn").first().click();
  await page.waitForSelector("form.stack .ingredient-row", { timeout: 15000 });
  await page.waitForTimeout(600);
  check("value persists after reload", await servings.inputValue(), bumped);
  await servings.fill(before);
  await page.locator(".recipes-save").click();
  await page.waitForSelector("text=Recipe saved.", { timeout: 10000 });
  await page.waitForTimeout(600);
  check("reverted to original", await servings.inputValue(), before);

  await ctx.close();

  // ---- desktop sanity shot (split layout intact) ----
  const desk = await browser.newContext({ viewport: { width: 1280, height: 832 }, deviceScaleFactor: 2 });
  const dpage = await desk.newPage();
  dpage.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  await dpage.goto(`${BASE}/recipes`, { waitUntil: "domcontentloaded" });
  await dpage.waitForTimeout(1200);
  if (await dpage.locator('input[type="email"]').count()) {
    await dpage.locator('input[type="email"]').fill("reviewer@local.test");
    await dpage.locator('input[type="password"]').fill("review-pass-1234");
    await dpage.locator("button.primary-btn").click();
    await dpage.waitForSelector(".list-item", { timeout: 15000 });
  }
  await dpage.waitForTimeout(800);
  await dpage.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await dpage.locator(".list-item .text-btn").first().click();
  await dpage.waitForSelector("form.stack .ingredient-row", { timeout: 15000 });
  await dpage.waitForTimeout(600);
  const deskCols = await dpage.locator(".split-layout").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  check("desktop split layout intact", String(deskCols), "2");
  check("desktop keeps page head", await dpage.locator(".recipes-head h1").isVisible() ? "visible" : "hidden", "visible");
  await dpage.screenshot({ path: path.join(OUT, "AB-recipes-desktop.jpg"), type: "jpeg", quality: 85 });
  await desk.close();
  await browser.close();

  const failed = results.filter((r) => !r).length;
  console.log(`\n=== ${results.length - failed}/${results.length} passed, ${consoleErrors.length} console errors ===`);
  if (consoleErrors.length) console.log("CONSOLE:", consoleErrors.join("\n"));
  if (failed || consoleErrors.length) process.exitCode = 1;
};

run().catch((e) => { console.error("VERIFY FAILED:", e); process.exitCode = 1; });
