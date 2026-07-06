// Optimistic-writes latency probe (milestone 10, PR 2): proves item-level
// mutations render their result BEFORE the network round trip resolves, and
// roll back visibly (with the red StatusMessage) when the write fails. Drives
// a grocery check and a plan remove under a 1500ms-delayed network and under a
// hard abort. Local stack only. Lineage: verify-shop-pass.mjs.
//
// Self-contained: seeds its OWN isolated current plan + two OPTVERIFY recipes
// via psql, generates the grocery list through the UI, runs the probes at
// 390px, and tears the data down at the end. No live LLM, no prod.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const pw = require_("/Users/mitchell/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");

const BASE = "http://localhost:3123";
const PSQL = "/opt/homebrew/opt/libpq/bin/psql";
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "shots-optimistic");
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const results = [];
const consoleErrors = [];
function check(name, actual, expected) {
  const pass = actual === expected;
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${actual}${pass ? "" : ` (expected ${expected})`}`);
}

const psqlQuery = (sql) => execSync(`${PSQL} "${LOCAL_DB}" -v ON_ERROR_STOP=1 -tA -c "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const psqlFile = (sql, name) => {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, sql);
  execSync(`${PSQL} "${LOCAL_DB}" -v ON_ERROR_STOP=1 -f "${file}"`, { stdio: "inherit" });
};

const SETUP_SQL = `
do $$
declare v_user uuid; r_soup uuid; r_salad uuid; v_plan uuid;
begin
  select id into v_user from auth.users where email='reviewer@local.test';
  if v_user is null then raise exception 'reviewer@local.test missing (sign-in phase must run first)'; end if;
  delete from public.meal_plans where user_id=v_user and start_date=date '2026-07-05' and end_date=date '2026-07-11';
  delete from public.recipes where user_id=v_user and name in ('OPTVERIFY Soup','OPTVERIFY Salad');
  insert into public.recipes (user_id,name,base_servings) values (v_user,'OPTVERIFY Soup',2) returning id into r_soup;
  insert into public.ingredients (recipe_id,name,amount,unit_code,is_pantry_staple) values
    (r_soup,'opt broth',1,'cup',false),(r_soup,'opt carrot',2,'item',false),(r_soup,'opt celery',2,'item',false);
  insert into public.recipes (user_id,name,base_servings) values (v_user,'OPTVERIFY Salad',2) returning id into r_salad;
  insert into public.ingredients (recipe_id,name,amount,unit_code,is_pantry_staple) values (r_salad,'opt lettuce',1,'item',false);
  insert into public.meal_plans (user_id,start_date,end_date) values (v_user,date '2026-07-05',date '2026-07-11') returning id into v_plan;
  insert into public.meal_plan_items (meal_plan_id,plan_date,meal_type,slot_type,recipe_id) values
    (v_plan,date '2026-07-05','dinner','cook',r_soup),
    (v_plan,date '2026-07-06','dinner','cook',r_salad);
end $$;`;

