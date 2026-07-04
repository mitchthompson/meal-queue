// Round-5 board captures: in-app Recipe Import direction mocks (IM1–IM7).
// CSS/DOM injections on the live local /recipes screen — no app code exists yet
// (that is Phase C). Reuses the app's real token classes so the mocks read as
// native. Local stack only. Template lineage: capture-recipes-variants.mjs (r3).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const pw = require_("/Users/mitchell/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");

const BASE = process.env.APP_URL || "http://localhost:3123";
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "shots-import");
fs.mkdirSync(OUT, { recursive: true });

// Import-specific styling. Containers reuse .panel; the submit reuses
// .recipes-save (the full-width teal group); the amber callout uses the
// pantry-badge palette (--color-accent*). No em-dashes in any copy.
const IMPORT_CSS = `
  .recipes-screen .panel input:not([type=checkbox]),
  .recipes-screen .panel select { min-height: 2.75rem; }
  .import-label { display:block; margin:.9rem 0 .3rem; font-size:.72rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); }
  .import-textarea { min-height:150px; }
  .import-or { display:flex; align-items:center; gap:.6rem; color:var(--muted); font-size:.85rem; margin:.9rem 0; }
  .import-or::before, .import-or::after { content:""; flex:1; height:1px; background:var(--line); }
  .import-hint { color:var(--muted); font-size:.8rem; margin:.5rem 0 0; }
  .import-mode-pills { display:flex; gap:.5rem; margin-bottom:.2rem; }
  .import-pill { flex:1; min-height:2.75rem; border:1px solid var(--line); border-radius:999px; background:var(--surface); font-weight:600; color:var(--ink); cursor:pointer; }
  .import-pill.active { border-color:var(--brand); background:var(--color-primary-soft); color:var(--brand); }
  .import-progress { height:4px; border-radius:999px; background:var(--color-primary-soft); overflow:hidden; margin:.9rem 0 .2rem; }
  .import-progress > span { display:block; height:100%; width:40%; border-radius:999px; background:var(--brand); }
  .import-callout { background:var(--color-accent-soft); border:1px solid var(--color-accent); color:var(--color-accent-deep); border-radius:12px; padding:.7rem .8rem; font-size:.9rem; font-weight:600; margin:.2rem 0 .4rem; }
  .import-error { background:#fbe9e7; border:1px solid var(--color-danger); color:#8a2a1e; border-radius:12px; padding:.7rem .8rem; font-size:.9rem; font-weight:600; margin:.2rem 0 .4rem; }
  .import-provenance { color:var(--muted); font-size:.85rem; margin:.9rem 0 .2rem; }
  .import-note { color:var(--muted); font-size:.85rem; text-align:center; margin:.7rem 0 0; }
  .import-original { border:1px solid var(--line); border-radius:12px; padding:.5rem .75rem; margin-bottom:.4rem; }
  .import-original > summary { font-size:.72rem; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); cursor:pointer; }
  .import-original-body { max-height:40vh; overflow-y:auto; color:var(--muted); font-size:.82rem; white-space:pre-wrap; margin-top:.55rem; line-height:1.5; }
`;

const ORIGINAL_TEXT = `Source: https://cooking.nytimes.com/recipes/1234

Sheet-Pan Chicken Thighs With Potatoes
Serves 4

2 lbs bone-in chicken thighs
1 1/2 lbs baby potatoes, halved
2 tbsp olive oil
1 tsp salt
1/2 tsp black pepper

1. Heat oven to 425°F.
2. Toss chicken and potatoes with olive oil, salt, and pepper on a sheet pan.
3. Roast 35 to 40 minutes, until the chicken is cooked through.`;

