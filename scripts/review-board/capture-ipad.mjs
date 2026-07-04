// iPad-coherence Phase-0 baseline. Local stack only.
// Reuses the review-board harness patterns (launch/auth/seed/block). For every
// iPad viewport × screen it (a) screenshots the viewport and (b) probes the
// facts the plan's trigger depends on: matchMedia pointer/hover, the proposed
// `(pointer: coarse) and (max-width:1024px)` trigger, the current `max-width:700px`
// trigger, tabbar-vs-navpills visibility, and sub-44px touch targets. The probe
// table IS the defect catalogue (docs/plans/ipad-support.md Phase 0).
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const require_ = createRequire(import.meta.url);
const pw = require_("/Users/mitchell/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");

const BASE = process.env.APP_URL || "http://localhost:3123";
const DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(DIR, "shots-ipad");
const SEED = path.join(DIR, "seed-review.sql");
const PSQL = "/opt/homebrew/opt/libpq/bin/psql";
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
fs.mkdirSync(OUT, { recursive: true });

// Plan Phase-0 viewports + iPad Mini portrait (lower edge of the coarse band).
const VIEWPORTS = [
  { id: "mini-portrait", w: 744, h: 1024, orient: "portrait" },
  { id: "air-portrait", w: 820, h: 1180, orient: "portrait" },
  { id: "pro11-portrait", w: 834, h: 1194, orient: "portrait" },
  { id: "pro129-portrait", w: 1024, h: 1366, orient: "portrait" },
  { id: "pro11-landscape", w: 1194, h: 834, orient: "landscape" },
  { id: "pro129-landscape", w: 1366, h: 1024, orient: "landscape" },
];

const SCREENS = [
  { id: "today", path: "/", ready: ".today-head, .tonight-card, .tonight-card-empty" },
  { id: "plan", path: "/plans", ready: ".plan-head, .plan-dhead" },
  { id: "shop", path: "/grocery", ready: ".shop-orderbar, .panel" },
  { id: "recipes", path: "/recipes", ready: ".recipes-head, .panel" },
  { id: "settings", path: "/settings", ready: ".panel" },
  // recipe detail resolved at runtime from the first library card
];

const probes = [];

async function launch() {
  try {
    return await pw.chromium.launch({ headless: true });
  } catch {
    const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
    const dirs = fs.readdirSync(cache).filter((d) => /^chromium(_headless_shell)?-\d+$/.test(d)).sort().reverse();
    for (const d of dirs) {
      for (const sub of ["chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium", "chrome-mac/Chromium.app/Contents/MacOS/Chromium", "chrome-mac/headless_shell", "chrome-mac-arm64/headless_shell"]) {
        const p = path.join(cache, d, sub);
        if (fs.existsSync(p)) { try { return await pw.chromium.launch({ headless: true, executablePath: p }); } catch {} }
      }
    }
    return await pw.chromium.launch({ headless: true, channel: "chrome" });
  }
}

async function blockProd(context) {
  await context.route(/.*\.supabase\.co.*/, (r) => r.abort());
}

async function settle(page, ms = 700) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(ms);
}
async function hideDevBadge(page) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
}

// The decisive facts, read from the live DOM.
async function probe(page) {
  return page.evaluate(() => {
    const mm = (q) => window.matchMedia(q).matches;
    const visible = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return { present: false, shown: false };
      const cs = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      const shown = cs.display !== "none" && cs.visibility !== "hidden" && box.width > 0 && box.height > 0;
      return { present: true, shown };
    };
    // interactive targets shorter than 44px that are actually rendered
    let sub44 = 0;
    const samples = [];
    for (const el of document.querySelectorAll("a, button, input, select, summary, [role=button]")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      if (b.height < 44) {
        sub44++;
        if (samples.length < 6) samples.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]}=${Math.round(b.height)}px`);
      }
    }
    return {
      innerWidth: window.innerWidth,
      coarse: mm("(pointer: coarse)"),
      hoverNone: mm("(hover: none)"),
      proposedTrigger: mm("(pointer: coarse) and (max-width: 1024px)"),
      currentTabbarTrigger: mm("(max-width: 700px)"),
      band900: mm("(max-width: 900px)"),
      tabbar: visible(".mobile-tabbar"),
      navPills: visible(".nav-pills"),
      sub44,
      sub44samples: samples,
    };
  });
}

const run = async () => {
  const browser = await launch();

  // ---- sign up / in once, then reuse the session across viewports ----
  const boot = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  await blockProd(boot);
  const bp = boot.newPage ? await boot.newPage() : null;
  await bp.goto(BASE, { waitUntil: "domcontentloaded" });
  await settle(bp, 1200);
  await bp.getByText("Need an account? Create one").click().catch(() => {});
  await bp.locator('input[type="email"]').fill("reviewer@local.test");
  await bp.locator('input[type="password"]').fill("review-pass-1234");
  await bp.locator("button.primary-btn").click();
  try {
    await bp.waitForSelector(".today-head, .tonight-card, .tonight-card-empty", { timeout: 8000 });
  } catch {
    await bp.getByText("Already have an account? Sign in").click().catch(() => {});
    await bp.locator("button.primary-btn").click();
    await bp.waitForSelector(".today-head, .tonight-card, .tonight-card-empty", { timeout: 15000 });
  }
  execSync(`${PSQL} "${LOCAL_DB}" -v ON_ERROR_STOP=1 -f "${SEED}"`, { stdio: "inherit" });
  const storageState = await boot.storageState();

  // resolve a recipe-detail URL from the seeded library
  await bp.goto(`${BASE}/recipes`, { waitUntil: "domcontentloaded" });
  await settle(bp, 1000);
  const detailPath = await bp.evaluate(() => {
    const a = document.querySelector('a[href^="/recipes/"]');
    return a ? new URL(a.href).pathname : null;
  });
  if (detailPath) SCREENS.push({ id: "recipe-detail", path: detailPath, ready: ".recipe-view-layout, .panel" });
  await boot.close();

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
      storageState,
      userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    });
    await blockProd(ctx);
    const page = await ctx.newPage();
    for (const sc of SCREENS) {
      try {
        await page.goto(`${BASE}${sc.path}`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector(sc.ready, { timeout: 15000 });
        await settle(page, sc.id === "shop" ? 1800 : 700);
        await hideDevBadge(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(200);
        const file = `${vp.id}__${sc.id}.jpg`;
        await page.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 80 });
        const p = await probe(page);
        probes.push({ viewport: vp.id, vw: vp.w, vh: vp.h, orient: vp.orient, screen: sc.id, file, ...p });
        console.log(`${vp.id.padEnd(18)} ${sc.id.padEnd(14)} iw=${p.innerWidth} coarse=${p.coarse} tabbar=${p.tabbar.shown} navpills=${p.navPills.shown} sub44=${p.sub44}`);
      } catch (e) {
        probes.push({ viewport: vp.id, screen: sc.id, error: String(e).slice(0, 160) });
        console.log(`${vp.id} ${sc.id} SKIPPED: ${String(e).slice(0, 120)}`);
      }
    }
    await ctx.close();
  }
  await browser.close();
};

run()
  .catch((e) => { console.error("CAPTURE FAILED:", e); process.exitCode = 1; })
  .finally(() => {
    fs.writeFileSync(path.join(OUT, "probes.json"), JSON.stringify(probes, null, 2));
    console.log(`\ndone: ${probes.length} probes → ${path.join(OUT, "probes.json")}`);
  });
