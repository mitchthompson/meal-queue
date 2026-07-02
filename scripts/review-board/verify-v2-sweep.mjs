// V2 token-sweep part 1 verification. Local stack only.
// Drives Settings / Recipes list / editor takeover / recipe detail at 390px,
// asserts the swapped computed styles, screenshots each screen.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const pw = require_("/Users/mitchell/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");

const BASE = "http://localhost:3123";
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "shots-v2");
const SEED = path.join(path.dirname(new URL(import.meta.url).pathname), "seed-review.sql");
const PSQL = "/opt/homebrew/opt/libpq/bin/psql";
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
fs.mkdirSync(OUT, { recursive: true });

// token set v2 expected computed values
const V2 = {
  surface: "rgb(255, 255, 255)",
  line: "rgb(228, 230, 225)",
  muted: "rgb(94, 107, 103)",
  accent: "rgb(232, 161, 61)",
  accentSoft: "rgb(246, 232, 207)",
  accentDeep: "rgb(122, 90, 23)",
};
// retired values that must not appear anywhere we look
const OLD = ["rgb(228, 216, 198)", "rgba(255, 253, 248", "rgb(201, 187, 166)", "rgb(255, 254, 251)", "rgb(61, 68, 61)", "rgb(243, 234, 220)", "rgb(94, 81, 61)"];

const results = [];
const consoleErrors = [];
const prodHits = [];

