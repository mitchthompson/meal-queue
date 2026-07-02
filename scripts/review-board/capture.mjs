// Reflow review-board capture. Local stack only.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const require_ = createRequire(import.meta.url);
const pw = require_("/Users/mitchell/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");

const BASE = process.env.APP_URL || "http://localhost:3123";
const DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(DIR, "shots");
const SEED = path.join(DIR, "seed-review.sql");
const PSQL = "/opt/homebrew/opt/libpq/bin/psql";
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
fs.mkdirSync(OUT, { recursive: true });

const manifest = { shots: [], consoleErrors: [], skipped: [] };

async function launch() {
  try {
    return await pw.chromium.launch({ headless: true });
  } catch {
    const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
    const dirs = fs.readdirSync(cache).filter((d) => /^chromium(_headless_shell)?-\d+$/.test(d)).sort().reverse();
    for (const d of dirs) {
      for (const sub of ["chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium", "chrome-mac/Chromium.app/Contents/MacOS/Chromium", "chrome-mac/headless_shell", "chrome-mac-arm64/headless_shell"]) {
        const p = path.join(cache, d, sub);
        if (fs.existsSync(p)) {
          try { return await pw.chromium.launch({ headless: true, executablePath: p }); } catch {}
        }
      }
    }
    return await pw.chromium.launch({ headless: true, channel: "chrome" });
  }
}

function wirePage(page, label) {
  page.on("console", (m) => { if (m.type() === "error") manifest.consoleErrors.push(`[${label}] ${m.text()}`); });
  page.on("pageerror", (e) => manifest.consoleErrors.push(`[${label}] pageerror: ${e.message}`));
}

async function settle(page, ms = 700) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(ms);
}

// the Next dev-tools badge overlaps the Today gear and Shop's Regenerate
async function hideDevBadge(page) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
}

async function shot(page, id, title, pins) {
  const vp = page.viewportSize();
  const file = `${id}.jpg`;
  await page.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 82 });
  const resolved = [];
  for (const p of pins) {
    try {
      const loc = typeof p.sel === "function" ? p.sel(page) : page.locator(p.sel).first();
      const box = await loc.boundingBox();
      if (box && box.y > -10 && box.y < vp.height && box.x >= -10) {
        resolved.push({ n: p.n, label: p.label, x: box.x, y: box.y, w: box.width, h: box.height });
      } else resolved.push({ n: p.n, label: p.label, missing: true });
    } catch { resolved.push({ n: p.n, label: p.label, missing: true }); }
  }
  manifest.shots.push({ id, file, title, vw: vp.width, vh: vp.height, pins: resolved });
  console.log(`shot ${id} ok (${resolved.filter((r) => !r.missing).length}/${pins.length} pins)`);
}

async function phase(name, fn) {
  try { await fn(); } catch (e) {
    manifest.skipped.push({ phase: name, error: String(e).slice(0, 200) });
    console.log(`PHASE SKIPPED: ${name}: ${String(e).slice(0, 160)}`);
  }
}