// The editable review form, in the exact editor idiom (ingredient/step rows,
// unit selects, chips). Shared across IM4/IM5.
const REVIEW_FORM = `
  <label>Name<input value="Sheet-Pan Chicken Thighs With Potatoes"></label>
  <label>Base servings<input type="number" value="4"></label>
  <div class="stack">
    <div class="section-head"><h3 class="recipes-card-label">Ingredients</h3><button class="secondary-btn" type="button">Add ingredient</button></div>
    <div class="ingredient-row"><input value="chicken thighs"><input type="number" value="2"><select><option>pound</option></select><label class="inline-check"><input type="checkbox">Pantry</label><button class="text-btn" type="button">Remove</button></div>
    <div class="ingredient-row"><input value="baby potatoes"><input type="number" value="1.5"><select><option>pound</option></select><label class="inline-check"><input type="checkbox">Pantry</label><button class="text-btn" type="button">Remove</button></div>
    <div class="ingredient-row"><input value="olive oil"><input type="number" value="2"><select><option>tablespoon</option></select><label class="inline-check"><input type="checkbox" checked>Pantry</label><button class="text-btn" type="button">Remove</button></div>
    <div class="ingredient-row"><input value="salt"><input type="number" value="1"><select><option>teaspoon</option></select><label class="inline-check"><input type="checkbox" checked>Pantry</label><button class="text-btn" type="button">Remove</button></div>
  </div>
  <div class="stack">
    <div class="section-head"><h3 class="recipes-card-label">Steps</h3><button class="secondary-btn" type="button">Add step</button></div>
    <div class="step-row"><span>1.</span><textarea rows="2">Heat oven to 425°F.</textarea><button class="text-btn" type="button">Remove</button></div>
    <div class="step-row"><span>2.</span><textarea rows="2">Toss chicken and potatoes with olive oil, salt, and pepper on a sheet pan.</textarea><button class="text-btn" type="button">Remove</button></div>
    <div class="step-row"><span>3.</span><textarea rows="2">Roast 35 to 40 minutes, until the chicken is cooked through.</textarea><button class="text-btn" type="button">Remove</button></div>
  </div>
  <div class="stack">
    <h3 class="recipes-card-label">Tags</h3>
    <div class="chip-wrap"><button class="chip active" type="button">chicken x</button><button class="chip active" type="button">sheet-pan x</button></div>
    <p class="muted">Starter suggestions</p>
    <div class="chip-wrap"><button class="chip" type="button">+ under-30-min</button><button class="chip" type="button">+ italian</button></div>
  </div>`;

const reviewBottom = `
  <p class="import-provenance">Imported from cooking.nytimes.com</p>
  <p class="import-note">The original text is saved with the recipe.</p>
  <button class="recipes-save" type="button">Save recipe</button>`;

