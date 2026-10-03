// Milestone 18 board captures: AS1 (steps note, quiet line vs amber callout)
// and AS2 (Today's cook button label). Every shot is the UNMODIFIED app plus
// CSS/DOM injection, so this script imports nothing from the app source and
// works against any checkout's dev server on port 3123 (local stack only).
// Output: shots-amounts/ (gitignored by the shots*/ rule).
// Lineage: capture-detail-variants.mjs (head) and verify-shop-pass.mjs (sign-in
// with sign-up fallback).
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

// The Next dev-tools badge floats over the page in every shot.
const HIDE_DEV_BADGE_CSS = "nextjs-portal{display:none!important}";

// End-state mocks (AS1-base, AS1-A, AS1-B): the retired cook button is hidden.
// The fixed phone tab bar is hidden too, because in a fullPage capture it would
// float mid-image instead of sitting at the bottom of a screen.
const END_STATE_CSS = ".recipe-cook-btn{display:none!important}.mobile-tabbar{display:none!important}";

// Lemon Chicken Thighs steps as they read after the backfill (base servings 2).
const BACKFILLED_STEPS = [
  "Pat the chicken thighs (1 1/2 lb) dry and season all over with 1 tsp salt.",
  "Sear the chicken thighs skin-side down in 2 tbsp olive oil until golden, about 6 minutes.",
  "Add the garlic (4 cloves), squeeze in the lemon (2), and scrape up the browned bits.",
  "Roast 15 minutes, rest 5, then serve.",
];
const NOTE_TEXT = "Amounts in the steps are for 2 servings.";

// The two AS1 looks, verbatim from the spec's Phase 3 blocks.
const NOTE_CSS_A = `
/* Milestone 18 (AS1: A): shown at the top of the Steps card only while
   Preview servings differs from base. Step amounts are text and do not
   scale with the stepper; this line keeps that honest. */
.recipe-steps-note {
  margin: 0.15rem 0 0.35rem;
  color: var(--muted);
  font-size: 0.85rem;
}
`;
const NOTE_CSS_B = `
/* Milestone 18 (AS1: B): shown at the top of the Steps card only while
   Preview servings differs from base. Step amounts are text and do not
   scale with the stepper; this callout keeps that honest. */
.recipe-steps-note {
  margin: 0.15rem 0 0.35rem;
  border: 1px solid var(--color-accent);
  border-radius: 12px;
  background: var(--color-accent-soft);
  color: var(--color-accent-deep);
  padding: 0.7rem 0.8rem;
  font-size: 0.9rem;
  font-weight: 600;
}
`;

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
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

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
  // Let the sign-in page's in-flight requests settle before navigating away.
  await page.waitForTimeout(1200);

  const openRecipe = async () => {
    await page.goto(`${BASE}/recipes/${recipeId}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".recipe-view-section", { timeout: 15000 });
    await page.waitForTimeout(900);
    await page.addStyleTag({ content: HIDE_DEV_BADGE_CSS }).catch(() => {});
  };

  // ---- AS1-before: the Steps card as it is today (context) ----
  const shotBefore = async () => {
    await openRecipe();
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      const card = [...document.querySelectorAll("article.recipe-view-section")].find(
        (a) => a.querySelector("h2")?.textContent.trim() === "Steps",
      );
      if (!card) throw new Error("Steps card not found");
      card.scrollIntoView({ block: "start" });
    });
    await page.evaluate(() => window.scrollBy(0, -8));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, "AS1-before.jpg"), type: "jpeg", quality: 85 });
    console.log("shot AS1-before ok");
  };

  // ---- AS1-base / AS1-A / AS1-B: end state, full page ----
  // base: servings at the recipe's own 2, no note. A and B: servings 4 plus the
  // note after the Steps card's h2, styled per variant.
  const shotEndState = async (name, noteCss) => {
    await openRecipe();
    if (noteCss) {
      await page.locator(".servings-input-row input").fill("4");
      await page.waitForTimeout(400);
    }
    await page.addStyleTag({ content: END_STATE_CSS });
    await page.evaluate(
      ({ steps, noteText, withNote }) => {
        const card = [...document.querySelectorAll("article.recipe-view-section")].find(
          (a) => a.querySelector("h2")?.textContent.trim() === "Steps",
        );
        if (!card) throw new Error("Steps card not found");
        const rows = card.querySelectorAll(".recipe-step-item p");
        if (rows.length !== steps.length) throw new Error(`expected ${steps.length} step rows, found ${rows.length}`);
        rows.forEach((row, i) => { row.textContent = steps[i]; });
        card.querySelectorAll(".recipe-steps-note").forEach((n) => n.remove());
        if (withNote) {
          card.querySelector("h2").insertAdjacentHTML("afterend", `<p class="recipe-steps-note">${noteText}</p>`);
        }
      },
      { steps: BACKFILLED_STEPS, noteText: NOTE_TEXT, withNote: Boolean(noteCss) },
    );
    if (noteCss) await page.addStyleTag({ content: noteCss });
    await page.waitForTimeout(350);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 85, fullPage: true });
    console.log(`shot ${name} ok`);
  };

  await shotBefore();
  await shotEndState("AS1-base", null);
  await shotEndState("AS1-A", NOTE_CSS_A);
  await shotEndState("AS1-B", NOTE_CSS_B);

  // ---- AS2-A / AS2-B: Today's cook hero, button label ----
  // Pin the browser clock inside the seeded plan (2026-07-01 to 07-07), where
  // Lemon Chicken Thighs is tonight's cook item.
  await page.clock.setFixedTime(new Date("2026-07-02T12:00:00"));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".tonight-btn", { timeout: 15000 });
  await page.waitForTimeout(600);
  await page.addStyleTag({ content: HIDE_DEV_BADGE_CSS }).catch(() => {});
  const hero = (await page.locator(".tonight-card h2").first().textContent())?.trim();
  if (hero !== "Lemon Chicken Thighs") {
    throw new Error(`Today hero is "${hero}", expected Lemon Chicken Thighs (is the seeded 2026-07-01 plan present?)`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "AS2-A.jpg"), type: "jpeg", quality: 85 });
  console.log("shot AS2-A ok");
  await page.evaluate(() => { document.querySelector(".tonight-btn").textContent = "View recipe"; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "AS2-B.jpg"), type: "jpeg", quality: 85 });
  console.log("shot AS2-B ok");

  await browser.close();
  console.log(`done, ${errors.length} page errors${errors.length ? ": " + errors.join("; ") : ""}`);
  if (errors.length) process.exitCode = 1;
};

run().catch((e) => { console.error("CAPTURE FAILED:", e); process.exitCode = 1; });
