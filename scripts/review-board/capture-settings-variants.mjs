// Round-2 board captures: Settings variant mocks (CSS-injected, no code changes)
// + "before" reconstructions of the pre-part-1 cream values. Local stack only.
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

// pre-part-1 values, for honest labeled "before" reconstructions
const OLD_SETTINGS_CSS = `
  .panel{border-color:#e4d8c6!important;background:rgba(255,253,248,.92)!important}
`;
const OLD_DETAIL_CSS = `
  .recipe-view-section{border-color:#c9bba6!important}
  .recipe-meta{background:#fffefb!important}
  .recipe-meta span{color:#3d443d!important}
  .pantry-badge{border-color:#c9bba6!important;background:#f3eadc!important}
  .recipe-step-item{background:#fffefb!important}
`;

// shared v2 language: page head, uppercase card labels, 44px controls, chunky save
const VARIANT_SHARED_CSS = `
  main.shell > section:not(.panel)::before{content:"Settings";display:block;font-size:1.5rem;font-weight:800;letter-spacing:-.02em;line-height:1.25;margin-top:.5rem;color:var(--ink)}
  section.panel .section-head h2{font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0}
  section.panel:last-of-type::before{content:"Planning defaults";display:block;font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:.6rem}
  .panel input,.panel select{min-height:44px}
  .secondary-btn{min-height:44px}
  form.stack .primary-btn{width:100%;border-radius:12px;padding:.9rem;font-size:1rem;font-weight:700}
`;
// B only: iOS-style rows — label text left, control right, hairline dividers
const VARIANT_B_CSS = `
  form.stack{gap:0}
  form.stack label{display:grid;grid-template-columns:1fr minmax(0,46%);align-items:center;gap:.6rem;padding:.6rem 0;margin:0;border-bottom:1px solid var(--line);font-size:.92rem;font-weight:600;color:var(--ink)}
  form.stack label:last-of-type{border-bottom:0}
  form.stack .primary-btn{margin-top:.85rem}
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

  const shot = async (name, url, css) => {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("section.panel, .recipe-view-section", { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    if (css) await page.addStyleTag({ content: css });
    await page.waitForTimeout(350);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 85 });
    console.log(`shot ${name} ok`);
  };

  await shot("SET-before", `${BASE}/settings`, OLD_SETTINGS_CSS);
  await shot("SET-A", `${BASE}/settings`, VARIANT_SHARED_CSS);
  await shot("SET-B", `${BASE}/settings`, VARIANT_SHARED_CSS + VARIANT_B_CSS);
  await shot("DET-before", `${BASE}/recipes/${recipeId}`, OLD_DETAIL_CSS);

  await browser.close();
  console.log(`done, ${errors.length} page errors${errors.length ? ": " + errors.join("; ") : ""}`);
  if (errors.length) process.exitCode = 1;
};

run().catch((e) => { console.error("CAPTURE FAILED:", e); process.exitCode = 1; });
