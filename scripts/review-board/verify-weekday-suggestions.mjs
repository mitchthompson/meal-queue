// Milestone 17 verification (weekday suggestions + "Add the usuals"): drives the
// real Plan page against a seeded local stack and proves, end to end,
//   - the habit rule through the UI (which weekdays show a "Usually on" group),
//   - the add-meal takeover group (hides on a typed query, no duplicates, Enter),
//   - the one-tap Add the usuals (optimistic write, rollback on a failed write,
//     one atomic insert, F1 (a): one meal per empty day),
//   - the Shop hand-off (plan version moves, the list goes stale, nothing regenerates).
// Local stack only. Lineage: verify-optimistic-pass.mjs, verify-shop-pass.mjs.
//
// Self-contained: dedicated wsverify@local.test user (habits read ALL of a user's
// plans), seed-weekday-suggestions.sql, the browser clock pinned to Wed 2026-09-30,
// and teardown in finally. No live LLM, no prod.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const pw = require_("/Users/mitchell/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");

const BASE = "http://localhost:3123";
const PSQL = "/opt/homebrew/opt/libpq/bin/psql";
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const DIR = path.dirname(new URL(import.meta.url).pathname);
const SEED = path.join(DIR, "seed-weekday-suggestions.sql");
const OUT = path.join(DIR, "shots-ws-verify");
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = "wsverify@local.test";
const PASSWORD = "review-pass-1234"; // local-only literal shared with the other harnesses

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const results = [];
const consoleErrors = [];
function check(name, actual, expected) {
  const pass = actual === expected;
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${actual}${pass ? "" : ` (expected ${expected})`}`);
}

// A bare -c query for reading scalars (single quotes only, no $$).
const psqlQuery = (sql) => execSync(`${PSQL} "${LOCAL_DB}" -v ON_ERROR_STOP=1 -tA -c "${sql.replace(/"/g, '\\"')}"`).toString().trim();

