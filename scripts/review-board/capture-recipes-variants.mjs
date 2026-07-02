// Round-3 board captures: Recipes library + editor variant mocks (CSS-injected,
// no code changes) + "before" shots of today's screens. Local stack only.
// Template lineage: capture-settings-variants.mjs (round 2).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const pw = require_("/Users/mitchell/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");

const BASE = "http://localhost:3123";
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "shots-v2");
fs.mkdirSync(OUT, { recursive: true });

// shared v2 language, list screen: page title, uppercase card label,
// 44px search/sort/buttons
const LIST_SHARED_CSS = `
  section.recipes-layout::before{content:"Recipes";display:block;font-size:1.5rem;font-weight:800;letter-spacing:-.02em;line-height:1.25;margin-top:.5rem;color:var(--ink)}
  aside.panel .section-head h2{font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
  .recipes-list-controls input,.recipes-list-controls select{min-height:44px}
  aside.panel .secondary-btn{min-height:44px}
  .list-item .text-btn,.list-item .section-actions a{min-height:44px;display:inline-flex;align-items:center}
  .list-item .section-actions a{color:var(--brand);text-decoration:none;font-weight:600;font-size:.88rem}
`;
// A only: keep the card list, tightened to v2 rhythm
const LIST_A_CSS = `
  .list-item{padding:.8rem .85rem}
  .list-item strong{font-size:1rem;letter-spacing:-.01em}
`;
// B only: flat library rows — hairline dividers, name/serves left, actions right
const LIST_B_CSS = `
  .list{gap:0;margin-top:.5rem;border-top:1px solid var(--line)}
  .list-item{border:0;border-bottom:1px solid var(--line);border-radius:0;background:transparent;padding:.7rem .15rem;grid-template-columns:1fr auto;column-gap:.7rem;align-items:center}
  .list-item strong{grid-column:1;grid-row:1;font-size:1rem;letter-spacing:-.01em}
  .list-item span{grid-column:1;grid-row:2}
  .list-item .section-actions{grid-column:2;grid-row:1/span 2;align-self:center;flex-wrap:nowrap;justify-content:flex-end}
`;
// shared v2 language, editor: big screen title, uppercase section labels,
// 44px inputs, full-width teal save
const EDITOR_SHARED_CSS = `
  form.stack .section-head h2{font-size:1.5rem;font-weight:800;letter-spacing:-.02em;color:var(--ink)}
  form.stack .section-head h3,form.stack h3{margin:0;font-size:.72rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
  form.stack input:not([type=checkbox]),form.stack select{min-height:44px}
  form.stack .secondary-btn{min-height:44px}
  form.stack .primary-btn{width:100%;border-radius:12px;padding:.9rem;font-size:1rem;font-weight:700}
`;
// B only: Name / Base servings as iOS-style rows (Settings ST1:B language);
// the textarea label (raw instructions) stays stacked
const EDITOR_B_CSS = `
  form.stack > label:not(:has(textarea)){display:grid;grid-template-columns:1fr minmax(0,46%);align-items:center;gap:.6rem;padding:.6rem 0;margin:0;border-bottom:1px solid var(--line);font-size:.92rem;font-weight:600;color:var(--ink)}
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

  const snap = async (name) => {
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 85 });
    console.log(`shot ${name} ok`);
  };

  const listShot = async (name, css) => {
    await page.goto(`${BASE}/recipes`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".list-item", { timeout: 15000 });
    await page.waitForTimeout(800);
    if (css) await page.addStyleTag({ content: css });
    await page.evaluate(() => window.scrollTo(0, 0));
    await snap(name);
  };

  const editorShot = async (name, css, toSave) => {
    await page.goto(`${BASE}/recipes`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".list-item", { timeout: 15000 });
    await page.locator(".list-item button.text-btn").first().click();
    await page.waitForSelector("form.stack .ingredient-row", { timeout: 15000 });
    await page.waitForTimeout(800);
    if (css) await page.addStyleTag({ content: css });
    if (toSave) {
      await page.evaluate(() => document.querySelector("form.stack .primary-btn").scrollIntoView({ block: "center" }));
    } else {
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    await snap(name);
  };

  await listShot("RC-list-before", null);
  await listShot("RC-list-A", LIST_SHARED_CSS + LIST_A_CSS);
  await listShot("RC-list-B", LIST_SHARED_CSS + LIST_B_CSS);
  await editorShot("RC-editor-before", null, false);
  await editorShot("RC-editor-A", EDITOR_SHARED_CSS, false);
  await editorShot("RC-editor-B", EDITOR_SHARED_CSS + EDITOR_B_CSS, false);
  await editorShot("RC-editor-save-before", null, true);
  await editorShot("RC-editor-save-A", EDITOR_SHARED_CSS, true);

  await browser.close();
  console.log(`done, ${errors.length} page errors${errors.length ? ": " + errors.join("; ") : ""}`);
  if (errors.length) process.exitCode = 1;
};

run().catch((e) => { console.error("CAPTURE FAILED:", e); process.exitCode = 1; });
