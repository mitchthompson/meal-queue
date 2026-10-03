// Milestone 17 board captures (round WS): direction mocks for weekday suggestions
// and "Add the usuals", injected into the running app BEFORE any UI code exists.
//   WS1  group look in the add-meal takeover (A labeled list, B soft teal panel)
//   WS2  Add the usuals placement (A card above the first day, B header button, C card at the bottom)
//   WS3  card look (A soft teal button, B full-width teal button)
//   WS4  feedback after the tap (A green status line at the top, B confirmation in place of the card)
// Local stack only. Dedicated user wsverify@local.test (habits read ALL of a user's
// plans, so the shared reviewer seeds would skew exact counts). The browser clock
// is pinned to Wed 2026-09-30 so the seeded history is past and the habit window
// is 2026-06-10 .. 2026-09-29. Lineage: verify-optimistic-pass.mjs.
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
const OUT = path.join(DIR, "shots-ws");
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = "wsverify@local.test";
const PASSWORD = "review-pass-1234"; // local-only literal shared with the other harnesses

const psqlQuery = (sql) => execSync(`${PSQL} "${LOCAL_DB}" -v ON_ERROR_STOP=1 -tA -c "${sql.replace(/"/g, '\\"')}"`).toString().trim();

const TEARDOWN_SQL = `
delete from public.meal_plans where user_id=(select id from auth.users where email='wsverify@local.test');
delete from public.recipes where user_id=(select id from auth.users where email='wsverify@local.test');`;

// Base CSS from spec section 8 (takeover group + card, the WS1 A and WS3 A looks).
// These classes are not in globals.css yet, so every page load gets them injected.
const TAKEOVER_BASE_CSS = `
.quick-add-usuals {
  display: grid;
  gap: 0.4rem; /* = .quick-add-results */
}

.quick-add-usuals-label {
  margin: 0;
  font-size: 0.72rem; /* = .plan-dhead */
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
`;

const CARD_BASE_CSS = `
.plan-usuals {
  margin-top: 0.7rem; /* = .plan-dayrow */
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem; /* = .today-next */
  padding: 0.7rem 0.9rem; /* = .plan-slot */
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px; /* = .plan-dayrow */
}

.plan-usuals-text {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.15rem; /* = .plan-slot-main */
}

.plan-usuals-line {
  margin: 0;
  font-size: 0.9rem; /* = .today-next-line */
  font-weight: 600;
}

.plan-usuals-list {
  margin: 0;
  color: var(--muted); /* = .plan-slot-sub */
  font-size: 0.75rem;
  font-weight: 500;
}

.plan-usuals-btn {
  flex-shrink: 0;
  min-height: 44px; /* house touch target, = .quick-add-row */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 12px; /* = .today-next-btn */
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  font-weight: 700;
  background: var(--color-primary-soft);
  color: var(--brand);
  cursor: pointer;
}
`;

const BASE_CSS = TAKEOVER_BASE_CSS + CARD_BASE_CSS;

// WS1 B: the soft teal panel. Injected after the base block, so it wins.
const WS1_B_CSS = `
.quick-add-usuals {
  padding: 0.55rem; /* = .quick-add-card */
  border-radius: 12px; /* inner-block radius convention */
  background: var(--color-primary-soft);
}

.quick-add-usuals-label {
  color: var(--brand);
}
`;

// WS3 B: the full-width teal button. Sits on top of the injected A rules, so it
// resets the card skin explicitly.
const WS3_B_CSS = `
.plan-usuals { display: grid; gap: 0.45rem; padding: 0; background: none; border: 0; }
.plan-usuals-btn { width: 100%; padding: 0.9rem; font-size: 1rem; background: var(--brand); color: var(--surface); }
`;

const CARD_COPY = {
  line: "3 empty days have a usual meal.",
  list: "Thu: Crispy Chicken Thighs, Fri: Sheet-Pan Salmon, Tue: Weeknight Tacos",
};