const TEARDOWN_SQL = `
delete from public.meal_plans where user_id=(select id from auth.users where email='wsverify@local.test');
delete from public.recipes where user_id=(select id from auth.users where email='wsverify@local.test');`;

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

  // Count regenerate_grocery_list RPC calls so we can prove Add the usuals fires none.
  let regenRpcCount = 0;
  await ctx.route(/rest\/v1\/rpc\/regenerate_grocery_list/, (route) => {
    regenRpcCount += 1;
    route.continue();
  });

  // meal_plan_items writes, POST only (inserts): "abort" holds the write 500ms so the
  // optimistic state is observable, then aborts it (proves rollback + the red error).
  let planMode = "normal";
  await ctx.route(/rest\/v1\/meal_plan_items/, async (route) => {
    if (route.request().method() === "POST" && planMode === "abort") {
      await sleep(500);
      await route.abort();
      return;
    }
    await route.continue();
  });

  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-30T12:00:00")); // a Wednesday; all seeded dates assume it
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // The abort probe deliberately fails a network request; the browser logs a
    // resource-load error for it. That is expected, not an app error.
    if (/Failed to load resource|net::ERR|ERR_FAILED/i.test(text)) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  // ---- sign in (sign-up fallback), then seed ----
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  if (await page.locator('input[type="email"]').count()) {
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator("button.primary-btn").click();
    try {
      await page.waitForSelector(".today-head, .tonight-card, .tonight-card-empty", { timeout: 8000 });
    } catch {
      await page.getByText("Need an account? Create one").click();
      await page.locator('input[type="email"]').fill(EMAIL);
      await page.locator('input[type="password"]').fill(PASSWORD);
      await page.locator("button.primary-btn").click();
      await page.waitForSelector(".today-head, .tonight-card, .tonight-card-empty", { timeout: 15000 });
    }
  }
  execSync(`${PSQL} "${LOCAL_DB}" -v ON_ERROR_STOP=1 -f "${SEED}"`, { stdio: "inherit" });
  const planId = (start) =>
    psqlQuery(
      `select id from public.meal_plans where user_id=(select id from auth.users where email='${EMAIL}') and start_date=date '${start}'`,
    );
  const HIST = planId("2026-05-15");
  const T1 = planId("2026-10-01");
  const T2 = planId("2026-10-08");

  // ---- helpers (the spec's block, plus small read/wait wrappers so one failure never hides the rest) ----
  const dayCard = (label) =>
    page.locator(".plan-dayrow").filter({ has: page.locator(".plan-dhead span", { hasText: new RegExp(`^${label}$`) }) });
  const gotoPlan = async (id) => {
    await page.goto(`${BASE}/plans?plan=${id}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".plan-dayrow", { timeout: 15000 });
    await page.waitForTimeout(800);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  };
  const openAdd = async (label) => {
    const card = dayCard(label);
    if (await card.locator(".plan-slot-add").count()) await card.locator(".plan-slot-add").click();
    else await card.locator(".plan-slot-more button").click();
    await page.waitForSelector(".plan-add-meal", { timeout: 8000 });
    await page.waitForTimeout(300);
  };
  const closeAdd = async () => {
    await page.locator(".plan-add-close").click();
    await page.waitForSelector(".plan-add-meal", { state: "detached", timeout: 8000 });
  };
  const texts = (selector) => page.locator(selector).evaluateAll((els) => els.map((el) => el.textContent.trim()));
  const usualNames = () => texts(".quick-add-usuals .quick-add-row > span:first-child");
  const resultNames = () => texts(".quick-add-results .quick-add-row > span:first-child");
  const searchBox = () => page.locator('.plan-add-meal input[placeholder="Search recipe..."]');
  const usualsButton = () => page.getByRole("button", { name: "Add the usuals" });
  const mealRows = (label) => dayCard(label).locator(".plan-slot:not(.empty)");

  const count = async (locator) => String(await locator.count());
  const readText = async (locator) => {
    try {
      return ((await locator.first().textContent({ timeout: 5000 })) ?? "").trim();
    } catch {
      return "<missing>";
    }
  };
  const dayText = async (label) => {
    try {
      return (await dayCard(label).first().textContent({ timeout: 5000 })) ?? "";
    } catch {
      return "<missing>";
    }
  };
  const waitForDetached = (selector) =>
    page.waitForSelector(selector, { state: "detached", timeout: 8000 }).catch(() => {});
  const waitForStatus = (message) =>
    page
      .waitForFunction((expected) => document.querySelector(".success-text")?.textContent?.trim() === expected, message, { timeout: 8000 })
      .catch(() => {});
  const shoot = async (name) => {
    // Park the pointer first: a click leaves it over a row, and a stray :hover border reads as a selected state.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 88 });
  };
  const scrollTop = () => page.evaluate(() => window.scrollTo(0, 0));
  const gotoShop = async (id) => {
    await page.goto(`${BASE}/grocery?plan=${id}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".shop-head", { timeout: 15000 });
    await page.waitForTimeout(800);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    await page.waitForSelector(".shop-stale-banner", { timeout: 10000 }).catch(() => {});
  };

  // ===================== A. T1: the add screen and Add the usuals =====================
  await gotoPlan(T1);
  await page.waitForSelector(".plan-usuals", { timeout: 5000 }).catch(() => {});
  check("A1 Add the usuals shows on T1 (button count)", await count(usualsButton()), "1");
  await scrollTop();
  await shoot("H3-card");
  check("A2 card line", await readText(page.locator(".plan-usuals-line")), "3 empty days have a usual meal.");
  check(
    "A3 card list",
    await readText(page.locator(".plan-usuals-list")),
    "Thu: Crispy Chicken Thighs, Fri: Sheet-Pan Salmon, Tue: Weeknight Tacos",
  );

  await openAdd("Oct 5"); // Monday: soup 2 of 2, below the bar
  check("A4 Monday shows no group", await count(page.locator(".quick-add-usuals")), "0");
  await searchBox().press("Enter");
  await waitForDetached(".plan-add-meal");
  check(
    "A5 Enter without a group closes the takeover and adds the top match to Oct 5",
    `${await count(page.locator(".plan-add-meal"))}/${await count(mealRows("Oct 5"))}`,
    "0/1",
  );

  await openAdd("Oct 7"); // Wednesday: stew is outside the 16-week window
  check("A6 Wednesday shows no group", await count(page.locator(".quick-add-usuals")), "0");
  await closeAdd();

  await openAdd("Oct 2"); // Friday: salmon and cod alternate
  check("A7 Friday group label", await readText(page.locator(".quick-add-usuals-label")), "Usually on Fridays");
  check("A8 Friday usuals, in rank order", (await usualNames()).join(" then "), "Sheet-Pan Salmon then Baked Cod");
  await scrollTop();
  await shoot("H2-fri-group");
  const fridayResults = await resultNames();
  check(
    "A9 Friday regular list has neither fish",
    String(!fridayResults.includes("Sheet-Pan Salmon") && !fridayResults.includes("Baked Cod")),
    "true",
  );
  await searchBox().fill("cod");
  await page.waitForTimeout(300);
  check("A10 a typed query hides the group", await count(page.locator(".quick-add-usuals")), "0");
  check("A11 the typed query finds Baked Cod", String((await resultNames()).includes("Baked Cod")), "true");
  await searchBox().fill("");
  await page.waitForTimeout(300);
  check("A12 clearing the query brings the group back", await count(page.locator(".quick-add-usuals")), "1");
  await closeAdd();

  await openAdd("Oct 4"); // Sunday, occupied by the eat-out: the "+ add another meal" path
  check("A13 Sunday group is the beans only (pasta is outside the last 8)", (await usualNames()).join(" then "), "Hurst 15-Bean Soup");
  await closeAdd();

  await openAdd("Oct 6"); // Tuesday: tacos on the only 3 planned Tuesdays
  check("A14 Tuesday group is the tacos (unplanned weeks do not dilute)", (await usualNames()).join(" then "), "Weeknight Tacos");
  await closeAdd();

  await openAdd("Oct 1"); // Thursday: chicken 8 of 8
  check("A15 Thursday group is the chicken", (await usualNames()).join(" then "), "Crispy Chicken Thighs");
  await scrollTop();
  await shoot("H1-thu-group");
  check("A16 Thursday regular list lacks the chicken", String(!(await resultNames()).includes("Crispy Chicken Thighs")), "true");
  await searchBox().press("Enter");
  await waitForDetached(".plan-add-meal");
  check("A17 Enter closes the takeover", await count(page.locator(".plan-add-meal")), "0");
  check(
    "A18 Oct 1 now shows the chicken",
    String((await mealRows("Oct 1").allTextContents()).join(" ").includes("Crispy Chicken Thighs")),
    "true",
  );
  check("A19 status line after Enter", await readText(page.locator(".success-text")), "Recipe added to plan.");
  check("A20 card line after Thursday filled", await readText(page.locator(".plan-usuals-line")), "2 empty days have a usual meal.");

  // Add the usuals under a failing write: optimistic first, then rolled back with the red error.
  planMode = "abort";
  await usualsButton().click();
  let optimisticSeen = false;
  try {
    await page.waitForFunction(
      () => {
        const row = [...document.querySelectorAll(".plan-dayrow")].find(
          (el) => el.querySelector(".plan-dhead span:last-child")?.textContent?.trim() === "Oct 2",
        );
        return Boolean(row && row.textContent.includes("Sheet-Pan Salmon"));
      },
      undefined,
      { timeout: 300 },
    );
    optimisticSeen = true;
  } catch {
    optimisticSeen = false;
  }
  check("A21 Oct 2 shows Sheet-Pan Salmon within 300ms (optimistic)", String(optimisticSeen), "true");
  await page.waitForTimeout(1200); // let the abort and rollback settle
  check("A22 Oct 2 no longer shows Sheet-Pan Salmon after the abort", String(!(await dayText("Oct 2")).includes("Sheet-Pan Salmon")), "true");
  check("A23 Oct 6 does not show Weeknight Tacos after the abort", String(!(await dayText("Oct 6")).includes("Weeknight Tacos")), "true");
  check("A24 the red error shows", await count(page.locator(".error-text")), "1");
  check("A25 Add the usuals is still offered", await count(usualsButton()), "1");

  // The same tap with the network back: one insert, F1 (a), success line.
  planMode = "normal";
  await usualsButton().click();
  await waitForStatus("Added 2 usual meals.");
  check("A26 status line", await readText(page.locator(".success-text")), "Added 2 usual meals.");
  await scrollTop();
  await shoot("H4-after-usuals");
  check("A27 Add the usuals is gone", await count(usualsButton()), "0");
  const friday = await dayText("Oct 2");
  check("A28 Oct 2 has the salmon and not the cod (F1 a)", String(friday.includes("Sheet-Pan Salmon") && !friday.includes("Baked Cod")), "true");
  check("A29 Oct 6 has the tacos", String((await dayText("Oct 6")).includes("Weeknight Tacos")), "true");
  check("A30 Oct 4 still has only the eat-out", await count(mealRows("Oct 4")), "1");
  check(
    "A31 T1 has 5 items",
    psqlQuery(`select count(*) from public.meal_plan_items where meal_plan_id='${T1}'`),
    "5",
  );
  check(
    "A32 T1 cook rows with meal_type dinner and multiplier 1",
    psqlQuery(
      `select count(*) from public.meal_plan_items where meal_plan_id='${T1}' and slot_type='cook' and meal_type='dinner' and serving_multiplier=1`,
    ),
    "4",
  );

  // ===================== B. T2: the Shop hand-off =====================
  await gotoShop(T2);
  check("B1 banner: no list yet", await readText(page.locator(".shop-stale-banner p")), "This plan doesn't have a grocery list yet.");
  await page.locator(".shop-stale-btn").click();
  await page.waitForSelector(".shop-item", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  check("B2 two grocery rows after Generate list", await count(page.locator(".shop-item")), "2");
  check("B3 banner gone after generate", await count(page.locator(".shop-stale-banner")), "0");
  const [v0, g0] = psqlQuery(`select version || '|' || groceries_version from public.meal_plans where id='${T2}'`).split("|");
  const regenAtB4 = regenRpcCount;
  check("B4 version equals groceries_version after the generate", v0 === g0 ? "equal" : `${v0} vs ${g0}`, "equal");
  console.log(`  (v0 = ${v0}; regenerate calls so far: ${regenAtB4})`);

  await gotoPlan(T2);
  await page.waitForSelector(".plan-usuals", { timeout: 5000 }).catch(() => {});
  check("B5 card line on T2", await readText(page.locator(".plan-usuals-line")), "4 empty days have a usual meal.");
  await usualsButton().click();
  await waitForStatus("Added 4 usual meals.");
  check("B6 status line", await readText(page.locator(".success-text")), "Added 4 usual meals.");
  check("B7 Add the usuals fired no regenerate call", String(regenRpcCount), String(regenAtB4));
  check(
    "B8 T2 version moved by one per cook row (v0 + 4)",
    psqlQuery(`select version from public.meal_plans where id='${T2}'`),
    String(Number(v0) + 4),
  );
  check("B9 T2 groceries_version is unchanged", psqlQuery(`select groceries_version from public.meal_plans where id='${T2}'`), g0);

  await gotoShop(T2);
  check("B10 banner: plan changed", await readText(page.locator(".shop-stale-banner p")), "Your meal plan changed since this list was made.");
  check("B11 button: Update list", await readText(page.locator(".shop-stale-btn")), "Update list");
  await scrollTop();
  await shoot("H5-shop-update");
  await page.locator(".shop-stale-btn").click();
  await page.waitForFunction(() => !document.querySelector(".shop-stale-banner"), undefined, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  check("B12 six grocery rows after Update list", await count(page.locator(".shop-item")), "6");

  // ===================== C. HIST: never backfill the past =====================
  await gotoPlan(HIST);
  // Wait for this plan's own meals to render, so a count of 0 cannot be a plan that simply had not loaded yet.
  await page.waitForSelector(".plan-slot:not(.empty)", { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  check("C1 no Add the usuals on a plan that is entirely in the past", await count(usualsButton()), "0");

  await ctx.close();
  await browser.close();

  const failed = results.filter((r) => !r).length;
  console.log(`\n=== ${results.length - failed}/${results.length} passed, ${consoleErrors.length} console errors ===`);
  if (consoleErrors.length) console.log("CONSOLE:", consoleErrors.join("\n"));
  if (failed || consoleErrors.length) process.exitCode = 1;
};

run()
  .catch((e) => { console.error("VERIFY FAILED:", e); process.exitCode = 1; })
  .finally(() => {
    try {
      const file = path.join(OUT, "_teardown.sql");
      fs.writeFileSync(file, TEARDOWN_SQL);
      execSync(`${PSQL} "${LOCAL_DB}" -v ON_ERROR_STOP=1 -f "${file}"`, { stdio: "inherit" });
    } catch (e) { console.error("teardown failed:", e.message); }
  });