function check(name, actual, expected) {
  const pass = actual === expected;
  results.push({ name, actual, expected, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${actual}${pass ? "" : ` (expected ${expected})`}`);
}

async function style(page, sel, prop) {
  return page.locator(sel).first().evaluate((el, p) => getComputedStyle(el)[p], prop);
}

async function launch() {
  try { return await pw.chromium.launch({ headless: true }); }
  catch { return await pw.chromium.launch({ headless: true, channel: "chrome" }); }
}

const run = async () => {
  const browser = await launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  // failsafe: nothing may leave for prod supabase
  await ctx.route(/supabase\.co/, (route) => { prodHits.push(route.request().url()); route.abort(); });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  const hideDevBadge = () => page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

  // ---- auth (sign-up, fall back to sign-in) ----
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const authVisible = await page.locator('input[type="email"]').count();
  if (authVisible) {
    // sign-in first (stack retains the round-1 reviewer); fall back to sign-up
    await page.locator('input[type="email"]').fill("reviewer@local.test");
    await page.locator('input[type="password"]').fill("review-pass-1234");
    await page.locator("button.primary-btn").click();
    try {
      await page.waitForSelector(".today-head, .tonight-card, .tonight-card-empty", { timeout: 8000 });
    } catch {
      await page.getByText("Need an account? Create one").click();
      await page.locator('input[type="email"]').fill("reviewer@local.test");
      await page.locator('input[type="password"]').fill("review-pass-1234");
      await page.locator("button.primary-btn").click();
      await page.waitForSelector(".today-head, .tonight-card, .tonight-card-empty", { timeout: 15000 });
    }
  }
  await page.waitForTimeout(800);

  // ---- seed (idempotent) + recipe id ----
  execSync(`${PSQL} "${LOCAL_DB}" -v ON_ERROR_STOP=1 -f "${SEED}"`, { stdio: "inherit" });
  const recipeId = execSync(`${PSQL} "${LOCAL_DB}" -t -A -c "select id from public.recipes where name='Lemon Chicken Thighs' limit 1"`).toString().trim();
  if (!recipeId) throw new Error("seed recipe not found");

  // ---- Settings ----
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("section.panel", { timeout: 15000 });
  await page.waitForTimeout(900);
  await hideDevBadge();
  check("settings .panel bg (was translucent cream)", await style(page, "section.panel", "backgroundColor"), V2.surface);
  check("settings .panel border (was #e4d8c6)", await style(page, "section.panel", "borderTopColor"), V2.line);
  check("settings .panel radius unchanged", await style(page, "section.panel", "borderRadius"), "12px");
  check("settings .panel shadow kept", (await style(page, "section.panel", "boxShadow")).includes("rgba(31, 35, 31, 0.04)") ? "kept" : "missing", "kept");
  check("settings input bg", await style(page, "section.panel input", "backgroundColor"), V2.surface);
  check("settings .primary-btn text", await style(page, ".primary-btn", "color"), V2.surface);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUT, "settings.jpg"), type: "jpeg", quality: 85 });

  // ---- Recipes list ----
  await page.goto(`${BASE}/recipes`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".list-item", { timeout: 15000 });
  await page.waitForTimeout(900);
  await hideDevBadge();
  check("recipes aside.panel bg", await style(page, "aside.panel", "backgroundColor"), V2.surface);
  check("recipes aside.panel border", await style(page, "aside.panel", "borderTopColor"), V2.line);
  check("recipes .list-item bg (was #fff literal)", await style(page, ".list-item", "backgroundColor"), V2.surface);
  await page.screenshot({ path: path.join(OUT, "recipes-list.jpg"), type: "jpeg", quality: 85 });

  // ---- Editor takeover ----
  await page.locator(".list-item .text-btn", { hasText: "Edit" }).first().click();
  await page.waitForSelector(".recipes-layout.editor-open", { timeout: 8000 });
  await page.waitForTimeout(600);
  check("editor takeover: list hidden on mobile", await style(page, "aside.panel", "display"), "none");
  check("editor section.panel bg", await style(page, ".recipes-layout.editor-open section.panel", "backgroundColor"), V2.surface);
  check("editor input bg (was #ffffff literal)", await style(page, ".recipes-layout.editor-open input", "backgroundColor"), V2.surface);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "recipes-editor.jpg"), type: "jpeg", quality: 85 });

  // ---- Recipe detail ----
  await page.goto(`${BASE}/recipes/${recipeId}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".recipe-view-section", { timeout: 15000 });
  await page.waitForTimeout(900);
  await hideDevBadge();
  check("detail .recipe-view-section border (was #c9bba6)", await style(page, ".recipe-view-section", "borderTopColor"), V2.line);
  check("detail .recipe-meta bg (was #fffefb)", await style(page, ".recipe-meta", "backgroundColor"), V2.surface);
  check("detail .recipe-meta span color (was #3d443d)", await style(page, ".recipe-meta span", "color"), V2.muted);
  check("detail .pantry-badge border (was #c9bba6)", await style(page, ".pantry-badge", "borderTopColor"), V2.accent);
  check("detail .pantry-badge bg (was #f3eadc)", await style(page, ".pantry-badge", "backgroundColor"), V2.accentSoft);
  // pre-existing cascade quirk: .recipe-meta span (0-1-1) beats .pantry-badge
  // (0-1-0), so the badge's own color is overridden here — before the sweep it
  // rendered #3d443d, now var(--muted). Mechanical parity; resolve in part 2.
  check("detail .pantry-badge text (cascade: .recipe-meta span wins, as pre-sweep)", await style(page, ".pantry-badge", "color"), V2.muted);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUT, "recipe-detail-top.jpg"), type: "jpeg", quality: 85 });
  const steps = page.locator(".recipe-step-item").first();
  if (await steps.count()) {
    check("detail .recipe-step-item bg (was #fffefb)", await style(page, ".recipe-step-item", "backgroundColor"), V2.surface);
    await steps.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, "recipe-detail-steps.jpg"), type: "jpeg", quality: 85 });
  }

  // ---- retired-value scan across all four screens' full DOM ----
  for (const [label, url] of [["settings", `${BASE}/settings`], ["recipes", `${BASE}/recipes`], ["detail", `${BASE}/recipes/${recipeId}`]]) {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".panel", { timeout: 15000 });
    await page.waitForTimeout(700);
    const found = await page.evaluate((oldVals) => {
      const hits = [];
      for (const el of document.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        for (const prop of ["backgroundColor", "color", "borderTopColor", "borderBottomColor", "borderLeftColor", "borderRightColor"]) {
          const v = cs[prop];
          if (oldVals.some((o) => v.startsWith(o))) hits.push(`${el.className || el.tagName} ${prop}=${v}`);
        }
      }
      return hits.slice(0, 10);
    }, OLD);
    check(`retired palette values on ${label}`, found.length === 0 ? "none" : found.join("; "), "none");
  }

  await browser.close();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== ${results.length - failed.length}/${results.length} assertions passed, ${consoleErrors.length} console errors, ${prodHits.length} prod hits (blocked) ===`);
  if (consoleErrors.length) console.log("CONSOLE:", consoleErrors.join("\n"));
  if (prodHits.length) console.log("PROD HITS:", prodHits.join("\n"));
  if (failed.length || consoleErrors.length || prodHits.length) process.exitCode = 1;
};

run().catch((e) => { console.error("VERIFY FAILED:", e); process.exitCode = 1; });
