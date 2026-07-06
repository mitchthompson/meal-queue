// Shop staleness-banner verification (milestone 10, PR 1): proves the Shop page
// NEVER regenerates on load and instead surfaces staleness as a banner the user
// resolves explicitly, while the M4 state-preservation guarantee still holds
// across a user-triggered update. Local stack only. Lineage: verify-import-pass.mjs.
//
// Self-contained: seeds its OWN isolated current plan + two SHOPVERIFY recipes
// via psql (never the shared reflow seed plan), drives the full flow at 390px,
// and tears the data down at the end. No live LLM, no prod.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const require_ = createRequire(import.meta.url);
const pw = require_("/Users/mitchell/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core");

const BASE = "http://localhost:3123";
const PSQL = "/opt/homebrew/opt/libpq/bin/psql";
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), "shots-shop");
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const consoleErrors = [];
function check(name, actual, expected) {
  const pass = actual === expected;
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${actual}${pass ? "" : ` (expected ${expected})`}`);
}

// A bare -c query for reading scalars (no $$ dollar-quoting, so the shell
// leaves it alone). Setup/teardown use -f files below because their DO block
// contains $$, which the shell would otherwise expand to its PID.
const psqlQuery = (sql) => execSync(`${PSQL} "${LOCAL_DB}" -v ON_ERROR_STOP=1 -tA -c "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const psqlFile = (sql, name) => {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, sql);
  execSync(`${PSQL} "${LOCAL_DB}" -v ON_ERROR_STOP=1 -f "${file}"`, { stdio: "inherit" });
};

const SETUP_SQL = `
do $$
declare v_user uuid; r_base uuid; r_widget uuid; v_plan uuid;
begin
  select id into v_user from auth.users where email='reviewer@local.test';
  if v_user is null then raise exception 'reviewer@local.test missing (sign-in phase must run first)'; end if;
  delete from public.meal_plans where user_id=v_user and start_date=date '2026-07-05' and end_date=date '2026-07-11';
  delete from public.recipes where user_id=v_user and name in ('SHOPVERIFY Base Soup','SHOPVERIFY Widget');
  insert into public.recipes (user_id,name,base_servings) values (v_user,'SHOPVERIFY Base Soup',2) returning id into r_base;
  insert into public.ingredients (recipe_id,name,amount,unit_code,is_pantry_staple) values
    (r_base,'sv carrot',2,'item',false),(r_base,'sv celery',2,'item',false),(r_base,'sv broth',1,'cup',false);
  insert into public.recipes (user_id,name,base_servings) values (v_user,'SHOPVERIFY Widget',2) returning id into r_widget;
  insert into public.ingredients (recipe_id,name,amount,unit_code,is_pantry_staple) values (r_widget,'sv widget',1,'item',false);
  insert into public.meal_plans (user_id,start_date,end_date) values (v_user,date '2026-07-05',date '2026-07-11') returning id into v_plan;
  insert into public.meal_plan_items (meal_plan_id,plan_date,meal_type,slot_type,recipe_id) values (v_plan,date '2026-07-05','dinner','cook',r_base);
end $$;`;

const TEARDOWN_SQL = `
delete from public.meal_plans where user_id=(select id from auth.users where email='reviewer@local.test') and start_date=date '2026-07-05' and end_date=date '2026-07-11';
delete from public.recipes where user_id=(select id from auth.users where email='reviewer@local.test') and name in ('SHOPVERIFY Base Soup','SHOPVERIFY Widget');`;

