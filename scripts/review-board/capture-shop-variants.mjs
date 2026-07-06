// SB1 board captures (milestone 10 PR 1): the Shop staleness banner in its
// "Update list" (stale-with-list) state, in two direction mocks —
//   A: amber, as coded (accent-soft / accent-deep / accent)
//   B: quiet neutral (surface-muted bg, muted text) via CSS injection
// Local stack only; self-contained seed + teardown. Lineage: verify-shop-pass.mjs.
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

const SETUP_SQL = `
do $$
declare v_user uuid; r_base uuid; r_widget uuid; v_plan uuid;
begin
  select id into v_user from auth.users where email='reviewer@local.test';
  if v_user is null then raise exception 'reviewer@local.test missing'; end if;
  delete from public.meal_plans where user_id=v_user and start_date=date '2026-07-05' and end_date=date '2026-07-11';
  delete from public.recipes where user_id=v_user and name in ('SHOPVERIFY Base Soup','SHOPVERIFY Widget');
  insert into public.recipes (user_id,name,base_servings) values (v_user,'SHOPVERIFY Base Soup',2) returning id into r_base;
  insert into public.ingredients (recipe_id,name,amount,unit_code,is_pantry_staple) values
    (r_base,'chicken thighs',2,'lb',false),(r_base,'yellow onion',2,'item',false),(r_base,'chicken broth',4,'cup',false);
  insert into public.recipes (user_id,name,base_servings) values (v_user,'SHOPVERIFY Widget',2) returning id into r_widget;
  insert into public.ingredients (recipe_id,name,amount,unit_code,is_pantry_staple) values (r_widget,'baby spinach',1,'item',false);
  insert into public.meal_plans (user_id,start_date,end_date) values (v_user,date '2026-07-05',date '2026-07-11') returning id into v_plan;
  insert into public.meal_plan_items (meal_plan_id,plan_date,meal_type,slot_type,recipe_id) values (v_plan,date '2026-07-05','dinner','cook',r_base);
end $$;`;

const TEARDOWN_SQL = `
delete from public.meal_plans where user_id=(select id from auth.users where email='reviewer@local.test') and start_date=date '2026-07-05' and end_date=date '2026-07-11';
delete from public.recipes where user_id=(select id from auth.users where email='reviewer@local.test') and name in ('SHOPVERIFY Base Soup','SHOPVERIFY Widget');`;

// Variant B — quiet neutral (per spec §3d): surface-muted fill, muted text,
// hairline border; the button stays a clear action but drops the amber.
const NEUTRAL_CSS = `
  .shop-stale-banner{background:var(--color-surface-muted)!important;color:var(--muted)!important;border-color:var(--line)!important}
  .shop-stale-btn{background:var(--ink)!important;color:var(--color-surface)!important}
`;

const psqlFile = (sql, name) => {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, sql);
  execSync(`${PSQL} "${LOCAL_DB}" -v ON_ERROR_STOP=1 -f "${file}"`, { stdio: "inherit" });
};
const psqlQuery = (sql) => execSync(`${PSQL} "${LOCAL_DB}" -v ON_ERROR_STOP=1 -tA -c "${sql.replace(/"/g, '\\"')}"`).toString().trim();

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

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  if (await page.locator('input[type="email"]').count()) {
    await page.locator('input[type="email"]').fill("reviewer@local.test");
    await page.locator('input[type="password"]').fill("review-pass-1234");
    await page.locator("button.primary-btn").click();
    await page.waitForSelector(".today-head, .tonight-card, .tonight-card-empty", { timeout: 15000 });
  }
  psqlFile(SETUP_SQL, "_setup.sql");
  const planId = psqlQuery(
    "select id from public.meal_plans where user_id=(select id from auth.users where email='reviewer@local.test') and start_date=date '2026-07-05' and end_date=date '2026-07-11'",
  );

  const gotoShop = async () => {
    await page.goto(`${BASE}/grocery`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".shop-head", { timeout: 15000 });
    await page.waitForTimeout(700);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    if (await page.locator(".shop-plan-picker select").count()) {
      await page.locator(".shop-plan-picker select").selectOption(planId);
      await page.waitForTimeout(600);
    }
  };

  // Generate the list, then bump the plan version so it goes stale-WITH-list.
  await gotoShop();
  await page.locator(".shop-stale-btn").click();
  await page.waitForSelector(".shop-item", { timeout: 15000 });
  await page.waitForTimeout(400);

  await page.goto(`${BASE}/plans`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".plan-head", { timeout: 15000 });
  await page.waitForTimeout(700);
  if (await page.locator(".plan-picker-row select").count()) {
    await page.locator(".plan-picker-row select").selectOption(planId);
    await page.waitForTimeout(600);
  }
  await page.locator(".plan-slot-add").first().click();
  await page.waitForSelector(".quick-add-card", { timeout: 8000 });
  if (!(await page.locator('.quick-add-card input[placeholder="Search recipe..."]').count())) {
    await page.locator(".quick-add-card .pill", { hasText: "Cook" }).click();
  }
  await page.locator('.quick-add-card input[placeholder="Search recipe..."]').fill("SHOPVERIFY Widget");
  await page.waitForTimeout(400);
  await page.locator(".quick-add-row", { hasText: "SHOPVERIFY Widget" }).first().click();
  await page.waitForTimeout(800);

  // Back to Shop — now the "Update list" amber banner sits above the list.
  await gotoShop();
  await page.waitForSelector(".shop-stale-banner", { timeout: 10000 });
  await page.waitForTimeout(300);

  const shoot = async (tag) => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    // in-situ: banner above the first grocery rows
    await page.screenshot({ path: path.join(OUT, `SB1-${tag}-context.jpg`), type: "jpeg", quality: 88, clip: { x: 0, y: 0, width: 390, height: 520 } });
    // tight: the banner itself
    await page.locator(".shop-stale-banner").screenshot({ path: path.join(OUT, `SB1-${tag}-banner.jpg`), type: "jpeg", quality: 92 });
  };

  await shoot("A-amber");
  await page.addStyleTag({ content: NEUTRAL_CSS });
  await page.waitForTimeout(200);
  await shoot("B-neutral");

  await ctx.close();
  await browser.close();
  console.log("captured SB1 variants ->", OUT);
  for (const f of ["SB1-A-amber-context.jpg", "SB1-A-amber-banner.jpg", "SB1-B-neutral-context.jpg", "SB1-B-neutral-banner.jpg"]) {
    console.log(fs.existsSync(path.join(OUT, f)) ? `  ok ${f}` : `  MISSING ${f}`);
  }
};

run()
  .catch((e) => { console.error("CAPTURE FAILED:", e); process.exitCode = 1; })
  .finally(() => {
    try {
      const file = path.join(OUT, "_teardown.sql");
      fs.writeFileSync(file, TEARDOWN_SQL);
      execSync(`${PSQL} "${LOCAL_DB}" -v ON_ERROR_STOP=1 -f "${file}"`, { stdio: "inherit" });
    } catch (e) { console.error("teardown failed:", e.message); }
  });
