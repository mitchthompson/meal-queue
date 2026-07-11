// Milestone 11 (password reset) board shots — clean as-built states for the
// AR1 (link placement) and AR2 (reset page) sign-off pins. iPhone 390px, local
// stack only. Non-destructive: signs in the reviewer to reach the form, signs
// out for the expired state; never changes the password.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const pw = require_("/Users/mitchell/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");

const BASE = "http://localhost:3123";
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "shots-reset");
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = "reviewer@local.test";
const PW = "review-pass-1234";
const HIDE_OVERLAY = "nextjs-portal{display:none!important}";

const shot = async (page, name) => {
  await page.addStyleTag({ content: HIDE_OVERLAY }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, name), type: "jpeg", quality: 88 });
  console.log("shot", name);
};

const run = async () => {
  const browser = await pw.chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  });
  await ctx.route(/supabase\.co/, (route) => route.abort());
  const page = await ctx.newPage();

  // AR1a — sign-in form at rest, showing the Forgot password? link placement.
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.waitForTimeout(700);
  await shot(page, "AR1a-signin-link.jpg");

  // AR1b — the reset-request confirmation on the sign-in form.
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator("button.text-btn", { hasText: "Forgot password?" }).click();
  await page.waitForSelector("text=Password reset email sent. Check your inbox.", { timeout: 12000 });
  await page.waitForTimeout(300);
  await shot(page, "AR1b-request-sent.jpg");

  // AR2b — expired-link state (no session), captured before we sign in.
  await page.goto(`${BASE}/reset-password`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 20000 });
  await page.waitForTimeout(900);
  await shot(page, "AR2b-expired.jpg");

  // AR2a — the reset form (session present). Sign in normally to reach it.
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="email"]', { timeout: 20000 });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PW);
  await page.locator("form.stack button.primary-btn").click();
  await page.waitForSelector(".today-head, .tonight-card, .tonight-card-empty", { timeout: 15000 });
  await page.goto(`${BASE}/reset-password`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[type="password"]', { timeout: 20000 });
  await page.waitForTimeout(700);
  await shot(page, "AR2a-reset-form.jpg");

  // Leave the reviewer signed out so other tools start clean.
  await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".settings-signout, input[type=\"email\"]", { timeout: 20000 });
  const out = page.locator(".settings-signout");
  if (await out.count()) { await out.click(); await page.waitForSelector('input[type="email"]', { timeout: 15000 }).catch(() => {}); }

  await ctx.close();
  await browser.close();
  console.log("done");
};

run().catch((e) => { console.error("CAPTURE FAILED:", e); process.exitCode = 1; });