const TEARDOWN_SQL = `
delete from public.meal_plans where user_id=(select id from auth.users where email='reviewer@local.test') and start_date=date '2026-07-05' and end_date=date '2026-07-11';
delete from public.recipes where user_id=(select id from auth.users where email='reviewer@local.test') and name in ('OPTVERIFY Soup','OPTVERIFY Salad');`;

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

  // A single interceptor per table with a mode switch flipped by the probes:
  //  - "delay": hold the write 1500ms, then let it through (proves optimism)
  //  - "abort": hold 500ms (so the optimistic state is observable) then abort
  //    (proves rollback + error). GET/POST loads are never touched.
  let groceryMode = "normal";
  await ctx.route(/rest\/v1\/grocery_list_items/, async (route) => {
    if (route.request().method() === "PATCH") {
      if (groceryMode === "abort") { await sleep(500); await route.abort(); return; }
      if (groceryMode === "delay") { await sleep(1500); }
    }
    await route.continue();
  });
  let planMode = "normal";
  await ctx.route(/rest\/v1\/meal_plan_items/, async (route) => {
    if (route.request().method() === "DELETE") {
      if (planMode === "abort") { await sleep(500); await route.abort(); return; }
      if (planMode === "delay") { await sleep(1500); }
    }
    await route.continue();
  });

  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // The abort probes deliberately fail network requests; the browser logs a
    // resource-load error for each. Those are expected, not app errors.
    if (/Failed to load resource|net::ERR|ERR_FAILED/i.test(text)) return;
    consoleErrors.push(text);
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  // ---- sign in (sign-up fallback), then seed isolated data ----
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
  psqlFile(SETUP_SQL, "_setup.sql");
  const planId = psqlQuery(
    "select id from public.meal_plans where user_id=(select id from auth.users where email='reviewer@local.test') and start_date=date '2026-07-05' and end_date=date '2026-07-11'",
  );

  // ---- Shop: select the plan and generate the list ----
  await page.goto(`${BASE}/grocery`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".shop-head", { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  if (await page.locator(".shop-plan-picker select").count()) {
    await page.locator(".shop-plan-picker select").selectOption(planId);
    await page.waitForTimeout(700);
  }
  await page.waitForSelector(".shop-stale-btn", { timeout: 10000 });
  await page.locator(".shop-stale-btn").click();
  await page.waitForSelector(".shop-item", { timeout: 15000 });
  await page.waitForTimeout(600);
  check("grocery list generated (4 rows)", String(await page.locator(".shop-item").count()), "4");

  const firstCheck = () => page.locator(".shop-item").first().locator(".shop-check");
  const secondCheck = () => page.locator(".shop-item").nth(1).locator(".shop-check");

  // ---- (1) grocery check under a 1500ms delay -> optimistic, no error ----
  groceryMode = "delay";
  check("first item starts unchecked", await firstCheck().getAttribute("aria-pressed"), "false");
  const t0 = Date.now();
  await firstCheck().click();
  let checkFast = false;
  try {
    await page.waitForFunction(
      () => document.querySelector(".shop-item .shop-check")?.getAttribute("aria-pressed") === "true",
      undefined,
      { timeout: 200 },
    );
    checkFast = true;
  } catch { checkFast = false; }
  console.log(`  (grocery optimistic check observed in ${Date.now() - t0}ms)`);
  check("grocery check renders optimistically <200ms (net delayed 1500ms)", String(checkFast), "true");
  check("no error while the delayed write is in flight", String(await page.locator(".error-text").count()), "0");
  await page.waitForTimeout(1800); // let the delayed PATCH resolve
  check("grocery check persists after the delayed response lands", await firstCheck().getAttribute("aria-pressed"), "true");
  await page.screenshot({ path: path.join(OUT, "O1-grocery-delay.jpg"), type: "jpeg", quality: 85 });

  // ---- (2) grocery check under an abort -> optimistic then rollback + error ----
  groceryMode = "abort";
  check("second item starts unchecked", await secondCheck().getAttribute("aria-pressed"), "false");
  await secondCheck().click();
  let checkOptimisticBeforeAbort = false;
  try {
    await page.waitForFunction(
      () => document.querySelectorAll(".shop-item")[1]?.querySelector(".shop-check")?.getAttribute("aria-pressed") === "true",
      undefined,
      { timeout: 300 },
    );
    checkOptimisticBeforeAbort = true;
  } catch { checkOptimisticBeforeAbort = false; }
  check("grocery check shows optimistically before the abort", String(checkOptimisticBeforeAbort), "true");
  await page.waitForTimeout(1200); // let the abort + rollback settle
  check("grocery check reverts to unchecked after abort", await secondCheck().getAttribute("aria-pressed"), "false");
  check("red error appears after grocery abort", String(await page.locator(".error-text").count()), "1");
  await page.screenshot({ path: path.join(OUT, "O2-grocery-abort.jpg"), type: "jpeg", quality: 85 });
  groceryMode = "normal";

  // ---- Plan: select the plan, both seeded meals present ----
  await page.goto(`${BASE}/plans`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".plan-head", { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  if (await page.locator(".plan-picker-row select").count()) {
    await page.locator(".plan-picker-row select").selectOption(planId);
    await page.waitForTimeout(800);
  }
  const itemRows = () => page.locator(".plan-slot:not(.empty)");
  const startCount = await itemRows().count();
  check("two seeded meals visible on the plan", String(startCount), "2");

  // ---- (3) plan remove under a 1500ms delay -> optimistic, no error ----
  planMode = "delay";
  const p0 = Date.now();
  await itemRows().first().locator("button.text-btn", { hasText: "remove" }).click();
  let removeFast = false;
  try {
    await page.waitForFunction(
      (n) => document.querySelectorAll(".plan-slot:not(.empty)").length === n,
      startCount - 1,
      { timeout: 200 },
    );
    removeFast = true;
  } catch { removeFast = false; }
  console.log(`  (plan optimistic remove observed in ${Date.now() - p0}ms)`);
  check("plan remove renders optimistically <200ms (net delayed 1500ms)", String(removeFast), "true");
  check("no error while the delayed delete is in flight", String(await page.locator(".error-text").count()), "0");
  await page.waitForTimeout(1800); // let the delayed DELETE resolve
  check("plan item stays removed after the delayed response lands", String(await itemRows().count()), String(startCount - 1));
  await page.screenshot({ path: path.join(OUT, "O3-plan-delay.jpg"), type: "jpeg", quality: 85 });

  // ---- (4) plan remove under an abort -> optimistic then rollback + error ----
  planMode = "abort";
  const beforeAbort = await itemRows().count();
  await itemRows().first().locator("button.text-btn", { hasText: "remove" }).click();
  let removeOptimisticBeforeAbort = false;
  try {
    await page.waitForFunction(
      (n) => document.querySelectorAll(".plan-slot:not(.empty)").length === n,
      beforeAbort - 1,
      { timeout: 300 },
    );
    removeOptimisticBeforeAbort = true;
  } catch { removeOptimisticBeforeAbort = false; }
  check("plan item disappears optimistically before the abort", String(removeOptimisticBeforeAbort), "true");
  await page.waitForTimeout(1200); // let the abort + rollback settle
  check("plan item reappears after abort", String(await itemRows().count()), String(beforeAbort));
  check("red error appears after plan abort", String(await page.locator(".error-text").count()), "1");
  await page.screenshot({ path: path.join(OUT, "O4-plan-abort.jpg"), type: "jpeg", quality: 85 });

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