const mocks = {
  // IM1-A: stacked surface (paste textarea, "or", URL, full-width teal button)
  "IM1-A": `
    <section class="recipes-head"><h1 class="recipes-editor-title">Import recipe</h1><button class="text-btn" type="button">Cancel</button></section>
    <section class="panel">
      <label class="import-label">Paste recipe text</label>
      <textarea class="import-textarea" placeholder="Copy the recipe in NYT Cooking, then paste it here."></textarea>
      <div class="import-or">or</div>
      <label class="import-label">Recipe URL</label>
      <input type="url" placeholder="https://a-recipe-site.com/...">
      <button class="recipes-save" type="button">Import recipe</button>
      <p class="import-hint">If you fill both, the pasted text wins.</p>
    </section>`,

  // IM1-B: Paste/Link mode pills, one input at a time
  "IM1-B": `
    <section class="recipes-head"><h1 class="recipes-editor-title">Import recipe</h1><button class="text-btn" type="button">Cancel</button></section>
    <section class="panel">
      <div class="import-mode-pills"><button class="import-pill active" type="button">Paste text</button><button class="import-pill" type="button">Link</button></div>
      <label class="import-label">Paste recipe text</label>
      <textarea class="import-textarea" placeholder="Copy the recipe in NYT Cooking, then paste it here."></textarea>
      <button class="recipes-save" type="button">Import recipe</button>
      <p class="import-hint">Switch to Link to import from an open site.</p>
    </section>`,

  // IM2: parsing state — inputs locked, button "Reading recipe…", indeterminate
  // bar, Cancel text-btn, aria-live note
  "IM2": `
    <section class="recipes-head"><h1 class="recipes-editor-title">Import recipe</h1></section>
    <section class="panel">
      <label class="import-label">Paste recipe text</label>
      <textarea class="import-textarea" disabled>Sheet-Pan Chicken Thighs With Potatoes. Serves 4. 2 lbs bone-in chicken thighs, 1 1/2 lbs baby potatoes, 2 tbsp olive oil, salt and pepper. Heat oven to 425. Toss on a sheet pan. Roast 35 to 40 minutes.</textarea>
      <div class="import-progress"><span></span></div>
      <button class="recipes-save" type="button" disabled>Reading recipe…</button>
      <div style="text-align:center;margin-top:.6rem"><button class="text-btn" type="button">Cancel</button></div>
      <p class="import-hint" role="status" aria-live="polite" style="text-align:center">Reading the recipe. This can take about 15 seconds.</p>
    </section>`,

  // IM3-amber: paywall as amber callout, focus returned to the textarea, URL kept
  "IM3-amber": `
    <section class="recipes-head"><h1 class="recipes-editor-title">Import recipe</h1><button class="text-btn" type="button">Cancel</button></section>
    <section class="panel">
      <div class="import-callout">That site blocked us. Paste the recipe text instead.</div>
      <label class="import-label">Paste recipe text</label>
      <textarea class="import-textarea" autofocus placeholder="Copy the recipe in NYT Cooking, then paste it here."></textarea>
      <div class="import-or">or</div>
      <label class="import-label">Recipe URL</label>
      <input type="url" value="https://cooking.nytimes.com/recipes/1234">
      <button class="recipes-save" type="button">Import recipe</button>
    </section>`,

  // IM3-red: the same failure as a plain red error (for comparison)
  "IM3-red": `
    <section class="recipes-head"><h1 class="recipes-editor-title">Import recipe</h1><button class="text-btn" type="button">Cancel</button></section>
    <section class="panel">
      <div class="import-error">That site blocked the request (likely a paywall). Copy the recipe text from the page and paste it instead.</div>
      <label class="import-label">Paste recipe text</label>
      <textarea class="import-textarea" placeholder="Copy the recipe in NYT Cooking, then paste it here."></textarea>
      <div class="import-or">or</div>
      <label class="import-label">Recipe URL</label>
      <input type="url" value="https://cooking.nytimes.com/recipes/1234">
      <button class="recipes-save" type="button">Import recipe</button>
    </section>`,

  // IM4-A: review screen, collapsible "Original text" <details> above the form
  // (shown open so the Source-prefixed, non-editable original is visible — IM6)
  "IM4-A": `
    <section class="recipes-head"><h1 class="recipes-editor-title">Review recipe</h1><button class="text-btn" type="button">‹ Start over</button></section>
    <section class="panel">
      <form class="stack">
        <details class="import-original" open><summary>Original text</summary><div class="import-original-body">${ORIGINAL_TEXT}</div></details>
        ${REVIEW_FORM}
        ${reviewBottom}
      </form>
    </section>`,

  // IM4-B: review screen, Parsed/Original toggle pills instead of the <details>
  "IM4-B": `
    <section class="recipes-head"><h1 class="recipes-editor-title">Review recipe</h1><button class="text-btn" type="button">‹ Start over</button></section>
    <section class="panel">
      <form class="stack">
        <div class="import-mode-pills"><button class="import-pill active" type="button">Parsed</button><button class="import-pill" type="button">Original</button></div>
        ${REVIEW_FORM}
        ${reviewBottom}
      </form>
    </section>`,
};
// IM5 reuses the IM4-A screen, scrolled to the Save cluster (provenance + note + save).

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

  // Sign up the reviewer (falls back to sign-in), matching capture.mjs.
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.getByText("Need an account? Create one").click();
  await page.locator('input[type="email"]').fill("reviewer@local.test");
  await page.locator('input[type="password"]').fill("review-pass-1234");
  await page.locator("button.primary-btn").click();
  try {
    await page.waitForSelector(".today-head, .tonight-card, .tonight-card-empty", { timeout: 8000 });
  } catch {
    await page.getByText("Already have an account? Sign in").click();
    await page.locator("button.primary-btn").click();
    await page.waitForSelector(".today-head, .tonight-card, .tonight-card-empty", { timeout: 15000 });
  }

  const snap = async (name) => {
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 85 });
    console.log(`shot ${name} ok`);
  };

  const importShot = async (name, innerHtml, { scrollBottom = false } = {}) => {
    await page.goto(`${BASE}/recipes`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".recipes-head", { timeout: 15000 });
    await page.waitForTimeout(500);
    await page.addStyleTag({ content: IMPORT_CSS });
    await page.evaluate((html) => {
      const el = document.querySelector(".recipes-screen");
      if (el) el.innerHTML = html;
    }, innerHtml);
    await page.waitForTimeout(300);
    await page.evaluate((sb) => window.scrollTo(0, sb ? document.body.scrollHeight : 0), scrollBottom);
    await page.waitForTimeout(250);
    await snap(name);
  };

  const im7Shot = async (name, where) => {
    await page.goto(`${BASE}/recipes`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".recipes-head", { timeout: 15000 });
    await page.waitForTimeout(500);
    await page.evaluate((w) => {
      const btn = document.createElement("button");
      btn.className = "secondary-btn";
      btn.type = "button";
      btn.textContent = "Import";
      if (w === "actions") {
        const actions = document.querySelector("aside.panel .section-head .section-actions");
        if (actions) actions.insertBefore(btn, actions.firstChild);
      } else {
        btn.style.minHeight = "2.5rem";
        const head = document.querySelector(".recipes-head");
        if (head) head.appendChild(btn);
      }
    }, where);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    await snap(name);
  };

  await importShot("IM1-A", mocks["IM1-A"]);
  await importShot("IM1-B", mocks["IM1-B"]);
  await importShot("IM2", mocks["IM2"]);
  await importShot("IM3-amber", mocks["IM3-amber"]);
  await importShot("IM3-red", mocks["IM3-red"]);
  await importShot("IM4-A", mocks["IM4-A"]);
  await importShot("IM4-B", mocks["IM4-B"]);
  await importShot("IM5", mocks["IM4-A"], { scrollBottom: true });
  await im7Shot("IM7-A", "actions");
  await im7Shot("IM7-B", "head");

  await browser.close();
  console.log(`done, ${errors.length} page errors${errors.length ? ": " + errors.join("; ") : ""}`);
};

run().catch((e) => {
  console.error("CAPTURE FAILED:", e);
  process.exitCode = 1;
});