const shopBanner = (page) => page.locator(".shop-stale-banner");
const shopItems = (page) => page.locator(".shop-item");
const itemByName = (page, name) => page.locator(".shop-item", { has: page.locator(".shop-name", { hasText: name }) });

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

  // Count regenerate_grocery_list RPC calls so we can prove none fire on load.
  let regenRpcCount = 0;
  await ctx.route(/rest\/v1\/rpc\/regenerate_grocery_list/, (route) => {
    regenRpcCount += 1;
    route.continue();
  });

  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
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

  const selectShopPlan = async () => {
    await page.goto(`${BASE}/grocery`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".shop-head", { timeout: 15000 });
    await page.waitForTimeout(800);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    if (await page.locator(".shop-plan-picker select").count()) {
      await page.locator(".shop-plan-picker select").selectOption(planId);
      await page.waitForTimeout(700);
    }
  };

  // ---- (a) fresh plan with items but no list -> "Generate list" banner ----
  await selectShopPlan();
  await page.waitForSelector(".shop-stale-banner", { timeout: 10000 });
  check("no regenerate RPC fired on load", String(regenRpcCount), "0");
  check("banner visible for un-generated plan", String(await shopBanner(page).count()), "1");
  check("banner text: no list yet", (await shopBanner(page).locator("p").textContent())?.trim(), "This plan doesn't have a grocery list yet.");
  check("button label: Generate list", (await page.locator(".shop-stale-btn").textContent())?.trim(), "Generate list");
  const bannerBg = await shopBanner(page).evaluate((el) => getComputedStyle(el).backgroundColor);
  check("banner is amber-soft", bannerBg, "rgb(246, 232, 207)");
  check("no list rows yet", String(await shopItems(page).count()), "0");
  await page.screenshot({ path: path.join(OUT, "S1-generate-banner.jpg"), type: "jpeg", quality: 85 });

  // ---- (b) generate -> rows appear, banner gone ----
  await page.locator(".shop-stale-btn").click();
  await page.waitForSelector(".shop-item", { timeout: 15000 });
  await page.waitForTimeout(600);
  check("3 grocery rows after generate", String(await shopItems(page).count()), "3");
  check("banner gone after generate", String(await shopBanner(page).count()), "0");
  check("generate fired exactly one regenerate RPC", String(regenRpcCount), "1");
  await page.screenshot({ path: path.join(OUT, "S2-generated-list.jpg"), type: "jpeg", quality: 85 });

  // ---- (c) check two items, then change the plan on the Plan page ----
  await itemByName(page, "sv carrot").locator(".shop-check").click();
  await itemByName(page, "sv celery").locator(".shop-check").click();
  await page.waitForTimeout(400);
  check("two items checked before plan change", String(await page.locator(".shop-item.done").count()), "2");

  // Plan page: select this plan (it is current, so the default filter shows it),
  // open quick-add on an empty day, add the SHOPVERIFY Widget cook meal.
  await page.goto(`${BASE}/plans`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".plan-head", { timeout: 15000 });
  await page.waitForTimeout(800);
  if (await page.locator(".plan-picker-row select").count()) {
    await page.locator(".plan-picker-row select").selectOption(planId);
    await page.waitForTimeout(700);
  }
  // An empty day shows a ".plan-slot-add" (+) button; open its quick-add.
  await page.locator(".plan-slot-add").first().click();
  await page.waitForSelector(".quick-add-card", { timeout: 8000 });
  if (!(await page.locator('.quick-add-card input[placeholder="Search recipe..."]').count())) {
    await page.locator(".quick-add-card .pill", { hasText: "Cook" }).click();
  }
  await page.locator('.quick-add-card input[placeholder="Search recipe..."]').fill("SHOPVERIFY Widget");
  await page.waitForTimeout(500);
  await page.locator(".quick-add-row", { hasText: "SHOPVERIFY Widget" }).first().click();
  await page.waitForTimeout(900); // let the insert + plan version bump settle

  // ---- return to Shop -> "Update list" banner, list unchanged, checks intact ----
  const regenBeforeReturn = regenRpcCount;
  await selectShopPlan();
  await page.waitForSelector(".shop-stale-banner", { timeout: 10000 });
  check("no regenerate RPC on stale reload", String(regenRpcCount), String(regenBeforeReturn));
  check("banner visible again after plan change", String(await shopBanner(page).count()), "1");
  check("banner text: plan changed", (await shopBanner(page).locator("p").textContent())?.trim(), "Your meal plan changed since this list was made.");
  check("button label: Update list", (await page.locator(".shop-stale-btn").textContent())?.trim(), "Update list");
  check("list unchanged while stale (still 3 rows)", String(await shopItems(page).count()), "3");
  check("two checks intact while stale", String(await page.locator(".shop-item.done").count()), "2");
  await page.screenshot({ path: path.join(OUT, "S3-update-banner.jpg"), type: "jpeg", quality: 85 });

  // ---- (d) tap Update -> banner gone, new item present, checks survived ----
  await page.locator(".shop-stale-btn").click();
  await page.waitForFunction(() => !document.querySelector(".shop-stale-banner"), { timeout: 15000 });
  await page.waitForTimeout(600);
  check("banner gone after update", String(await shopBanner(page).count()), "0");
  check("widget row present after update", String(await itemByName(page, "sv widget").count()), "1");
  check("four rows after update", String(await shopItems(page).count()), "4");
  check("two checks survived the update (M4 guarantee)", String(await page.locator(".shop-item.done").count()), "2");
  check("sv carrot still checked", await itemByName(page, "sv carrot").locator(".shop-check").getAttribute("aria-pressed"), "true");
  check("sv celery still checked", await itemByName(page, "sv celery").locator(".shop-check").getAttribute("aria-pressed"), "true");
  await page.screenshot({ path: path.join(OUT, "S4-updated-list.jpg"), type: "jpeg", quality: 85 });

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
