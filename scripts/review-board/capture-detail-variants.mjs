// Round-4 board captures: recipe-detail variant mocks (CSS-injected, no code
// changes) + "before" shots of today's screen. Local stack only.
// Template lineage: capture-recipes-variants.mjs (round 3).
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

// shared v2 language: title in the head language, uppercase card labels,
// 44px servings stepper, full-width teal Start cooking, badge text un-quirked
const SHARED_CSS = `
  .recipe-title-row h1{font-size:1.5rem;font-weight:800;letter-spacing:-.02em}
  .recipe-overview-panel h2,.recipe-view-section h2{font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
  .servings-input-row .secondary-btn{min-height:44px;min-width:44px}
  .servings-input-row input{min-height:44px}
  .recipe-view-section .primary-btn{width:100%;border-radius:12px;padding:.9rem;font-size:1rem;font-weight:700}
  .recipe-meta .pantry-badge{color:var(--color-accent-deep);font-size:.74rem;font-weight:700}
`;
// B only: flatten ingredient + step cards into hairline rows
const VARIANT_B_CSS = `
  .recipe-ingredient-list{gap:0;border-top:1px solid var(--line)}
  .recipe-meta{border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent;padding:.6rem .1rem}
  .recipe-step-list{gap:0;border-top:1px solid var(--line)}
  .recipe-step-item{border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent;padding:.65rem .1rem}
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
  await ctx.route(/supabase\.co/, (route) => route.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  if (await page.locator('input[type="email"]').count()) {
    await page.locator('input[type="email"]').fill("reviewer@local.test");
    await page.locator('input[type="password"]').fill("review-pass-1234");
    await page.locator("button.primary-btn").click();
    await page.waitForSelector(".today-head, .tonight-card, .tonight-card-empty", { timeout: 15000 });
  }

  const recipeId = execSync(`${PSQL} "${LOCAL_DB}" -t -A -c "select id from public.recipes where name='Lemon Chicken Thighs' limit 1"`).toString().trim();

  const shot = async (name, css, scrollTo) => {
    await page.goto(`${BASE}/recipes/${recipeId}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".recipe-view-section", { timeout: 15000 });
    await page.waitForTimeout(900);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    if (css) await page.addStyleTag({ content: css });
    await page.waitForTimeout(350);
    if (scrollTo) {
      await page.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: "start" }), scrollTo);
      await page.evaluate(() => window.scrollBy(0, -8));
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 85 });
    console.log(`shot ${name} ok`);
  };

  const STEPS_SEL = ".recipe-view-section:nth-of-type(2)";
  await shot("RD-before", null, null);
  await shot("RD-A", SHARED_CSS, null);
  await shot("RD-B", SHARED_CSS + VARIANT_B_CSS, null);
  await shot("RD-before-steps", null, STEPS_SEL);
  await shot("RD-A-steps", SHARED_CSS, STEPS_SEL);
  await shot("RD-B-steps", SHARED_CSS + VARIANT_B_CSS, STEPS_SEL);

  await browser.close();
  console.log(`done, ${errors.length} page errors${errors.length ? ": " + errors.join("; ") : ""}`);
  if (errors.length) process.exitCode = 1;
};

run().catch((e) => { console.error("CAPTURE FAILED:", e); process.exitCode = 1; });
