// Recipe import (Phase C) verification: drives the import flow at 390px with
// the /api/import-recipe route INTERCEPTED by fixtures (no live LLM spend), and
// saves the parsed draft through the real save_recipe RPC on the LOCAL stack.
// Covers: entry (mode pills) -> parsing -> review (parsed/original toggle) ->
// save round-trip landing on /recipes/<id>, plus the 422 red-error and the
// paywall amber-redirect paths. Local stack only. Lineage: verify-recipes-pass.mjs.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const pw = require_("/Users/mitchell/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");

const BASE = "http://localhost:3123";
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "shots-import");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const consoleErrors = [];
function check(name, actual, expected) {
  const pass = actual === expected;
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${actual}${pass ? "" : ` (expected ${expected})`}`);
}

// ---- fixtures returned by the intercepted /api/import-recipe route ----
const SUCCESS_FIXTURE = {
  draft: {
    name: "Import Verify Pancakes",
    base_servings: 4,
    instructions_raw: "Mix everything. Fry in butter.",
    tags: ["breakfast"],
    ingredients: [
      { name: "flour", amount: 2, unit_code: "cup", is_pantry_staple: false },
      { name: "salt", amount: 0, unit_code: "item", is_pantry_staple: true },
    ],
    steps: ["Mix everything.", "Fry in butter."],
  },
  original_text: "Pancakes\nServes 4\n2 cups flour\nsalt to taste\nMix everything. Fry in butter.",
  meta: { source: "paste", extraction: "text", model: "claude-haiku-4-5-20251001", input_tokens: 100, output_tokens: 80 },
};
const PAYWALL_FIXTURE = {
  status: 422,
  body: { error: { code: "paywall_or_blocked", message: "That site blocked the request (likely a paywall). Copy the recipe text from the page and paste it instead." } },
};
const NO_RECIPE_FIXTURE = {
  status: 422,
  body: { error: { code: "no_recipe_found", message: "Couldn't find a recipe in that content. Try pasting just the recipe text." } },
};

// The route handler resolves whatever the current phase set; a small delay lets
// the parsing state paint so it can be asserted.
let fixture = { status: 200, body: SUCCESS_FIXTURE, delay: 0 };

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
  await ctx.route(/\/api\/import-recipe/, async (route) => {
    if (fixture.delay) await new Promise((r) => setTimeout(r, fixture.delay));
    await route.fulfill({ status: fixture.status, contentType: "application/json", body: JSON.stringify(fixture.body) });
  });
  // The 422 no_recipe / paywall fixtures deliberately return error responses;
  // the browser logs those as failed resource loads. Those are exercised error
  // paths, not app faults — ignore them, keep every other console error.
  const isExpectedFixtureError = (text) => /Failed to load resource/.test(text) && /422/.test(text);
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !isExpectedFixtureError(m.text())) consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  if (await page.locator('input[type="email"]').count()) {
    await page.locator('input[type="email"]').fill("reviewer@local.test");
    await page.locator('input[type="password"]').fill("review-pass-1234");
    await page.locator("button.primary-btn").click();
    await page.waitForSelector(".today-head, .tonight-card, .tonight-card-empty", { timeout: 15000 });
  }

  // ---- entry via ?import=1 deep link (IM7 button also exists on /recipes) ----
  await page.goto(`${BASE}/recipes?import=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".import-panel", { timeout: 15000 });
  await page.waitForTimeout(700);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

  check("import title present", await page.locator(".import-panel .recipes-editor-title").textContent(), "Import recipe");
  check("mode pills present (IM1: B)", String(await page.locator(".import-modes .pill").count()), "2");
  check("paste is default mode", await page.locator(".import-modes .pill.active").textContent(), "Paste text");
  check("paste textarea shown", String(await page.locator(".import-textarea").count()), "1");
  const submitBg = await page.locator(".import-submit").evaluate((el) => getComputedStyle(el).backgroundColor);
  check("submit is teal (--brand)", submitBg, "rgb(18, 105, 94)");
  const submitDisabled = await page.locator(".import-submit").evaluate((el) => el.disabled);
  check("submit disabled while empty", submitDisabled ? "yes" : "no", "yes");
  await page.screenshot({ path: path.join(OUT, "AB-import-entry.jpg"), type: "jpeg", quality: 85 });

  // ---- 422 no_recipe -> red status ----
  fixture = { status: NO_RECIPE_FIXTURE.status, body: NO_RECIPE_FIXTURE.body, delay: 0 };
  await page.locator(".import-textarea").fill("the weather is nice today");
  await page.locator(".import-submit").click();
  await page.waitForSelector(".import-panel .error-text", { timeout: 10000 });
  check("422 shows red error", (await page.locator(".import-panel .error-text").textContent())?.slice(0, 16), "Couldn't find a ");
  check("no amber callout on 422", String(await page.locator(".import-callout").count()), "0");

  // ---- paywall -> amber redirect + focus to textarea ----
  fixture = { status: PAYWALL_FIXTURE.status, body: PAYWALL_FIXTURE.body, delay: 0 };
  await page.locator(".import-modes .pill", { hasText: "Link" }).click();
  await page.locator('input[type="url"]').fill("https://cooking.nytimes.com/recipes/123");
  await page.locator(".import-submit").click();
  await page.waitForSelector(".import-callout", { timeout: 10000 });
  check("paywall shows amber callout (IM3: A)", String(await page.locator(".import-callout").count()), "1");
  const calloutBg = await page.locator(".import-callout").evaluate((el) => getComputedStyle(el).backgroundColor);
  check("callout is amber-soft", calloutBg, "rgb(246, 232, 207)");
  check("mode flipped to paste", await page.locator(".import-modes .pill.active").textContent(), "Paste text");
  const focused = await page.evaluate(() => document.activeElement?.classList.contains("import-textarea"));
  check("focus moved to textarea", focused ? "yes" : "no", "yes");
  await page.screenshot({ path: path.join(OUT, "AB-import-paywall.jpg"), type: "jpeg", quality: 85 });

  // ---- happy path: paste -> parsing -> review ----
  fixture = { status: 200, body: SUCCESS_FIXTURE, delay: 700 };
  await page.locator(".import-textarea").fill("Pancakes. Serves 4. 2 cups flour, salt to taste. Mix. Fry.");
  await page.locator(".import-submit").click();
  // parsing state paints during the fixture delay
  await page.waitForSelector(".import-progress", { timeout: 5000 });
  check("parsing bar visible (IM2)", String(await page.locator(".import-progress").count()), "1");
  check("submit relabelled while parsing", await page.locator(".import-submit").textContent(), "Reading recipe…");
  await page.screenshot({ path: path.join(OUT, "AB-import-parsing.jpg"), type: "jpeg", quality: 85 });

  await page.waitForSelector(".import-panel .ingredient-row", { timeout: 15000 });
  await page.waitForTimeout(400);
  check("review title present", await page.locator(".import-panel .recipes-editor-title").textContent(), "Review recipe");
  check("draft name mapped", await page.locator(".import-panel label input").first().inputValue(), "Import Verify Pancakes");
  check("ingredient rows mapped", String(await page.locator(".import-panel .ingredient-row").count()), "2");
  check("step rows mapped", String(await page.locator(".import-panel .step-row").count()), "2");
  check("parsed tag chip rendered", await page.locator(".import-panel .chip.active").first().textContent(), "breakfast x");
  check("toggle pills present (IM4: B)", String(await page.locator(".import-modes .pill").count()), "2");
  await page.screenshot({ path: path.join(OUT, "AB-import-review.jpg"), type: "jpeg", quality: 85 });

  // Original toggle shows the verbatim text, Parsed returns to the form.
  await page.locator(".import-modes .pill", { hasText: "Original" }).click();
  await page.waitForSelector(".import-original", { timeout: 5000 });
  check("original text shown", (await page.locator(".import-original").textContent())?.startsWith("Pancakes"), true);
  await page.locator(".import-modes .pill", { hasText: "Parsed" }).click();
  await page.waitForSelector(".import-panel .ingredient-row", { timeout: 5000 });
  check("parsed form returns", String(await page.locator(".import-panel .ingredient-row").count()), "2");

  // ---- save round-trip through the real save_recipe RPC (local stack) ----
  await page.locator(".import-submit", { hasText: "Save recipe" }).click();
  await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15000 });
  check("landed on recipe detail", /\/recipes\/[0-9a-f-]{36}$/.test(page.url()) ? "yes" : `no (${page.url()})`, "yes");
  await page.waitForSelector(".recipe-title-row h1, .recipe-title, h1", { timeout: 15000 });
  await page.waitForTimeout(500);
  const detailName = await page.locator("h1").first().textContent();
  check("saved recipe name on detail", detailName?.includes("Import Verify Pancakes") ? "yes" : `no (${detailName})`, "yes");
  await page.screenshot({ path: path.join(OUT, "AB-import-saved-detail.jpg"), type: "jpeg", quality: 85 });

  await ctx.close();

  // ---- desktop sanity: import panel sits beside the list (split layout) ----
  const desk = await browser.newContext({ viewport: { width: 1280, height: 832 }, deviceScaleFactor: 2 });
  await desk.route(/\/api\/import-recipe/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SUCCESS_FIXTURE) }),
  );
  const dpage = await desk.newPage();
  dpage.on("console", (m) => { if (m.type() === "error" && !isExpectedFixtureError(m.text())) consoleErrors.push(m.text()); });
  await dpage.goto(`${BASE}/recipes`, { waitUntil: "domcontentloaded" });
  await dpage.waitForTimeout(1200);
  if (await dpage.locator('input[type="email"]').count()) {
    await dpage.locator('input[type="email"]').fill("reviewer@local.test");
    await dpage.locator('input[type="password"]').fill("review-pass-1234");
    await dpage.locator("button.primary-btn").click();
    await dpage.waitForSelector(".list-item", { timeout: 15000 });
  }
  await dpage.waitForTimeout(600);
  await dpage.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await dpage.locator(".section-actions .secondary-btn", { hasText: "Import" }).click();
  await dpage.waitForSelector(".import-panel", { timeout: 15000 });
  await dpage.waitForTimeout(400);
  const deskCols = await dpage.locator(".recipes-layout.import-open").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  check("desktop import keeps split layout", String(deskCols), "2");
  check("desktop keeps list panel", await dpage.locator("aside.panel").isVisible() ? "visible" : "hidden", "visible");
  await dpage.screenshot({ path: path.join(OUT, "AB-import-desktop.jpg"), type: "jpeg", quality: 85 });
  await desk.close();
  await browser.close();

  const failed = results.filter((r) => !r).length;
  console.log(`\n=== ${results.length - failed}/${results.length} passed, ${consoleErrors.length} console errors ===`);
  if (consoleErrors.length) console.log("CONSOLE:", consoleErrors.join("\n"));
  if (failed || consoleErrors.length) process.exitCode = 1;
};

run().catch((e) => { console.error("VERIFY FAILED:", e); process.exitCode = 1; });
