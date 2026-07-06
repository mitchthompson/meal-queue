// Milestone 11 (password reset) verification. Drives the whole builder-runnable
// slice of the M11 spec §6 against the LOCAL stack + a dev server on :3123:
//   - empty-email guard on "Forgot password?" (inline error, no /recover call)
//   - reset-request success message (real /auth/v1/recover round-trip)
//   - expired-link state (/reset-password with no session)
//   - the session-present reset form: mismatch guard (no /user PUT), then a real
//     updateUser password change, then old-password-rejected / new-accepted
//   - sign-up toggle regression (Forgot password? hidden in sign-up mode)
//
// The email-link round-trip itself (resetPasswordForEmail email -> Safari ->
// recovery session) is the Needs-Mitchell prod item; /reset-password keys off
// session presence, so a normal sign-in exercises every UI state here.
//
// Destructive: it changes the reviewer password mid-run and RESTORES it to
// review-pass-1234 in a finally, so the shared review-board account stays usable
// for the other harnesses. Local stack only — never point at prod.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const pw = require_("/Users/mitchell/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");

const BASE = "http://localhost:3123";
const MAILPIT = "http://127.0.0.1:54324";
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "shots-reset");
fs.mkdirSync(OUT, { recursive: true });

async function clearMailbox() {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" }).catch(() => {});
}
// Poll Mailpit for a message addressed to `to`; returns the message summary or null.
async function findEmailTo(to, tries = 15) {
  for (let i = 0; i < tries; i += 1) {
    const res = await fetch(`${MAILPIT}/api/v1/messages`).catch(() => null);
    if (res && res.ok) {
      const body = await res.json();
      const hit = (body.messages || []).find((m) =>
        (m.To || []).some((addr) => (addr.Address || "").toLowerCase() === to.toLowerCase()),
      );
      if (hit) return hit;
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  return null;
}

const EMAIL = "reviewer@local.test";
const PW_ORIG = "review-pass-1234";
const PW_NEW = "reset-newpw-4321";

const results = [];
const consoleErrors = [];
function check(name, actual, expected) {
  const pass = actual === expected;
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${actual}${pass ? "" : ` (expected ${expected})`}`);
}
function checkTrue(name, cond, detail = "") {
  results.push(!!cond);
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${cond ? "" : ` ${detail}`}`);
}

const TODAY_SEL = ".today-head, .tonight-card, .tonight-card-empty";

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
  // Block prod only; local stack (127.0.0.1:54321) must go through.
  await ctx.route(/supabase\.co/, (route) => route.abort());
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // This harness deliberately drives wrong-password sign-ins ("old password
    // rejected") which surface as browser "Failed to load resource ... 400"
    // lines — network noise from asserted negative paths, not JS errors. Real
    // React/JS errors have distinct text and still fail the gate (as do pageerrors).
    if (/Failed to load resource/.test(m.text())) return;
    consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  let recoverCount = 0;
  let userPutCount = 0;
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("/auth/v1/recover")) recoverCount += 1;
    if (u.includes("/auth/v1/user") && req.method() === "PUT") userPutCount += 1;
  });

  // --- helpers -------------------------------------------------------------
  async function gotoAuthForm() {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[type="email"]', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
  }
  // Sign in from the auth form; resolves "ok" | "error" | "timeout".
  async function signIn(email, password) {
    await page.waitForSelector('input[type="email"]', { timeout: 20000 });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.locator("form.stack button.primary-btn").click();
    const outcome = await Promise.race([
      page.waitForSelector(TODAY_SEL, { timeout: 12000 }).then(() => "ok").catch(() => "timeout"),
      page.waitForSelector(".error-text", { timeout: 12000 }).then(() => "error").catch(() => "timeout"),
    ]);
    await page.waitForTimeout(300);
    return outcome;
  }
  async function signOut() {
    await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
    // Wait for the session to resolve: either the settings screen (signed in)
    // or the auth form (already out) — checking the button too early misses it.
    await page.waitForSelector('.settings-signout, input[type="email"]', { timeout: 20000 });
    const btn = page.locator(".settings-signout");
    if (await btn.count()) {
      await btn.click();
      await page.waitForSelector('input[type="email"]', { timeout: 20000 });
    }
    await page.waitForTimeout(500);
  }
  // Establish PW_ORIG as the starting password, self-healing a prior aborted run
  // that may have left the account at PW_NEW.
  async function ensureStartPassword() {
    await gotoAuthForm();
    if (await signIn(EMAIL, PW_ORIG) === "ok") { await signOut(); return; }
    await gotoAuthForm();
    if (await signIn(EMAIL, PW_NEW) === "ok") { await setNewPassword(PW_ORIG); await signOut(); return; }
    throw new Error("cannot establish a known reviewer password (tried PW_ORIG and PW_NEW)");
  }
  // On /reset-password with a live session, set the password to `next`.
  async function setNewPassword(next) {
    await page.goto(`${BASE}/reset-password`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[type="password"]', { timeout: 12000 });
    await page.locator('input[type="password"]').nth(0).fill(next);
    await page.locator('input[type="password"]').nth(1).fill(next);
    await page.locator("form.stack button.primary-btn").click();
    await page.waitForSelector("text=Password updated. You're signed in.", { timeout: 12000 });
  }

  try {
    // === 0. self-heal the starting password (idempotency) ================
    await ensureStartPassword();

    // === 1. empty-email guard ============================================
    await gotoAuthForm();
    checkTrue("sign-in form renders", await page.locator('input[type="email"]').count() > 0);
    await page.locator('input[type="email"]').fill("");
    const before = recoverCount;
    await page.locator("button.text-btn", { hasText: "Forgot password?" }).click();
    await page.waitForSelector(".error-text", { timeout: 6000 });
    check(
      "empty-email inline error",
      await page.locator(".error-text").textContent(),
      "Enter your email above first, then tap Forgot password.",
    );
    check("empty-email fires no /recover", String(recoverCount - before), "0");

    // AR1 shot: sign-in form with the Forgot password? link present.
    await page.screenshot({ path: path.join(OUT, "AR1-signin-forgot.jpg"), type: "jpeg", quality: 85 });

    // === 2. reset-request success (real /recover + email lands in Mailpit) =
    await clearMailbox();
    await page.locator('input[type="email"]').fill(EMAIL);
    const beforeRecover = recoverCount;
    await page.locator("button.text-btn", { hasText: "Forgot password?" }).click();
    await page.waitForSelector("text=Password reset email sent. Check your inbox.", { timeout: 12000 });
    checkTrue("reset-request success message shown", true);
    checkTrue("reset-request fired a /recover call", recoverCount - beforeRecover >= 1, `(delta ${recoverCount - beforeRecover})`);
    const email = await findEmailTo(EMAIL);
    checkTrue("recovery email landed in Mailpit", !!email, "(no message for reviewer)");
    if (email) {
      checkTrue(
        "recovery email subject mentions password",
        /password/i.test(email.Subject || ""),
        `(subject: ${email.Subject})`,
      );
    }

    // === 2b. toggling sign-in <-> sign-up clears the status line =========
    await page.locator("button.text-btn", { hasText: "Need an account? Create one" }).click();
    await page.waitForTimeout(300);
    check(
      "toggle to sign-up clears status line",
      String(await page.locator(".success-text, .error-text").count()),
      "0",
    );
    await page.locator("button.text-btn", { hasText: "Already have an account? Sign in" }).click();
    await page.waitForTimeout(200);

    // === 3. expired-link state (no session) ==============================
    await page.goto(`${BASE}/reset-password`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1400);
    check("expired-link heading", await page.locator("h1").textContent(), "Reset link expired");
    checkTrue(
      "expired-link 'Back to sign in' link",
      await page.locator("a.primary-btn", { hasText: "Back to sign in" }).count() > 0,
    );

    // === 4. session-present form + mismatch guard ========================
    await gotoAuthForm();
    check("normal sign-in works", await signIn(EMAIL, PW_ORIG), "ok");
    await page.goto(`${BASE}/reset-password`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[type="password"]', { timeout: 12000 });
    check("reset form heading", await page.locator("h1").textContent(), "Choose a new password");
    check("reset form has 2 password inputs", String(await page.locator('input[type="password"]').count()), "2");
    check(
      "save button label",
      await page.locator("form.stack button.primary-btn").textContent(),
      "Save new password",
    );
    // AR2 shot: the reset form (session present).
    await page.screenshot({ path: path.join(OUT, "AR2-reset-form.jpg"), type: "jpeg", quality: 85 });

    const beforePut = userPutCount;
    await page.locator('input[type="password"]').nth(0).fill(PW_NEW);
    await page.locator('input[type="password"]').nth(1).fill("does-not-match-000");
    await page.locator("form.stack button.primary-btn").click();
    await page.waitForSelector(".error-text", { timeout: 6000 });
    check("mismatch error", await page.locator(".error-text").textContent(), "Passwords don't match.");
    check("mismatch fires no /user PUT", String(userPutCount - beforePut), "0");

    // === 5. real password change (updateUser) ============================
    const beforePut2 = userPutCount;
    await page.locator('input[type="password"]').nth(0).fill(PW_NEW);
    await page.locator('input[type="password"]').nth(1).fill(PW_NEW);
    await page.locator("form.stack button.primary-btn").click();
    await page.waitForSelector("text=Password updated. You're signed in.", { timeout: 12000 });
    check("update success message", "shown", "shown");
    checkTrue("update fired a /user PUT", userPutCount - beforePut2 >= 1, `(delta ${userPutCount - beforePut2})`);
    checkTrue(
      "success shows 'Go to Today'",
      await page.locator("a.primary-btn", { hasText: "Go to Today" }).count() > 0,
    );

    // === 6. old password rejected, new accepted =========================
    await signOut();
    check("old password rejected", await signIn(EMAIL, PW_ORIG), "error");
    check(
      "old-password error copy",
      await page.locator(".error-text").textContent(),
      "Wrong email or password.",
    );
    await gotoAuthForm();
    check("new password accepted", await signIn(EMAIL, PW_NEW), "ok");

    // === 7. sign-up toggle regression ===================================
    await signOut();
    checkTrue(
      "Forgot password? visible in sign-in mode",
      await page.locator("button.text-btn", { hasText: "Forgot password?" }).count() > 0,
    );
    await page.locator("button.text-btn", { hasText: "Need an account? Create one" }).click();
    await page.waitForTimeout(300);
    check("sign-up heading", await page.locator("section.auth-panel h1").textContent(), "Create Account");
    check(
      "Forgot password? hidden in sign-up mode",
      String(await page.locator("button.text-btn", { hasText: "Forgot password?" }).count()),
      "0",
    );
  } finally {
    // Restore the reviewer password to PW_ORIG no matter where we failed, so the
    // other review-board harnesses keep working.
    try {
      await signOut();
      let outcome = await signIn(EMAIL, PW_ORIG);
      if (outcome === "ok") {
        console.log("RESTORE: reviewer password already " + PW_ORIG);
      } else {
        await gotoAuthForm();
        outcome = await signIn(EMAIL, PW_NEW);
        if (outcome === "ok") {
          await setNewPassword(PW_ORIG);
          console.log("RESTORE: reviewer password reset back to " + PW_ORIG);
        } else {
          console.log("RESTORE WARNING: could not confirm reviewer password state — check manually");
        }
      }
    } catch (e) {
      console.log("RESTORE WARNING: " + e.message);
    }
    await ctx.close();
    await browser.close();
  }

  const failed = results.filter((r) => !r).length;
  console.log(`\n=== ${results.length - failed}/${results.length} passed, ${consoleErrors.length} console errors ===`);
  if (consoleErrors.length) console.log("CONSOLE:", consoleErrors.join("\n"));
  if (failed || consoleErrors.length) process.exitCode = 1;
};

run().catch((e) => { console.error("VERIFY FAILED:", e); process.exitCode = 1; });