const consoleErrors = [];

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

  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date("2026-09-30T12:00:00"));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
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
  const T1 = planId("2026-10-01");

  // ---- helpers ----
  const settle = (ms = 250) => page.waitForTimeout(ms);
  // Park the pointer in the corner first: a click leaves it over whatever sits at
  // that spot, and a stray :hover border on a recipe row reads as a selected state.
  const parkPointer = async () => {
    await page.mouse.move(0, 0);
    await page.waitForTimeout(120);
  };
  const shoot = async (name) => {
    await parkPointer();
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 88 });
  };
  const shootEl = async (selector, name) => {
    await parkPointer();
    await page.locator(selector).first().screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 92 });
  };
  const scrollTop = () => page.evaluate(() => window.scrollTo(0, 0));
  const scrollBottom = () =>
    page.evaluate(() => window.scrollTo(0, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)));

  const gotoPlan = async (id) => {
    await page.goto(`${BASE}/plans?plan=${id}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".plan-dayrow", { timeout: 15000 });
    await page.waitForTimeout(800);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    await page.addStyleTag({ content: BASE_CSS });
  };
  const openAdd = async (label) => {
    await page.getByRole("button", { name: `Add a meal on ${label}`, exact: true }).click();
    await page.waitForSelector(".plan-add-meal", { timeout: 8000 });
    await settle(400);
  };
  const closeAdd = async () => {
    await page.locator(".plan-add-close").click();
    await page.waitForSelector(".plan-add-meal", { state: "detached", timeout: 8000 });
  };

  // The mock group: directly after the search input; same-named rows leave the regular list.
  const injectGroup = (label, rows) =>
    page.evaluate(
      ({ label, rows }) => {
        const input = document.querySelector('.plan-add-meal input[placeholder="Search recipe..."]');
        const group = document.createElement("div");
        group.className = "quick-add-usuals";
        group.setAttribute("role", "group");
        group.innerHTML = `<p class="quick-add-usuals-label">${label}</p>` + rows
          .map(([name, serves]) => `<button class="quick-add-row" type="button"><span>${name}</span><span class="muted">Serves ${serves}</span></button>`)
          .join("");
        input.insertAdjacentElement("afterend", group);
        for (const row of document.querySelectorAll(".quick-add-results .quick-add-row")) {
          if (rows.some(([name]) => row.querySelector("span")?.textContent === name)) row.remove();
        }
      },
      { label, rows },
    );

  // The mock card: above the first day row ("top") or just above Shop this plan ("bottom").
  const insertCard = (where) =>
    page.evaluate(
      ({ line, list, where }) => {
        const card = document.createElement("div");
        card.className = "plan-usuals";
        card.innerHTML = `<div class="plan-usuals-text"><p class="plan-usuals-line">${line}</p><p class="plan-usuals-list">${list}</p></div><button class="plan-usuals-btn" type="button">Add the usuals</button>`;
        const anchor = where === "bottom" ? document.querySelector(".plan-generate") : document.querySelector(".plan-dayrow");
        anchor.insertAdjacentElement("beforebegin", card);
      },
      { ...CARD_COPY, where },
    );
  const removeCard = () => page.evaluate(() => document.querySelectorAll(".plan-usuals").forEach((el) => el.remove()));

  // ---- WS1: group look. Thursday has one usual, Friday has two that take turns. ----
  await gotoPlan(T1);
  await openAdd("Oct 1");
  await injectGroup("Usually on Thursdays", [["Crispy Chicken Thighs", 4]]);
  await settle();
  await shoot("WS1-A-thu");
  let variantStyle = await page.addStyleTag({ content: WS1_B_CSS });
  await settle();
  await shoot("WS1-B-thu");
  await variantStyle.evaluate((el) => el.remove());
  await closeAdd();

  await openAdd("Oct 2");
  await injectGroup("Usually on Fridays", [["Sheet-Pan Salmon", 2], ["Baked Cod", 2]]);
  await settle();
  await shoot("WS1-A-fri");
  variantStyle = await page.addStyleTag({ content: WS1_B_CSS });
  await settle();
  await shoot("WS1-B-fri");
  await variantStyle.evaluate((el) => el.remove());
  await closeAdd();

  // ---- WS2 and WS3: card placement and look ----
  await gotoPlan(T1);
  await insertCard("top");
  await settle();
  await scrollTop();
  await shoot("WS2-A"); // also WS3 A in context
  await shootEl(".plan-usuals", "WS3-A-card");

  // WS2 B: a header button instead of a card.
  await removeCard();
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.className = "ghost-btn";
    button.type = "button";
    button.textContent = "Add the usuals";
    document.querySelector(".plan-head-meta .ghost-btn").insertAdjacentElement("beforebegin", button);
  });
  await settle();
  await scrollTop();
  await shoot("WS2-B");

  // WS2 C: the card just above Shop this plan, scrolled into view.
  await page.evaluate(() => {
    const mock = [...document.querySelectorAll(".plan-head-meta .ghost-btn")].find((el) => el.textContent === "Add the usuals");
    mock?.remove();
  });
  await insertCard("bottom");
  await scrollBottom();
  await settle();
  await shoot("WS2-C");

  // WS3 B: back above the first day row, with the full-width button override.
  await removeCard();
  await insertCard("top");
  await scrollTop();
  variantStyle = await page.addStyleTag({ content: WS3_B_CSS });
  await settle();
  await shoot("WS3-B");
  await shootEl(".plan-usuals", "WS3-B-card");
  await variantStyle.evaluate((el) => el.remove());

  // ---- WS4: feedback after the tap. Write the three real rows, then mock the message. ----
  psqlQuery(
    `insert into public.meal_plan_items (meal_plan_id, plan_date, meal_type, slot_type, recipe_id) select '${T1}', v.d::date, 'dinner', 'cook', r.id from (values ('2026-10-01', 'Crispy Chicken Thighs'), ('2026-10-02', 'Sheet-Pan Salmon'), ('2026-10-06', 'Weeknight Tacos')) as v(d, name) join public.recipes r on r.name = v.name and r.user_id = (select id from auth.users where email = '${EMAIL}')`,
  );
  await gotoPlan(T1);

  // WS4 A: the green status line where every other plan action puts it.
  await page.evaluate(() => {
    const status = document.createElement("p");
    status.className = "success-text";
    status.setAttribute("role", "status");
    status.textContent = "Added 3 usual meals.";
    const anchor = document.querySelector(".plan-picker-row") ?? document.querySelector(".plan-filter-row");
    anchor.insertAdjacentElement("afterend", status);
  });
  await settle();
  await scrollTop();
  await shoot("WS4-A");

  // WS4 B: the confirmation sits where the card was.
  await page.evaluate(() => {
    document.querySelector('p.success-text[role="status"]')?.remove();
    const card = document.createElement("div");
    card.className = "plan-usuals";
    card.innerHTML = `<p class="plan-usuals-line success-text">Added 3 usual meals.</p>`;
    document.querySelector(".plan-dayrow").insertAdjacentElement("beforebegin", card);
  });
  await settle();
  await scrollTop();
  await shoot("WS4-B");

  await ctx.close();
  await browser.close();

  console.log("captured WS variants ->", OUT);
  let missing = 0;
  for (const name of [
    "WS1-A-thu",
    "WS1-B-thu",
    "WS1-A-fri",
    "WS1-B-fri",
    "WS2-A",
    "WS2-B",
    "WS2-C",
    "WS3-A-card",
    "WS3-B",
    "WS3-B-card",
    "WS4-A",
    "WS4-B",
  ]) {
    const present = fs.existsSync(path.join(OUT, `${name}.jpg`));
    if (!present) missing += 1;
    console.log(present ? `  ok ${name}.jpg` : `  MISSING ${name}.jpg`);
  }
  console.log(`console errors: ${consoleErrors.length}`);
  if (consoleErrors.length) console.log("CONSOLE:", consoleErrors.join("\n"));
  if (missing) process.exitCode = 1;
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