const run = async () => {
  const browser = await launch();
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  const page = await phone.newPage();
  wirePage(page, "phone");

  // ---- sign-up (fresh user; falls back to sign-in) ----
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(page, 1200);
  await hideDevBadge(page);
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
  await settle(page, 800);

  await phase("T-planless", async () => {
    await page.waitForSelector(".tonight-card-empty", { timeout: 5000 });
    await shot(page, "T-planless", "Today — no plan yet (first run / gap week)", [
      { n: "T2", sel: ".tonight-card-empty", label: "Plan-less hero: “Plan your week to get started” → /plans" },
      { n: "•", sel: ".mobile-tabbar", label: "4-tab bar: Today · Plan · Shop · Recipes — no Settings tab" },
    ]);
  });

  execSync(`${PSQL} "${LOCAL_DB}" -v ON_ERROR_STOP=1 -f "${SEED}"`, { stdio: "inherit" });

  await phase("T-main", async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(".tonight-card", { timeout: 15000 });
    await settle(page, 1200);
    await hideDevBadge(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await shot(page, "T-main", "Today — tonight hero, deadline strip, week peek", [
      { n: "T1", sel: ".today-settings", label: "Settings gear in the header (moved off the tabbar)" },
      { n: "T3", sel: "a.today-pill", label: "Text links hover amber #e8a13d app-wide (—brand-2) — could stay teal" },
      { n: "•", sel: ".tonight-card", label: "Tonight hero → Start cooking" },
      { n: "•", sel: ".today-strip", label: "Deadline strip (order due · unchecked count)" },
      { n: "•", sel: ".today-pill-warm", label: "Leftover pill in the week peek" },
    ]);
  });

  await phase("Plan", async () => {
    await page.locator(".mobile-tabbar a", { hasText: "Plan" }).click();
    await page.waitForSelector(".plan-dhead", { timeout: 15000 });
    await settle(page, 900);
    await shot(page, "P-top", "Plan — day rows, today highlighted", [
      { n: "P3", sel: ".plan-filter-row", label: "Filter pills (Current/Upcoming/Past/All) + compact picker kept above the rows" },
      { n: "•", sel: ".plan-slot-add", label: "Quick-add (+) — the primary action per slot" },
    ]);

    await page.locator(".plan-slot-more").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await shot(page, "P-multi", "Plan — stacked multi-item slot, serving controls", [
      { n: "P4", sel: ".plan-slot-more", label: "Multi-item slot: stacked rows + “+ add another”; eat-out notes inline" },
      { n: "•", sel: ".serving-controls", label: "Compact −/×N/+ serving controls" },
    ]);

    await page.locator(".plan-generate").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await shot(page, "P-generate", "Plan — the flow's exit", [
      { n: "P2", sel: ".plan-generate", label: "“Generate grocery list” is a link to Shop (staleness does the generating)" },
    ]);
  });

  await phase("P-editsheet", async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /^edit$/i }).click();
    await page.waitForSelector(".panel.plan-sheet", { timeout: 8000 });
    await page.waitForTimeout(400);
    await shot(page, "P-editsheet", "Plan — edit sheet open", [
      { n: "P1", sel: ".panel.plan-sheet", label: "Sheets are inline collapsible panels (not modal overlays)" },
    ]);
    await page.getByRole("button", { name: /^close$/i }).first().click();
    await page.waitForTimeout(300);
  });

  await phase("Shop", async () => {
    await page.locator(".plan-generate").scrollIntoViewIfNeeded();
    await page.locator(".plan-generate").click();
    await page.waitForSelector(".shop-orderbar", { timeout: 20000 });
    await settle(page, 1800); // staleness regeneration on load
    try {
      const have = page.locator(".shop-item-actions button", { hasText: /have/i }).first();
      if (await have.count()) { await have.click(); await page.waitForTimeout(600); }
    } catch {}
    try {
      const checks = page.locator(".shop-check");
      await checks.nth(0).click(); await page.waitForTimeout(250);
      await checks.nth(1).click(); await page.waitForTimeout(600);
    } catch {}
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await shot(page, "S-list", "Shop — pinned order bar, chunky checks", [
      { n: "S1", sel: (p) => p.getByRole("button", { name: /regenerate/i }).first(), label: "Manual Regenerate kept as the escape hatch beside auto-regeneration" },
      { n: "•", sel: ".shop-orderbar", label: "Pinned order/pickup bar with live unchecked count" },
      { n: "•", sel: ".shop-check", label: "30px checks; checked = teal fill + strikethrough" },
    ]);
    const onhand = page.locator(".shop-section-head", { hasText: /on hand/i }).first();
    if (await onhand.count()) {
      await onhand.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await shot(page, "S-onhand", "Shop — On hand section (default collapsed)", [
        { n: "S2", sel: (p) => p.locator(".shop-section-head", { hasText: /on hand/i }).first(), label: "On-hand section defaults to collapsed (post-purchase bookkeeping)" },
      ]);
    }
  });

  await phase("Cook", async () => {
    await page.locator(".mobile-tabbar a", { hasText: "Today" }).click();
    await page.waitForSelector(".tonight-btn", { timeout: 15000 });
    await settle(page, 800);
    await page.locator(".tonight-btn").click();
    await page.waitForSelector(".cook-mode", { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.locator(".cook-next").click(); // step 2 mentions thighs + olive oil → chips
    await page.waitForTimeout(400);
    await shot(page, "C-step", "Cook — step view with ingredient chips", [
      { n: "C1", sel: ".cook-step-ings", label: "Per-step chips via name-match heuristic (schema has no step↔ingredient link)" },
      { n: "•", sel: ".cook-dots", label: "Amber progress dots" },
      { n: "•", sel: ".cook-next", label: "Giant Next / smaller Back thumb targets" },
    ]);
    for (let i = 0; i < 6; i++) {
      const t = (await page.locator(".cook-next").textContent().catch(() => "")) || "";
      if (/done/i.test(t)) break;
      await page.locator(".cook-next").click();
      await page.waitForTimeout(300);
    }
    await shot(page, "C-done", "Cook — last step", [
      { n: "C2", sel: ".cook-next", label: "“Done — mark cooked” writes nothing today (no cooked state in the schema)" },
    ]);
  });
  await phone.close();

  await phase("T-desktop", async () => {
    const desk = await browser.newContext({ viewport: { width: 1280, height: 832 }, deviceScaleFactor: 2 });
    const dpage = await desk.newPage();
    wirePage(dpage, "desktop");
    await dpage.goto(BASE, { waitUntil: "domcontentloaded" });
    await dpage.waitForTimeout(1000);
    await hideDevBadge(dpage);
    try {
      await dpage.locator('input[type="email"]').fill("reviewer@local.test", { timeout: 4000 });
      await dpage.locator('input[type="password"]').fill("review-pass-1234");
      await dpage.locator("button.primary-btn").click();
    } catch {}
    await dpage.waitForSelector(".tonight-card", { timeout: 15000 });
    await dpage.waitForTimeout(1000);
    await shot(dpage, "T-desktop", "Today on desktop — constrained column", [
      { n: "T4", sel: ".page-col", label: "Desktop column constrained to 640px (.page-col)" },
    ]);
    await desk.close();
  });

  await browser.close();
};

run()
  .catch((e) => { console.error("CAPTURE FAILED:", e); process.exitCode = 1; })
  .finally(() => {
    fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`done: ${manifest.shots.length} shots, ${manifest.skipped.length} skipped phases, ${manifest.consoleErrors.length} console errors`);
    if (manifest.consoleErrors.length) console.log(manifest.consoleErrors.join("\n"));
  });
