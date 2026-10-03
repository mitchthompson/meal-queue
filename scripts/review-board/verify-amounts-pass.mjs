// Milestone 18 Today-link verification: the cook hero's button opens the plain
// recipe page (no ?cook=1) and no cook takeover renders. AS2 = A: the button
// keeps its "Start cooking →" label. Local stack only.
// Lineage: verify-shop-pass.mjs (check(), console-error capture, sign-in with
// sign-up fallback, summary line).
//
// Writes nothing beyond the idempotent seed-review.sql seed: the browser clock
// is pinned to 2026-07-02, inside the seeded plan (2026-07-01 to 07-07), so
// Lemon Chicken Thighs is tonight's cook item. No live LLM, no prod, no teardown.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const pw = require_("/Users/mitchell/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");

const BASE = "http://localhost:3123";
const DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(DIR, "shots-amounts");
const SEED = path.join(DIR, "seed-review.sql");
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
  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  await ctx.route(/supabase\.co/, (route) => route.abort()); // never touch prod

  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-07-02T12:00:00")); // seeded plan: Lemon Chicken Thighs is tonight's cook item
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  // ---- sign in (sign-up fallback), then the idempotent seed ----
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  if (await page.locator('input[type="email"]').count()) {
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
  execSync(`${PSQL} "${LOCAL_DB}" -v ON_ERROR_STOP=1 -f "${SEED}"`, { stdio: "inherit" });
  const recipeId = execSync(`${PSQL} "${LOCAL_DB}" -t -A -c "select id from public.recipes where name='Lemon Chicken Thighs' limit 1"`).toString().trim();
  if (!recipeId) throw new Error("Lemon Chicken Thighs is missing after the seed (the seed skips when the reviewer already has a plan)");
  // Let the sign-in page's in-flight requests settle before reloading, or the
  // aborted settings POST logs a harness-only "Failed to fetch".
  await page.waitForTimeout(1200);

  // ---- Today: the cook hero and its button ----
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".tonight-btn", { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});

  check("hero names the recipe", (await page.locator(".tonight-card h2").textContent())?.trim(), "Lemon Chicken Thighs");
  check("cook button opens the recipe page (M18)", await page.locator(".tonight-btn").getAttribute("href"), `/recipes/${recipeId}`);
  check("cook button label (AS2)", (await page.locator(".tonight-btn").textContent())?.trim(), "Start cooking →");
  await page.screenshot({ path: path.join(OUT, "AB-today.jpg"), type: "jpeg", quality: 85 });

  // ---- tap it: plain recipe page, no takeover ----
  await page.locator(".tonight-btn").click();
  await page.waitForSelector(".recipe-step-list", { timeout: 15000 });
  await page.waitForTimeout(1500);
  const landed = new URL(page.url());
  check("lands on the plain recipe page", `${landed.pathname}${landed.search}`, `/recipes/${recipeId}`);
  const cookNodes = await page.evaluate(() => document.querySelectorAll('[class*="cook"]').length);
  check("no cook takeover", String(cookNodes), "0");

  // Let in-flight requests settle before the context closes.
  await page.waitForTimeout(1200);
  await ctx.close();
  await browser.close();

  const failed = results.filter((r) => !r).length;
  console.log(`\n=== ${results.length - failed}/${results.length} passed, ${consoleErrors.length} console errors ===`);
  if (consoleErrors.length) console.log("CONSOLE:", consoleErrors.join("\n"));
  if (failed || consoleErrors.length) process.exitCode = 1;
};

run().catch((e) => { console.error("VERIFY FAILED:", e); process.exitCode = 1; });
