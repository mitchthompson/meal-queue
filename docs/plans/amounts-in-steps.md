# Milestone 18: Amounts in the steps (and retire cook mode): build spec for handoff

**Status (2026-10-02): builder-ready. Fork W1 was answered by the owner on
2026-10-02: (a), no wake lock. Board pins AS1 and AS2 are decided in PR 1's
own board round (Phase 1).**
Supersedes milestone 16 ([plans/step-ingredients.md](step-ingredients.md)),
which is kept only for its `save_recipe` research.

**Audience:** a lower-capability builder model. Everything is spelled out.
Follow it literally. Where it says STOP, stop and report to the orchestrator.
Where a value or behavior is not specified here, do not invent it: flag it in
your report (the orchestrator records it in `docs/design-flags.md`).

**Ownership:** the builder does Phases 0 to 10 on the local stack only. The
orchestrator does Phases 11 and 12 (everything that reads or writes prod), all
commits, PRs, merges, and every `docs/` edit (Section 10).

Line numbers below were verified against `main` at `0dcabab` (PR #40) on
2026-10-02. Milestone 17 is planned to merge first and will move lines in
shared files (it will likely add CSS to `app/globals.css`). Always locate an
edit by the quoted code; use the line number only as a hint.

---

## 1. Context (why)

The owner stopped using the step-by-step cook screen (`components/cook-mode.tsx`)
and cooks from the recipe page, where all steps are visible at once. The
friction there: a step says "add the pepper" while the amount (2 tsp) is only in
the ingredient list, so they scroll back up mid-cook. They want the amounts in
the steps.

Evidence (prod, read-only, 2026-10-02, gathered by the orchestrator): 35
recipes, 25 with `instructions_raw` (imported); 0 of 185 cooked plan items use
a `serving_multiplier` other than 1, so the household cooks at base servings.

How the data works today (confirmed in source):

- `recipe_steps` (`supabase/schema.sql:54-61`): `id uuid` PK, `recipe_id` FK
  (cascade), `step_number int > 0`, `body text not null`, `created_at`,
  `unique (recipe_id, step_number)`. No `updated_at` column, and **no trigger
  of any kind** on this table (the only triggers in the schema are on
  `user_settings`, `recipes`, `meal_plans`, and `meal_plan_items`,
  `schema.sql:159-172, 532-535, 562-565, 609-612`). RLS is recipe-scoped
  (`schema.sql:192-205`).
- `save_recipe` (`schema.sql:309-446`) replaces a recipe wholesale: it updates
  the `recipes` row, captures an ingredient signature (`369-380`), deletes ALL
  ingredients, steps, and tag links (`382-384`), re-inserts them with fresh ids
  (`386-418`), and bumps the version of every plan using the recipe when the
  ingredient signature changed (`420-442`).
- The recipe page (`app/recipes/[id]/page.tsx`) scales only the ingredient list
  with the "Preview servings" stepper (`scaleFactor`, `68-73`; applied at
  `255-260`). Steps render as plain text (`275-282`).
- Imported recipes store "to taste" / "pinch" / "as needed" as `amount: 0`
  (`lib/import/prompt.ts:20`), rendered as "to taste" by
  `formatIngredientAmount` (`lib/grocery.ts:33-40`).

### Owner decisions (locked 2026-10-02, do not revisit)

| # | Decision | Choice |
|---|---|---|
| L1 | Where amounts live | In the step TEXT ("Season with 2 tsp black pepper."), not a structured step-ingredient link. In-step amounts do not scale; the servings stepper keeps scaling only the ingredient list. This spec keeps that honest with a note (Section 2, pin AS1). |
| L2 | New imports | The import prompt (`lib/import/prompt.ts`) gains a rule: write each ingredient's amount and unit into the step where it is used (first use within a step); "to taste" items stay "to taste". Prompt tests updated; one live smoke import (paid, owner-approved). |
| L3 | Existing recipes | One-time backfill over all 35 recipes. The existing `IMPORT_MODEL` (`lib/import/anthropic.ts:9`, Claude Haiku 4.5) proposes rewritten step bodies that only INSERT amounts. A mechanical guard (pure function, vitest-covered) rejects any proposal that changes, drops, or reorders original words. The owner reviews every proposal on a review artifact and can exclude any. Nothing is written until the owner says "apply". Prod ritual: backup, preflight counts, single-transaction apply, verify. The apply changes step text only. |
| L4 | Cook mode | Retired entirely: delete `components/cook-mode.tsx` and its CSS, remove the recipe page's "Start cooking" button and `?cook=1` handling, and handle Today's "Start cooking" deep link. Keep the slate tokens (the Shop order bar uses them). |
| L5 | Constraints | Zero schema changes. Zero new npm dependencies. Tokens-only CSS. No em-dashes in any UI copy. The builder never commits. Live data is touched only in the owner-gated steps. |

### Decisions made in this spec (builder: treat as locked unless the orchestrator says otherwise)

| # | Decision | Choice and why |
|---|---|---|
| D1 | Backfill write path | **In-place `UPDATE public.recipe_steps SET body = new WHERE id = step_id AND body = reviewed_old_text`, all rows in one transaction.** Not `save_recipe`. See the comparison below. |
| D2 | Guard definition | The original must survive as an in-order subsequence of the proposal at the TOKEN level. Token = a maximal run of Unicode letters, digits, and combining marks, OR one single non-whitespace character that is not part of a word (so `.` `,` `(` `)` `/` `-` `–` `'` `°` are each one token). Whitespace is never a token. Matching is exact: case-sensitive, no Unicode normalization, so a changed word, letter case, accent, dash, or any dropped punctuation mark rejects the proposal. The text that gets written is **rebuilt from the original**: every original token verbatim, the original's own whitespace wherever nothing was inserted, and the proposal's text only inside the gaps where it inserted tokens. Reference code: Appendix A. |
| D3 | What the model sees | Recipe name, base servings, the stored ingredient rows (name plus the amount exactly as the recipe page shows it at base servings, via `formatIngredientAmount`), and the numbered steps. Never `instructions_raw` (it can disagree with ingredient rows the owner edited after import). |
| D4 | Insertion audit | Advisory flags on the review page, never blocking: an inserted word that is not a number, a unit word, a short glue word, or a word from that recipe's ingredient names; an inserted number that matches no ingredient amount (or number inside an ingredient name). Catches insertions like "until they do not burst" that the subsequence guard cannot. |
| D5 | Honest scaling | A one-line note at the top of the Steps card, rendered only while Preview servings differs from base servings: `Amounts in the steps are for {base} servings.` (singular "serving" when base is exactly 1). Its look is board pin AS1. |
| D6 | Today's deep link | Keep the cook-hero button and point it at `/recipes/<id>` (no query). Removing it would leave tonight's cook hero with no way into its recipe. Its label is board pin AS2 (default: keep "Start cooking →"). |
| D7 | Old `?cook=1` links | Simply ignored: the page renders normally. No redirect code needed. |
| D8 | Slate tokens | All seven `--color-slate-*` definitions stay (`app/globals.css:28-34`). After cook mode leaves, only `--color-slate`, `--color-slate-text`, and `--color-slate-text-muted` are referenced (by `.shop-orderbar`, `1286-1305`); the other four stay as the in-canon dark palette milestone 14 builds from. Only their comment changes. |
| D9 | In-step amount style | Cookbook style: digits and simple fractions (1/2, 3/4, 1 1/2); tsp, tbsp, oz, lb, g, kg, ml abbreviated. Backfill: before the ingredient words when that reads naturally, otherwise in parentheses right after the ingredient ("Add the garlic (4 cloves)"). |
| D10 | Backfill tooling runtime | `scripts/backfill-step-amounts.mjs` (plain Node, zero deps) imports two import-free TypeScript files (`lib/step-amounts.ts`, `lib/grocery.ts`) through Node's built-in type stripping (Node 23.6+ or 22.18+; this machine has 26.3). It never writes to any database: `export` runs one read-only SELECT via psql; the SQL files it generates are run by hand. Model call over plain `fetch`, same shape as `lib/import/anthropic.ts` (the Anthropic SDK is not a dependency). |
| D11 | Household data stays out of the repo | Every backfill output goes to `--out <dir>` outside the repo (the script refuses an in-repo path). The repo may be public. |
| D12 | PR structure | PR 1 (`codex/amounts-in-steps`): retire cook mode, Today link, servings note, import prompt rule, harnesses, board tooling. PR 2 (`codex/step-amounts-backfill`): the guard module, the backfill script, the canned-response fixture. The prod apply happens only after PR 1 is merged and deployed (so the note exists when amounts appear); PR 2 merges after the apply, so the merged script is the one that ran. |

**Why D1 (in-place UPDATE) and not `save_recipe`:**

| | `save_recipe` (`schema.sql:309-446`) | In-place `UPDATE` |
|---|---|---|
| What it writes | The whole recipe: `recipes` row, every ingredient, every step, every tag link, from a payload we would have to rebuild for 35 recipes. Any drift in that payload changes data. | One column (`recipe_steps.body`) of exactly the reviewed rows. |
| Ingredient rows | Deleted and re-inserted with new ids, all sharing one `created_at` (`now()` is the transaction time). The recipe page orders ingredients by `created_at` (`app/recipes/[id]/page.tsx:91`), so every recipe's list order becomes a tie and may visibly shuffle. | Untouched. |
| Plan versions / grocery staleness | Bumps every plan that uses the recipe if the ingredient signature text differs at all (`420-442`), which lights the Shop "Update" banner on those plans. | Impossible: version bumps come only from `save_recipe` and the `meal_plan_items` trigger (`570-612`), and grocery generation reads only `ingredients` and `meal_plan_items` (`741-787`). Steps never affect groceries. |
| Side effects | `recipes.updated_at` bumps (trigger `164-167`); tags re-linked through `lower(btrim())` (`404-418`), which would split any legacy mixed-case tag. | None: no trigger on `recipe_steps`, no `updated_at` column. |
| Running it from psql | `auth.uid()` is null, so each call needs `p_user_id` (`333-339`); 35 separate transactions unless wrapped. | One file, one transaction, guarded and self-verifying (Appendix A, `buildApplySql`). |
| Concurrency | Would overwrite an edit made after review. | `AND body = reviewed_old_text` plus the step id: a recipe edited after review gets new step ids from `save_recipe`, the in-transaction preflight count fails, and the whole apply rolls back with nothing written. |

---

## 2. Owner forks and board pins

| # | Question | Options | Recommendation |
|---|---|---|---|
| **W1** (fork, answer at the go-ahead) | Now that the recipe page is the cooking view, should it keep the screen awake? (Cook mode held a wake lock, `components/cook-mode.tsx:74-107`.) | (a) No wake lock anywhere. (b) The recipe page holds a best-effort wake lock while open (code in Appendix E; no UI). (c) An opt-in "Keep screen awake" toggle (needs its own board pin; not specced here, would be a follow-up). | **(a).** The owner already cooks from the recipe page without a wake lock and did not name screen dimming as a pain; (b) would also keep the screen on while merely browsing recipes. Adding (b) later is about 30 lines (Appendix E). |
| **AS1** (board pin, Phase 1) | How the servings note looks (copy: `Amounts in the steps are for 2 servings.`, shown only while Preview servings differs from base). | A: quiet muted line. B: amber callout (the `.import-callout` palette). | **A.** It is an FYI that matters only when servings change; amber is the app's attention color (Shop stale banner, import paywall). |
| **AS2** (board pin, Phase 1) | Label of Today's cook-hero button, which now opens the recipe page. | A: keep "Start cooking →". B: "View recipe" (what the leftover hero already says, `app/page.tsx:93-97`). | **A.** The recipe page is where cooking now happens, and the label is muscle memory. |

Open questions with builder-ready defaults (no STOP; the orchestrator raises them with the owner if useful):

- **Q1** In-step amount style (D9): cookbook fractions and abbreviations, not the app's decimal display ("1.5 cup"). The owner sees real examples on the backfill review artifact and can ask for a change before "apply".
- **Q2** Audit flags (D4) are advisory. The owner can ask for flagged steps to be excluded wholesale instead.
- **Q3** A proposal cannot be hand-edited on the review artifact. To fix one, the owner excludes it and edits that recipe in the app afterwards.
- **Q4** (orchestrator, resolved 2026-10-02) The "documented backup runbook" is referenced (`docs/current-state.md:321`, `docs/plans/unit-merge.md:130`) but no `pg_dump` command is written in `docs/architecture.md` or `docs/qa.md`. Phase 12's command matches prior practice per `docs/progress-log.md` (custom-format `~/meal-queue-backup-<stamp>.dump` stored outside the repo, 10-table manifest verified; the 2026-07-11 M12 backup is 414K). The orchestrator records the runbook in `docs/architecture.md` at wrap (Section 10).

---

## 3. Builder ground rules (non-negotiable)

1. **Repo root is `/Users/mitchell/Dev/meal-queue/meal-queue`**, one level below the shell cwd. Start every shell command with `cd /Users/mitchell/Dev/meal-queue/meal-queue &&`. A hook (RTK) can condense output; prefix `rtk proxy ` when exact output matters.
2. **Never**: commit, push, merge, install or upgrade dependencies, change the schema, edit anything under `docs/`, or touch prod. In particular never run `export --target prod`, never run psql with `DATABASE_URL`, and never run `propose` without `--responses` (that is a paid call). **`.env.local` points at PROD** (`DATABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` are remote): never print its values, and never start the dev server without the inline local env in rule 6.
3. Tokens only in CSS: no new hex, font, or magic number in `app/globals.css` rules. Every value this spec adds already exists elsewhere in the file.
4. No em-dashes in any UI copy you write (app, board, review page). Use a comma, colon, or period.
5. **Batch-Read before editing:** `app/recipes/[id]/page.tsx`, `app/page.tsx`, `components/cook-mode.tsx`, `app/globals.css` lines 1-45, 750-800, 880-1035, 1280-1310, 1495-1530, 1600-1760, `lib/import/prompt.ts`, `lib/import/prompt.test.ts`, `lib/import/normalize.test.ts`, `lib/grocery.ts`, `scripts/review-board/README.md`, `scripts/review-board/verify-detail-pass.mjs`, `scripts/review-board/verify-shop-pass.mjs`, `scripts/review-board/capture-detail-variants.mjs`, `scripts/review-board/gen-board-sb1.mjs`, `scripts/review-board/seed-review.sql`.
6. **Local stack and dev server** (Colima): from the repo root run `supabase start -x vector,logflare,realtime,imgproxy,studio,edge-runtime,mailpit,supavisor`, then `supabase status` and copy the local `anon key`. Start the dev server against the local stack only: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key> npx next dev -p 3123`. The review-board scripts expect port 3123 and sign in as the local test user they create. Before `npm run build`, stop the dev server; after a build, `rm -rf .next` before restarting it (a build bakes `.env.local`'s prod URLs into `.next`; `scripts/review-board/README.md:58-60`).
7. Baseline before starting AND before done: `npm run typecheck && npm run test && npm run lint` (vitest 141 tests across 9 files at baseline), plus `npm run build` (record the static page count; 13 as of PR #40).
8. Do not add `"type": "module"` to `package.json`. The script's `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` flag silences Node's harmless warning instead.

**STOP points**

- **STOP ①** after Phase 1: the board is generated; wait for the owner's AS1 and AS2 verdicts (and W1 if it is still open). Write no UI code before this.
- **STOP ②** before Phase 6: the live smoke import is one paid API call; wait for the owner's approval.
- **STOP ③** before ANY commit (PR 1); then a senior `/code-review` (high) before merge; the owner says "merge" (merging deploys to Vercel).
- **STOP ④** after Phase 10 (PR 2 dry run green): the orchestrator reviews; the owner approves the prod read plus the paid propose run (Phase 11).
- **STOP ⑤** after Phase 11: the owner reviews the proposals artifact and replies "apply" (with any exclusions). Nothing is written to prod before this.
- **STOP ⑥** inside Phase 12: any check that does not match its expected value stops the ritual; nothing further runs; report to the owner.
- **STOP ⑦** before ANY commit (PR 2); the owner says "merge".

Branches: `codex/amounts-in-steps` (PR 1), `codex/step-amounts-backfill` (PR 2).

---

## 4. PR 1: retire cook mode, Today link, servings note, import rule

### Phase 0: preflight

1. Rule 7 baseline (record vitest count and build page count).
2. Rule 6: local stack up, dev server on 3123 against it.
3. Bootstrap local data once: `node scripts/review-board/verify-v2-sweep.mjs`. It signs up `reviewer@local.test` if needed and seeds `scripts/review-board/seed-review.sql` (idempotent). Only its bootstrap matters here; note its result but do not fix its assertions.

### Phase 1: board mocks (no app code changes yet)

Create `scripts/review-board/capture-amounts-variants.mjs` by cloning the head of `capture-detail-variants.mjs` (playwright-core path, 390x844 iPhone context, `supabase.co` blocked, sign-in) and the sign-up fallback from `verify-shop-pass.mjs` (the block under `// ---- sign in (sign-up fallback)`, lines 88-104 on `0dcabab`). Output dir: `scripts/review-board/shots-amounts/` (gitignored by the `shots*/` rule).

Shots, all on the unmodified app:

1. `AS1-before.jpg`: Lemon Chicken Thighs recipe page as it is today, scrolled to the Steps card (context).
2. `AS1-base.jpg`, `AS1-A.jpg`, `AS1-B.jpg` (full-page screenshots, `fullPage: true`, so both the Steps card and the stepper at the bottom are visible; on phones the overview panel sits below the content, `app/globals.css:1784-1787`). For each: inject `.recipe-cook-btn{display:none!important}`, then replace the Steps card's step texts with these backfilled versions (in order), to show the end state:
   - `Pat the chicken thighs (1 1/2 lb) dry and season all over with 1 tsp salt.`
   - `Sear the chicken thighs skin-side down in 2 tbsp olive oil until golden, about 6 minutes.`
   - `Add the garlic (4 cloves), squeeze in the lemon (2), and scrape up the browned bits.`
   - `Roast 15 minutes, rest 5, then serve.`

   `AS1-base.jpg`: servings left at base (2), no note. For A and B: fill the servings input with `4`, then insert `<p class="recipe-steps-note">Amounts in the steps are for 2 servings.</p>` right after the Steps card's `<h2>` (the card whose `h2` text is `Steps`) and inject that variant's CSS from Phase 3 (A or B block, verbatim).
3. `AS2-A.jpg`, `AS2-B.jpg`: Today with tonight's hero. Pin the browser clock inside the seeded plan, then open Today: `await page.clock.setFixedTime(new Date("2026-07-02T12:00:00"));` followed by `await page.goto(BASE)` (`seed-review.sql:72-78` seeds a 2026-07-01 to 07-07 plan with Lemon Chicken Thighs as the 2026-07-02 cook item). A: as rendered ("Start cooking →"). B: set `document.querySelector(".tonight-btn").textContent = "View recipe"` before the shot.

Create `scripts/review-board/gen-board-amounts.mjs` by cloning `gen-board-sb1.mjs`: read `shots-amounts/`, write `scripts/review-board/review-board-m18.html` (gitignored). `<title>Milestone 18 review</title>`. No em-dashes anywhere in the board copy. Cards:

- **AS1** "When you preview a different number of servings, how should the Steps card say the step amounts stay at the recipe's base servings?" Show `AS1-base`, `AS1-A`, `AS1-B`. A: quiet muted line (recommended). B: amber callout.
- **AS2** "Today's cook button now opens the recipe page. Keep its label?" Show `AS2-A`, `AS2-B`. A: "Start cooking →" (recommended). B: "View recipe".
- If W1 is still open, a text card with W1's three options and the recommendation.

**STOP ①.** Report the board file path. The orchestrator publishes it as its own artifact (a distinct review gets its own URL) and collects verdicts.

### Phase 2: retire cook mode

`app/recipes/[id]/page.tsx`:

1. Line 4: replace `import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";` with `import { notFound, useParams, useRouter } from "next/navigation";`.
2. Line 8: delete `import { CookMode } from "@/components/cook-mode";`.
3. Lines 45-49: delete `const searchParams = useSearchParams();`, the two-line comment that begins `// Today's "Start cooking" deep-links here with ?cook=1`, and `const autoCook = searchParams.get("cook") === "1";`. Keep `const recipeId = params.id;`.
4. Line 60: delete `const [cooking, setCooking] = useState(false);`.
5. Line 138: delete `setCooking(autoCook && ((stepsRes.data ?? []) as StepRecord[]).length > 0);`.
6. Lines 269-273: delete the whole `{steps.length > 0 ? ( <button className="recipe-cook-btn" ...>Start cooking</button> ) : null}` block. (Phase 3 puts the note in its place.)
7. Lines 295-309: delete the whole `{cooking && recipe && steps.length > 0 ? ( <CookMode ... /> ) : null}` block.

`components/cook-mode.tsx`: delete the file.

`app/page.tsx`:

8. Line 89: replace ``href={`/recipes/${heroItem.recipe.id}?cook=1`}`` with ``href={`/recipes/${heroItem.recipe.id}`}``.
9. Line 90: AS2 = A: leave `Start cooking →` as is. AS2 = B: replace it with `View recipe`. Leave the leftover block (`93-97`) untouched either way.

`app/globals.css`:

10. Delete every `.cook-*` rule: the contiguous block from `.cook-mode {` (line 1607) through the closing `}` of `.cook-wake-note` (line 1753), plus the blank line after it.
11. Line 1500: delete `.recipe-cook-btn,` from the shared button selector group (`.settings-save, .recipes-save, .recipe-cook-btn, .import-submit`). The group keeps the other three selectors and its declarations unchanged.
12. Lines 1517-1521: delete the comment `/* The cook bar sits under the STEPS label, ... */` and the `.recipe-cook-btn { margin: 0.15rem 0 0.35rem; }` rule, plus the blank line after it.
13. Lines 26-27 (comment only; the seven token lines 28-34 stay byte-identical): replace the two-line comment that starts `/* Token set v2 dark slate set` (directly above `--color-slate: #131a18;`) with:

```css
  /* Token set v2 dark slate set. Shop's pinned order bar uses slate, slate-text,
     and slate-text-muted; the rest stay as the dark palette milestone 14 builds from. */
```

14. Lines 756-759 (comment only): replace the whole comment above `.plan-add-meal {` with:

```css
/* Full-screen add-meal takeover (components/plan-add-meal.tsx). Replaces the
   former inline quick-add card so the iOS keyboard can't reflow the day list
   (owner feedback 2026-07-07). A fixed full-screen overlay, light-themed like
   the rest of the app. */
```

15. Lines 921-923 (comment only): replace the whole comment above `.recipe-ingredient-list {` with:

```css
/* Flat hairline rows for ingredients and steps (owner verdict RD1: B, round-4
   board 2026-07-02, with the .recipe-amount split that un-quirks the pantry
   badge, RD4). RD2's Start cooking bar was retired with cook mode (milestone 18). */
```

Check: `grep -rn -E "cook-mode|CookMode|cook=1|matchesStep|recipe-cook-btn|\.cook-|cook-(step|nav|dots|wake|exit|count|recipe|head|next|back)" app components lib` prints nothing. Also `grep -rn -E "wakeLock|WakeLock" app components lib` prints nothing (unless W1 = b, then only `app/recipes/[id]/page.tsx`). `grep -rn "Start cooking" app components lib` prints only `app/page.tsx` (AS2 = A) or nothing (AS2 = B). Unrelated matches you must NOT touch: `lib/import/pantry-staples.ts:12` ("cooking spray"), `components/recipe-import.tsx:144,155` (NYT Cooking placeholder text).

### Phase 3: the servings note (per AS1 verdict)

`app/recipes/[id]/page.tsx`:

1. Line 9: replace `import { formatIngredientAmount } from "@/lib/grocery";` with `import { formatAmount, formatIngredientAmount } from "@/lib/grocery";`.
2. Directly after `<h2 className="recipes-card-label">Steps</h2>` (line 268), insert:

```tsx
              {steps.length > 0 && scaleFactor !== 1 ? (
                <p className="recipe-steps-note">
                  {`Amounts in the steps are for ${formatAmount(Number(recipe.base_servings))} ${
                    Number(recipe.base_servings) === 1 ? "serving" : "servings"
                  }.`}
                </p>
              ) : null}
```

(`recipe` is non-null here: the whole layout renders inside `{recipe ? (` at line 200. `scaleFactor` is 1 at base servings and for an empty or invalid servings input, `68-73`, so the note hides then.)

3. If W1 = b, add the effect from Appendix E. Otherwise add nothing.

`app/globals.css`: insert the AS1 verdict's block after the `.recipe-step-index` rule (which ends at line 1029, just before `.page-col`). Both blocks reuse existing values only (A: the retired `.recipe-cook-btn` margin from line 1520 and the `.muted` size from line 530; B: the `.import-callout` palette from lines 1548-1557).

AS1 = A:

```css
/* Milestone 18 (AS1: A): shown at the top of the Steps card only while
   Preview servings differs from base. Step amounts are text and do not
   scale with the stepper; this line keeps that honest. */
.recipe-steps-note {
  margin: 0.15rem 0 0.35rem;
  color: var(--muted);
  font-size: 0.85rem;
}
```

AS1 = B:

```css
/* Milestone 18 (AS1: B): shown at the top of the Steps card only while
   Preview servings differs from base. Step amounts are text and do not
   scale with the stepper; this callout keeps that honest. */
.recipe-steps-note {
  margin: 0.15rem 0 0.35rem;
  border: 1px solid var(--color-accent);
  border-radius: 12px;
  background: var(--color-accent-soft);
  color: var(--color-accent-deep);
  padding: 0.7rem 0.8rem;
  font-size: 0.9rem;
  font-weight: 600;
}
```

If the owner changed the copy in the AS1 verdict, use their copy verbatim and update the harness expectation in Phase 5.

### Phase 4: the import prompt rule

`lib/import/prompt.ts`: after the `STEPS. ...` line (line 28) and its following `""` line, insert these two array entries (so `STEP AMOUNTS` sits between STEPS and the "Ignore ads" line):

```ts
    'STEP AMOUNTS. In each step, write the amount and unit of each ingredient the step uses at its first mention in that step, matching your ingredients list ("Season with pepper" -> "Season with 2 tsp black pepper"). If the source step already gives the amount, keep it as written. Write amounts as a cookbook would: digits and simple fractions (1/2, 3/4, 1 1/2); tsp, tbsp, oz, lb, g, kg, ml abbreviated. Ingredients that are "to taste" stay "to taste"; never invent an amount for them. When a step uses only part of an ingredient, write that portion only if the source says it; otherwise leave that mention without an amount.',
    "",
```

`lib/import/prompt.test.ts`: after the `it("states the step-boundary rule", ...)` test (lines 30-33), add:

```ts
  it("states the step-amounts rule", () => {
    expect(prompt).toContain("STEP AMOUNTS");
    expect(prompt).toContain("at its first mention in that step");
    expect(prompt).toContain('stay "to taste"');
  });
```

`lib/import/normalize.test.ts`: after the `it("keeps a leading numeric range in a step ...")` test (lines 153-164), add (verified against the current `stripStepNumbering`, `lib/import/normalize.ts:116-118`; do not change normalize.ts):

```ts
  it("keeps an amount that starts a step (not treated as numbering)", () => {
    const steps = ["1.5 cups broth go in next.", "1 1/2 cups rice, rinsed.", "1/2 cup sugar, whisked in."];
    const draft = normalizeDraft({ ...raw, steps }, [], null, "t");
    expect(draft.steps).toEqual(steps);
  });
```

Vitest after PR 1: 143 tests across 9 files.

### Phase 5: harnesses and the gate

**Edit `scripts/review-board/verify-detail-pass.mjs`** (recipe detail regression):

1. Lines 1-2 header comment: say "layout assertions + servings-stepper and steps-note behavior checks (cook mode retired in milestone 18) + as-built shots".
2. Replace lines 84-90 (the `cookBtn` evaluate and the `Start cooking full-width teal (RD2)` check) with:

```js
  check("no Start cooking button (M18)", String(await page.locator(".recipe-cook-btn").count()), "0");
```

3. Line 103: change the scroll target from `.recipe-cook-btn` to `.recipe-step-list`.
4. After line 106 (the `AB-detail-steps.jpg` screenshot), add:

```js
  check("steps note hidden at base servings (M18)", String(await page.locator(".recipe-steps-note").count()), "0");
```

5. Line 108 comment: `// ---- behavior: stepper scales, steps note, legacy ?cook=1 link ----`.
6. Keep lines 109-113 (stepper rescale). Replace lines 115-127 (open the takeover, its screenshot, the wait, the `?cook=1` auto-open check) with:

```js
  const note = ((await page.locator(".recipe-steps-note").textContent().catch(() => null)) ?? "(missing)").trim();
  check("steps note appears off base servings (M18)", note, "Amounts in the steps are for 2 servings.");
  await page.evaluate(() => document.querySelector(".recipe-step-list").scrollIntoView({ block: "start" }));
  await page.evaluate(() => window.scrollBy(0, -60));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "AB-detail-scaled.jpg"), type: "jpeg", quality: 85 });
  // Let the page's in-flight requests settle before navigating away, or the
  // aborted settings POST logs a harness-only "Failed to fetch".
  await page.waitForTimeout(1200);

  await page.goto(`${BASE}/recipes/${recipeId}?cook=1`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".recipe-step-list", { timeout: 15000 });
  await page.waitForTimeout(1500);
  const cookNodes = await page.evaluate(() => document.querySelectorAll('[class*="cook"]').length);
  check("legacy ?cook=1 link renders the plain page (M18)", String(cookNodes), "0");
```

Expected result: **16/16, 0 console errors** (was 15: three cook checks removed, four M18 checks added). The note expectation uses base servings 2 (Lemon Chicken Thighs, `seed-review.sql:19-20`).

**Create `scripts/review-board/verify-amounts-pass.mjs`** (Today). Clone the structure of `verify-shop-pass.mjs`: `check()`, the console-error capture, sign-in with sign-up fallback (the block under `// ---- sign in (sign-up fallback)`, lines 88-104 on `0dcabab`), and the `=== N/M passed` summary at the end. Do not copy its setup or teardown SQL. **If milestone 17 has merged, that file contains a `page.clock.setFixedTime(new Date("2026-07-08T12:00:00"))` line: do not copy that date; this harness pins 2026-07-02 (a July 8 clock shows a different hero).** `OUT` = `scripts/review-board/shots-amounts/`. Behavior:

1. Directly after `const page = await ctx.newPage();` add `await page.clock.setFixedTime(new Date("2026-07-02T12:00:00")); // seeded plan: Lemon Chicken Thighs is tonight's cook item`. (`playwright-core` in the npx cache is 1.63, which has `page.clock`.)
2. Sign in (sign-up fallback). Run `scripts/review-board/seed-review.sql` with psql `-f` against the local DB (idempotent; it seeds the 2026-07-01 to 07-07 plan, `seed-review.sql:72-78`). Today picks the active plan with the latest `start_date` (`lib/hooks/use-today.ts:46-48`) and prefers a cook item for the hero (`77-83`); the other harnesses' July plans start 2026-07-05, so they never cover July 2.
3. Read the recipe id: `select id from public.recipes where name='Lemon Chicken Thighs' limit 1` (same query as `verify-detail-pass.mjs:27`).
4. Go to `BASE`, wait for `.tonight-btn`. Checks:
   - `hero names the recipe`: `.tonight-card h2` text is `Lemon Chicken Thighs`.
   - `cook button opens the recipe page (M18)`: `.tonight-btn` `href` attribute is exactly `/recipes/<id>`.
   - `cook button label (AS2)`: `.tonight-btn` text is `Start cooking →` (AS2 = A) or `View recipe` (AS2 = B).
   - Screenshot `AB-today.jpg`. Click `.tonight-btn`, wait for `.recipe-step-list`.
   - `lands on the plain recipe page`: `new URL(page.url())` has pathname `/recipes/<id>` and an empty `search`.
   - `no cook takeover`: `document.querySelectorAll('[class*="cook"]').length` is `0`.
5. No teardown: the harness writes nothing beyond the idempotent seed.
6. Expected: **5/5, 0 console errors**.

**Edit `scripts/review-board/README.md`** (tooling notes live next to the scripts, not in `docs/`): in the rounds 3-4 section (lines 44-46) change "(live `save_recipe` save; Cook takeover, stepper rescale, `?cook=1` deep link)" to "(live `save_recipe` save; stepper rescale)", and add a section:

```md
## Milestone 18 additions

- `capture-amounts-variants.mjs` / `gen-board-amounts.mjs`: the AS board (steps
  note A/B, Today button label A/B); shots in `shots-amounts/`, board
  `review-board-m18.html`.
- `verify-amounts-pass.mjs`: Today's cook button opens `/recipes/<id>` (no
  `?cook=1`) and no cook takeover renders. Pins the browser clock to
  2026-07-02, inside the seeded plan, so it writes nothing.
- `verify-detail-pass.mjs` no longer checks the Cook takeover (retired in
  milestone 18); it checks the steps note and that a legacy `?cook=1` link
  renders the plain page.
- `capture.mjs` is the historical round-1 capture; its Cook phase now logs
  PHASE SKIPPED.
```

Leave the historical scripts untouched: `capture.mjs` (its Cook phase, `201-224`, fails soft through `phase()`, `72-77`), `capture-detail-variants.mjs`, `gen-board.mjs`, `gen-board-r4.mjs`.

**Gate:** `npm run typecheck && npm run test && npm run lint` (143 tests, 9 files), then stop the dev server, `npm run build` (same static page count as the Phase 0 baseline; no route added or removed; `/recipes/[id]` stays dynamic), `rm -rf .next`, restart the dev server (rule 6), then run `node scripts/review-board/verify-detail-pass.mjs` (16/16), `node scripts/review-board/verify-amounts-pass.mjs` (5/5), and `node scripts/review-board/verify-import-pass.mjs` (26/26, unchanged: it intercepts the import route, `65-67`, so the prompt change is invisible to it).

### Phase 6: live smoke import (paid, one call)

**STOP ②** first. After the owner approves, against the LOCAL dev server (the route verifies the token against the local stack and calls the real API with `ANTHROPIC_API_KEY` from `.env.local`):

```sh
cd /Users/mitchell/Dev/meal-queue/meal-queue
SMOKE="$HOME/meal-queue-m18-smoke"; mkdir -p "$SMOKE"
ANON='<the local anon key from rule 6>'
TOKEN=$(curl -s "http://127.0.0.1:54321/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "content-type: application/json" \
  -d '{"email":"reviewer@local.test","password":"review-pass-1234"}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).access_token))')
node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({ text: require("fs").readFileSync(0, "utf8"), tags: [] }))' "$SMOKE/request.json" < "$SMOKE/recipe.txt"
curl -s http://localhost:3123/api/import-recipe -H "Authorization: Bearer $TOKEN" \
  -H "content-type: application/json" --data-binary @"$SMOKE/request.json" > "$SMOKE/response.json"
node -e 'const r=require(process.argv[1]); if (r.error) { console.log(r.error); process.exit(1); } r.draft.steps.forEach((s,i)=>console.log(`${i+1}. ${s}`)); console.log(r.draft.ingredients); console.log(r.meta)' "$SMOKE/response.json"
```

Write `$SMOKE/recipe.txt` first with the test recipe in Appendix F. Pass criteria (the orchestrator judges; exact wording varies):

- 3 steps (source boundaries kept).
- Step 1 carries the kosher salt (1 tsp) and black pepper (1/2 tsp) amounts at first mention.
- Step 2 keeps "1 tablespoon of the olive oil" as written (no doubled amount); the chicken gets its 1 1/2 lb (or pounds).
- Step 3: "the remaining oil" gets no amount; the garlic gets 4 cloves; "season to taste" is unchanged.

Report the printed steps, ingredients, and `meta` (tokens). If an amount is missing or invented, STOP: the prompt wording gets fixed in PR 1 before merge.

### Phase 7: as-built and handoff

1. Add an "As built" section to `gen-board-amounts.mjs` with `AB-detail-scaled.jpg`, `AB-detail-steps.jpg`, and `AB-today.jpg`; regenerate the board (the orchestrator redeploys it to the same artifact URL).
2. Re-run the Phase 5 gate. Report: files changed, vitest count, build page count, harness results, smoke output.

**STOP ③.** The orchestrator commits (after the owner's approval), opens PR 1, runs a senior `/code-review` (high), and merges on the owner's "merge".

**Needs Mitchell (real iPhone, after deploy):** on Today, tap the cook hero's button and land on the recipe page (no takeover); change Preview servings and see the note at the Steps card; an old home-screen or bookmark link ending in `?cook=1` opens the plain page.

---

## 5. PR 2: the backfill tooling and the ops ritual

### Phase 8: the guard module

1. Create `lib/step-amounts.ts` with exactly the content of **Appendix A**. It must stay import-free (the script loads it through Node's type stripping).
2. Create `lib/step-amounts.test.ts` with exactly the content of **Appendix B** (30 tests).
3. `npm run typecheck && npm run test && npm run lint`: 173 tests across 10 files.

The reference code in Appendices A to C was run before handoff: Appendix A's logic passed 23 behavior checks and a strict `tsc --noEmit`, Appendix B's 30 tests passed against Appendix A through a local test shim, and Appendix C's `propose` and `sql` commands ran end to end on a synthetic snapshot. Only `export` and the SQL files themselves were not run against a database; Phase 10 does that.

### Phase 9: the script and fixture

1. Create `scripts/backfill-step-amounts.mjs` with exactly the content of **Appendix C**.
2. Create `scripts/backfill-fixtures/seed-review-responses.json` with exactly the content of **Appendix D** (synthetic seed data only, safe to commit).
3. `npm run lint` must stay clean (ESLint covers `.mjs`).

### Phase 10: local dry run (local stack only)

```sh
cd /Users/mitchell/Dev/meal-queue/meal-queue
OUT="$HOME/meal-queue-backfill-local"
N="node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/backfill-step-amounts.mjs"
P=/opt/homebrew/opt/libpq/bin/psql
L=postgresql://postgres:postgres@127.0.0.1:54322/postgres

$N export --target local --out "$OUT"
$N propose --out "$OUT" --responses scripts/backfill-fixtures/seed-review-responses.json
```

Expected `propose` lines for the seeded recipes (codes depend on what else is in your local DB; recipes are coded alphabetically):

- `Caprese Pasta`: 3 accepted (its step 2 is flagged: "do", "not").
- `Lemon Chicken Thighs`: 2 accepted, 1 unchanged, 1 rejected (step 3: "browned" was changed).
- `Sheet-Pan Salmon`: rejected (the response's step numbers do not match).
- `Weeknight Chili`: 3 accepted (its step 3 is flagged: amount 3).
- Any other local recipe with steps: skipped (no canned response).

If `export` fails with a SQL error, STOP and report the exact error. Then:

```sh
# Use the code the propose output printed for Caprese Pasta step 2 (example: R01.2).
$N sql --out "$OUT" --exclude R01.2
$P "$L" -X -v ON_ERROR_STOP=1 -x -f "$OUT/check.sql" > "$OUT/check-0-before.txt"
$P "$L" -X -v ON_ERROR_STOP=1 -f "$OUT/rehearsal.sql"          # NOTICE: M18 backfill: 7 steps updated, then ROLLBACK
$P "$L" -X -v ON_ERROR_STOP=1 -x -f "$OUT/check.sql" > "$OUT/check-1-rehearsal.txt"
diff "$OUT/check-0-before.txt" "$OUT/check-1-rehearsal.txt"    # must print nothing
$P "$L" -X -v ON_ERROR_STOP=1 -f "$OUT/apply.sql"              # NOTICE: 7 steps updated, COMMIT
$P "$L" -X -v ON_ERROR_STOP=1 -x -f "$OUT/check.sql" > "$OUT/check-2-applied.txt"
diff "$OUT/check-0-before.txt" "$OUT/check-2-applied.txt"      # only still_old and now_new may differ
$P "$L" -X -v ON_ERROR_STOP=1 -f "$OUT/apply.sql"              # must FAIL at "M18 preflight" and change nothing
$P "$L" -X -v ON_ERROR_STOP=1 -f "$OUT/revert.sql"
$P "$L" -X -v ON_ERROR_STOP=1 -x -f "$OUT/check.sql" > "$OUT/check-3-reverted.txt"
diff "$OUT/check-0-before.txt" "$OUT/check-3-reverted.txt"     # must print nothing
```

Expected numbers on the seeded data: 7 steps across 3 recipes (if your local DB holds extra copies of these recipes, the numbers scale; report what you see). Before apply: `payload_steps 7`, `still_old 7`, `now_new 0`. After apply: `still_old 0`, `now_new 7`; `recipes`, `steps`, `ingredients`, `untouched_steps_md5`, `ingredients_md5`, `plan_versions_md5`, and `recipes_updated_md5` identical to before. Between apply and revert, open Lemon Chicken Thighs and Caprese Pasta on the local app (port 3123): Lemon steps 1-2 show the amounts, Lemon step 3 is unchanged ("browned bits"), Caprese step 2 is unchanged (excluded).

Report every command's output, the four check files, and the `$OUT/review.html` path (the orchestrator previews it). **STOP ④.**

### Phase 11 (ORCHESTRATOR ONLY, after the owner approves the prod read and the paid run)

```sh
cd /Users/mitchell/Dev/meal-queue/meal-queue
OUT="$HOME/meal-queue-backfill-prod-$(date +%Y-%m-%d)"
N="node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/backfill-step-amounts.mjs"
$N export --target prod --out "$OUT"     # read-only; prints recipes with steps and the step count
$N propose --out "$OUT"                  # paid: one Haiku call per recipe, about $0.25 for 35; prints usage
```

Publish `$OUT/review.html` as its own private artifact (a distinct review). Before publishing, skim it against the artifact contract (a 2-4 word title, color tokens with dark mode, phone width). It holds household recipe text, so do not route it anywhere else. If the proposals are systematically off (a prompt problem), fix `BACKFILL_SYSTEM_PROMPT` on the PR 2 branch and re-run `propose` (cheap). **STOP ⑤:** the owner replies "apply" or "apply, exclude <codes>". The household should not edit recipes or plans until Phase 12 finishes.

### Phase 12 (ORCHESTRATOR ONLY, after the owner says "apply")

```sh
cd /Users/mitchell/Dev/meal-queue/meal-queue
OUT="$HOME/meal-queue-backfill-prod-<date of Phase 11>"
N="node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/backfill-step-amounts.mjs"
P=/opt/homebrew/opt/libpq/bin/psql
DB_URL="$(node -e 'process.loadEnvFile(".env.local"); process.stdout.write(process.env.DATABASE_URL)')"   # never echo it

# 1. SQL for exactly what the owner approved (an unknown code aborts with nothing written)
$N sql --out "$OUT" --exclude "<codes from the owner's reply, or omit the flag>"

# 2. Backup (custom format, public schema, stored outside the repo), then the 10-table manifest
STAMP="$(date +%Y-%m-%d-%H%M)"
/opt/homebrew/opt/libpq/bin/pg_dump "$DB_URL" -Fc -n public -f "$HOME/meal-queue-backup-$STAMP.dump"
ls -lh "$HOME/meal-queue-backup-$STAMP.dump"
/opt/homebrew/opt/libpq/bin/pg_restore --list "$HOME/meal-queue-backup-$STAMP.dump" | grep -c "TABLE DATA public"   # expect 10

# 3. Preflight (read-only)
$P "$DB_URL" -X -v ON_ERROR_STOP=1 -x -f "$OUT/check.sql" > "$OUT/prod-check-0-before.txt"
# expect payload_steps = N (from step 1), still_old = N, now_new = 0. Otherwise STOP ⑥.

# 4. Rolled-back rehearsal, then prove zero residue
$P "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$OUT/rehearsal.sql"
$P "$DB_URL" -X -v ON_ERROR_STOP=1 -x -f "$OUT/check.sql" > "$OUT/prod-check-1-rehearsal.txt"
diff "$OUT/prod-check-0-before.txt" "$OUT/prod-check-1-rehearsal.txt"   # must print nothing, else STOP ⑥

# 5. Apply (single transaction; aborts as a whole if any reviewed step changed since review)
$P "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$OUT/apply.sql"

# 6. Verify
$P "$DB_URL" -X -v ON_ERROR_STOP=1 -x -f "$OUT/check.sql" > "$OUT/prod-check-2-applied.txt"
diff "$OUT/prod-check-0-before.txt" "$OUT/prod-check-2-applied.txt"
# expect only still_old (N -> 0) and now_new (0 -> N) to differ; counts and all four md5s identical
```

Recovery: `revert.sql` (same guards, restores the reviewed originals for steps still holding the backfilled text) is the fast path; the `pg_dump` file is the full fallback. Then the owner opens two recipes they cook often on the phone and confirms the steps read right. The orchestrator records the run (counts, N, exclusions, backup size) in the progress log, then commits PR 2 after approval (**STOP ⑦**) and merges on the owner's word.

---

## 6. Verification summary

| Check | Expected |
|---|---|
| `npm run typecheck`, `npm run lint` | clean, both PRs |
| `npm run test` | 143 across 9 files after PR 1; 173 across 10 files after PR 2 (baseline 141 across 9) |
| `npm run build` | same static page count as the Phase 0 baseline (13 as of PR #40); `/recipes/[id]` dynamic |
| `verify-detail-pass.mjs` | 16/16, 0 console errors |
| `verify-amounts-pass.mjs` (new) | 5/5, 0 console errors |
| `verify-import-pass.mjs` | 26/26 (unchanged) |
| Live smoke import | Phase 6 criteria |
| Local dry run | Phase 10 numbers; rehearsal and revert leave zero residue; second apply fails at preflight |
| Prod ritual | Phase 12: manifest 10, preflight N/N/0, rehearsal zero residue, verify 0/N with identical counts and md5s |
| pgTAP | untouched (no schema change); CI stays green |

## 7. Acceptance

- Cook mode is gone: `components/cook-mode.tsx` deleted, no `.cook-*` CSS, no `?cook=1` handling; the Phase 2 greps pass.
- Today's cook hero opens `/recipes/<id>`; an old `?cook=1` link renders the normal recipe page.
- At base servings the recipe page looks as before minus the Start cooking bar; off base, the AS1 note appears at the top of the Steps card with the agreed copy.
- New imports write amounts into steps at first use, keep "to taste" items unquantified, and never guess a portion (smoke passed).
- Every applied backfill step contains its original tokens in order (guard-proven) and differs only by insertions; the owner approved every applied step; excluded and rejected steps are byte-identical; only `recipe_steps.body` changed (check md5s for untouched steps, ingredients, plan versions, and `recipes.updated_at` identical before and after).
- Zero schema changes, zero new dependencies, tokens-only CSS, no em-dashes in new UI copy.

## 8. Do-not-touch list

`supabase/**` (schema, migrations, tests, seed), `mcp/**`, `app/api/**`, `lib/import/anthropic.ts`, `lib/import/schema.ts`, `lib/import/normalize.ts`, `lib/grocery.ts`, `lib/hooks/**`, `app/recipes/page.tsx` (editor), `app/grocery/**`, `app/plans/**`, `components/plan-add-meal.tsx`, `components/recipe-import.tsx`, the seven `--color-slate-*` token lines (`app/globals.css:28-34`), the `.shop-orderbar` rules (`1286-1305`), `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.mjs`, `.env.local`, every historical review-board script and board (Section 4, Phase 5), `docs/**` (orchestrator only).

## 9. Reference inventory (every match, with its disposition)

Searched for `cook-mode`, `CookMode`, `cook=1`, `matchesStep`, `wakeLock`, `Start cooking`, and `cook-` across `app/`, `components/`, `lib/`, `scripts/review-board/` (tracked files), and `docs/`.

| Where | What | Disposition |
|---|---|---|
| `components/cook-mode.tsx` | the takeover: `matchesStep` heuristic (`24-42`), body scroll lock (`57-64`), wake lock (`74-107`), last-step button copy (`157`), wake note (`160`) | delete the file (Phase 2) |
| `app/recipes/[id]/page.tsx:4,8,45,47-49,60,138,269-273,295-309` | `useSearchParams`, `CookMode` import, `autoCook`, `cooking` state, Start cooking button, `<CookMode>` | edit (Phase 2); note added at the button's spot (Phase 3) |
| `app/page.tsx:89-90` | `?cook=1` deep link, "Start cooking →" | href fixed; label per AS2 (Phase 2) |
| `app/globals.css:1607-1753` | all `.cook-*` rules | delete |
| `app/globals.css:1500, 1517-1521` | `.recipe-cook-btn` in the shared button group and its margin override | delete |
| `app/globals.css:26-27, 756-759, 921-923` | comments naming the Cook takeover, `.cook-mode`, the Start cooking bar | reword (comments only) |
| `lib/**` | no matches (only "cooking spray", `lib/import/pantry-staples.ts:12`, and an NYT URL in `lib/import/fetch-page.test.ts:6`, both unrelated) | none |
| `scripts/review-board/verify-detail-pass.mjs:1,84-90,103,108,115-127` | RD2 button check, takeover open, `?cook=1` auto-open | edit (Phase 5) |
| `scripts/review-board/README.md:46` | describes the takeover checks | edit (Phase 5) |
| `scripts/review-board/capture.mjs:128, 201-224`; `capture-detail-variants.mjs:19`; `gen-board.mjs:189`; `gen-board-r4.mjs:87-130` | historical round captures and boards | leave (history) |
| `docs/**` | see Section 10 | orchestrator |

## 10. Doc updates for the orchestrator (the builder edits none of these)

1. `docs/plans/amounts-in-steps.md`: this spec (new).
2. `docs/plans/step-ingredients.md`: the superseded banner is already in the working tree (uncommitted). Still to do: correct its stale claim (lines 40-43 with the banner in place, the sentence containing "no `.order()`") that the detail page reads ingredients unordered: it now orders by `created_at` (`app/recipes/[id]/page.tsx:91`), but rows from one save share one `created_at`, so order within a recipe is still effectively unpinned.
3. `docs/plans/dark-mode.md`: drop the Cook-takeover clauses now moot (line 9 "used by the Cook takeover and the Shop order bar" becomes the order bar only; line 16 "Already-dark surfaces" row keeps only the Shop order bar; line 88 drop `.cook-mode (1505+)` and fix the stale `.shop-orderbar (1208+)` to its current position; line 109 drop "plus Cook mode open"; line 112 drop Cook mode from the byte-identical check; line 122 drop `.cook-mode` from do-not-touch).
4. `docs/design-system.md`: slate section (61-83) roles: `--color-slate-2`, `-text-soft`, `-text-dim`, `-border` are referenced by no selector after M18 (kept for M14), and `slate`/`slate-text`/`slate-text-muted` serve `.shop-orderbar`; line 81 drop the cook progress/Next/focus-ring use of amber on slate; lines 109-111 the one dark surface is now the Shop order bar; line 129 drop "cook chips" from tabular-nums; line 241 `.tonight-btn` links to the recipe page, not Cook mode; lines 280-281 describe the add-meal takeover without `.cook-mode`; lines 338-340 drop `.recipe-cook-btn` from the shared button group; delete the "Cook-mode takeover" section (356-374); document `.recipe-steps-note` (the AS1 verdict's values).
5. `docs/pages/recipes.md`: lines 3-5 refresh note; 11-13 Purpose (no Cook takeover; steps carry amounts); 27-29 Today hero links to `/recipes/<id>`, `?cook=1` is ignored; 57-59 no `useSearchParams`; 63-65 the stepper scales the ingredient list only; 69-73 Steps section (no Start cooking; the note off base servings); 166-170 states (drop the cook-button and Cooking lines; add the note state); 180-181 Known flags (drop the chips heuristic; add the two text-amount limits below).
6. `docs/pages/today.md`: line 11 Purpose ("one tap from Cook mode" becomes one tap from its recipe); lines 29-31 the hero button's label (AS2) and plain `/recipes/[id]` link.
7. `docs/routes.md`: line 9 (Today purpose) and line 11 (`/recipes/[id]`: drop "full-screen Cook mode (`?cook=1` auto-launches it)"; add "steps carry amounts; a note when previewing other servings").
8. `docs/design-flags.md`: move "Cook mode: per-step ingredient chips use a name-match heuristic" (39-42) to Resolved (retired with cook mode, M18). Update "Thin empty states, no dark mode (wake-lock resolved)" (34-37): its wake-lock note cites `components/cook-mode.tsx` (deleted; record the W1 verdict) and its empty-states half was dropped in the re-plan. New flags: (a) in-step amounts are text, so they do not follow the servings stepper (the note covers it) and do not update when an ingredient amount is edited; (b) pre-existing: ingredient display order ties on `created_at` for rows from one save (no position column); (c) pre-existing: the step-number stripper (`lib/import/normalize.ts:117`) eats a leading "3- " when a step starts "3- to 4-pound"; (d) the `mcp/` save path does not get the prompt rule (out of scope by convention).
9. `docs/roadmap.md`: mark §18 done when both PRs land (with the backfill numbers); line 563-564 (UI-audit deferred fixes) says wake lock shipped with Cook mode: record its retirement per W1.
10. `docs/decisions.md`: the M18 build decisions (D1 with the comparison table, D2, D4, D5, D6, D12), the W1 verdict, and the AS1/AS2 verdicts.
11. `docs/architecture.md`: write the `pg_dump` backup runbook into Deploy & Operations (the Phase 12 command and the 10-table manifest check); it is referenced as documented but absent (Q4). Update Test Boundaries (line 150) to the new vitest count. Optionally note `scripts/backfill-step-amounts.mjs` as a one-time ops tool.
12. `docs/qa.md` (optional): a "Data backfill (no schema change)" checklist mirroring Phase 12 (backup, check, rehearsal, apply, verify; owner gate).
13. `docs/data-model.md`: line 154, `recipe_steps.body` notes that step text carries the amounts used in that step since M18 (plain text, not scaled).
14. `docs/current-state.md` and `docs/progress-log.md`: the wrap entries (status rows 557 Recipe detail and 593 M16, the Today row, the new M18 row; the prod ritual record).
15. No change: `docs/README.md` (links the plans folder), `CLAUDE.md`, and the historical docs (`redesign-brief.md`, `UI_AUDIT_2026-06-11.md`, `mockups/reflow-v1.html`, shipped plan specs `recipe-import.md`, `ux-feedback-fixes.md`, `error-boundaries.md`, and existing progress-log entries).

---

## Appendix A: `lib/step-amounts.ts` (create verbatim)

````ts
// Pure helpers for the milestone 18 step-amounts backfill.
//
// IMPORT-FREE ON PURPOSE: scripts/backfill-step-amounts.mjs loads this file
// directly through Node's built-in TypeScript type stripping, which cannot
// resolve extensionless imports. Keep this file free of import statements and
// of TypeScript-only runtime syntax (no enums, namespaces, or parameter
// properties). Its vitest file may import anything.

/** Must equal IMPORT_MODEL in lib/import/anthropic.ts (asserted in the test). */
export const BACKFILL_MODEL = "claude-haiku-4-5-20251001";

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export type Token = { text: string; start: number; end: number };

// A token is either a word (a maximal run of Unicode letters, digits, and
// combining marks) or one single character that is neither whitespace nor
// part of a word (punctuation, symbols, parentheses, dashes, apostrophes).
// Whitespace is never a token. Matching is exact: case-sensitive, and no
// Unicode normalization (a changed accent or dash counts as a changed token).
const TOKEN_PATTERN = /[\p{L}\p{N}\p{M}]+|[^\s\p{L}\p{N}\p{M}]/gu;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const start = match.index ?? 0;
    tokens.push({ text: match[0], start, end: start + match[0].length });
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// The insert-only guard
// ---------------------------------------------------------------------------

export type Insertion = {
  /** Index of the original token this text follows; -1 means before the first token. */
  after: number;
  /** The inserted text exactly as it appears in the proposal. */
  text: string;
};

/** The final text in order; joining every segment's text gives `final` exactly. */
export type Segment = { text: string; inserted: boolean };

export type GuardResult =
  | { ok: true; changed: boolean; final: string; insertions: Insertion[]; segments: Segment[] }
  | { ok: false; reason: string };

export function checkInsertOnly(original: string, proposal: string): GuardResult {
  const orig = tokenize(original);
  const prop = tokenize(proposal);
  if (orig.length === 0) return { ok: false, reason: "The original step is empty." };

  // Greedy leftmost match: every original token, in order, must be found in
  // the proposal after the previous match. Success means the original is an
  // in-order subsequence of the proposal: nothing changed, dropped, or moved.
  const matchAt: number[] = [];
  let cursor = 0;
  for (let i = 0; i < orig.length; i += 1) {
    while (cursor < prop.length && prop[cursor].text !== orig[i].text) cursor += 1;
    if (cursor === prop.length) {
      return {
        ok: false,
        reason: `Original word ${i + 1} ("${orig[i].text}") is missing, changed, or out of order.`,
      };
    }
    matchAt.push(cursor);
    cursor += 1;
  }

  // Rebuild from the ORIGINAL: original tokens verbatim; each gap between two
  // original tokens keeps the original's own whitespace, unless the proposal
  // inserted tokens there, in which case that gap becomes the proposal's text
  // between the two matched tokens (the inserted words plus their spacing).
  const segments: Segment[] = [];
  const insertions: Insertion[] = [];
  for (let gap = 0; gap <= orig.length; gap += 1) {
    const firstNew = gap === 0 ? 0 : matchAt[gap - 1] + 1;
    const endNew = gap === orig.length ? prop.length : matchAt[gap];
    if (endNew > firstNew) {
      const from = gap === 0 ? 0 : prop[matchAt[gap - 1]].end;
      const to = gap === orig.length ? proposal.length : prop[matchAt[gap]].start;
      const insertStart = prop[firstNew].start;
      const insertEnd = prop[endNew - 1].end;
      const text = proposal.slice(insertStart, insertEnd);
      segments.push({ text: proposal.slice(from, insertStart), inserted: false });
      segments.push({ text, inserted: true });
      segments.push({ text: proposal.slice(insertEnd, to), inserted: false });
      insertions.push({ after: gap - 1, text });
    } else {
      const from = gap === 0 ? 0 : orig[gap - 1].end;
      const to = gap === orig.length ? original.length : orig[gap].start;
      segments.push({ text: original.slice(from, to), inserted: false });
    }
    if (gap < orig.length) segments.push({ text: orig[gap].text, inserted: false });
  }
  // Trim the whole text (save_recipe stores trimmed bodies) and drop empty
  // segments. An inserted segment starts and ends with a token, so trimming
  // only ever touches non-inserted whitespace.
  segments[0].text = segments[0].text.trimStart();
  segments[segments.length - 1].text = segments[segments.length - 1].text.trimEnd();
  const kept = segments.filter((segment) => segment.text.length > 0);
  const final = kept.map((segment) => segment.text).join("");
  return { ok: true, changed: insertions.length > 0, final, insertions, segments: kept };
}

// ---------------------------------------------------------------------------
// Insertion audit (advisory flags for the owner's review; never blocks)
// ---------------------------------------------------------------------------

export type AuditIngredient = { name: string; amount: number };

const UNIT_WORDS = new Set([
  "tsp", "teaspoon", "tbsp", "tablespoon", "cup", "c", "fl", "fluid", "oz", "ounce",
  "lb", "pound", "g", "gram", "kg", "kilogram", "ml", "milliliter", "millilitre",
  "l", "liter", "litre", "qt", "quart", "pt", "pint", "gal", "gallon", "clove",
  "slice", "item", "can", "jar", "package", "pkg", "bunch", "head", "stalk",
  "sprig", "stick", "piece", "pinch", "dash", "handful",
]);

const GLUE_WORDS = new Set([
  "of", "the", "a", "an", "and", "or", "plus", "about", "to", "taste", "divided",
  "each", "more", "for", "serving", "remaining", "half", "total", "whole",
  "large", "medium", "small", "heaping", "scant", "packed",
]);

const FRACTION_VALUES: Record<string, number> = {
  "½": 1 / 2, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 1 / 4, "¾": 3 / 4,
  "⅛": 1 / 8, "⅜": 3 / 8, "⅝": 5 / 8, "⅞": 7 / 8,
};

// Lower-cased word plus its naive singulars ("cups" -> "cup", "bunches" -> "bunch").
function wordForms(word: string): string[] {
  const w = word.toLowerCase();
  const forms = [w];
  if (w.endsWith("es")) forms.push(w.slice(0, -2));
  if (w.endsWith("s")) forms.push(w.slice(0, -1));
  return forms;
}

function isNumberWord(word: string): boolean {
  return /^[0-9½⅓⅔¼¾⅛⅜⅝⅞]+$/.test(word);
}

/** Quantities written in a text: "1 1/2", "1/2", "1.5", "½", "1½", "2". */
export function parseQuantities(text: string): number[] {
  const values: number[] = [];
  const pattern = /(\d+)\s+(\d+)\/(\d+)|(\d+)\/(\d+)|(\d+(?:\.\d+)?)([½⅓⅔¼¾⅛⅜⅝⅞])?|([½⅓⅔¼¾⅛⅜⅝⅞])/g;
  for (const m of text.matchAll(pattern)) {
    if (m[1] !== undefined) values.push(Number(m[1]) + Number(m[2]) / Number(m[3]));
    else if (m[4] !== undefined) values.push(Number(m[4]) / Number(m[5]));
    else if (m[6] !== undefined) values.push(Number(m[6]) + (m[7] ? FRACTION_VALUES[m[7]] : 0));
    else if (m[8] !== undefined) values.push(FRACTION_VALUES[m[8]]);
  }
  return values;
}

export function auditInsertions(insertions: Insertion[], ingredients: AuditIngredient[]): string[] {
  const ingredientWords = new Set<string>();
  const knownNumbers: number[] = [];
  for (const ingredient of ingredients) {
    for (const token of tokenize(ingredient.name)) {
      for (const form of wordForms(token.text)) ingredientWords.add(form);
    }
    if (ingredient.amount > 0) knownNumbers.push(ingredient.amount);
    knownNumbers.push(...parseQuantities(ingredient.name));
  }

  const flags: string[] = [];
  for (const insertion of insertions) {
    for (const token of tokenize(insertion.text)) {
      if (!/[\p{L}\p{N}]/u.test(token.text)) continue; // punctuation is always fine
      if (isNumberWord(token.text)) continue; // numbers are checked below
      const forms = wordForms(token.text);
      if (forms.some((f) => UNIT_WORDS.has(f) || GLUE_WORDS.has(f) || ingredientWords.has(f))) continue;
      flags.push(`Unexpected word "${token.text}" in "${insertion.text}"`);
    }
    for (const value of parseQuantities(insertion.text)) {
      if (!knownNumbers.some((n) => Math.abs(n - value) <= 0.01)) {
        flags.push(`Amount ${Number(value.toFixed(3))} in "${insertion.text}" is not in the ingredient list`);
      }
    }
  }
  return flags;
}

// ---------------------------------------------------------------------------
// The model call's prompt, schema, and response parsing
// ---------------------------------------------------------------------------

export const BACKFILL_SYSTEM_PROMPT = [
  "You add ingredient amounts to the steps of a recipe that a household already cooks from.",
  "",
  "You may only INSERT text. Every character of each original step must appear in your version, unchanged and in the same order. Never reword, reorder, re-punctuate, re-capitalize, fix typos, convert units, or remove anything. A step that breaks this rule is thrown away.",
  "",
  "WHAT TO INSERT. When a step uses an ingredient from the list, insert that ingredient's amount at its first mention in that step, using the amount from the list. Write it the way a cookbook would: digits and simple fractions (1/2, 1/3, 1/4, 3/4, 1 1/2); tsp, tbsp, oz, lb, g, kg, ml, l abbreviated; cup, clove, slice spelled out and pluralized when needed.",
  "",
  'WHERE. Put the amount right before the ingredient words when that reads naturally ("Season with pepper" -> "Season with 2 tsp pepper"). When the ingredient follows "the" or another word that makes that awkward, add the amount in parentheses right after the ingredient instead ("Add the garlic" -> "Add the garlic (4 cloves)"; "Add the eggs" -> "Add the eggs (3)").',
  "",
  'SKIP. Insert nothing for: an ingredient listed as "to taste"; an ingredient the step already gives an amount for; an ingredient the step does not mention; an ingredient split across steps when neither the step nor the ingredient name says how much this step uses (never guess a portion).',
  "",
  "Return every step with its step_number, in order. Return a step exactly as given when there is nothing to insert.",
].join("\n");

export type BackfillRecipe = {
  name: string;
  base_servings: number;
  ingredients: Array<{ name: string; amountText: string }>;
  steps: Array<{ step_number: number; body: string }>;
};

export function buildBackfillUserContent(recipe: BackfillRecipe): string {
  return [
    `RECIPE: ${recipe.name} (serves ${recipe.base_servings})`,
    "",
    "INGREDIENTS:",
    ...recipe.ingredients.map((ingredient) => `- ${ingredient.name}: ${ingredient.amountText}`),
    "",
    "STEPS:",
    ...recipe.steps.map((step) => `${step.step_number}. ${step.body}`),
  ].join("\n");
}

// Structured-output schema (output_config.format). Only keywords Haiku 4.5's
// structured outputs accept: no min/max, no length or array-size constraints;
// additionalProperties:false on every object.
export const BACKFILL_JSON_SCHEMA = {
  type: "object",
  properties: {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          step_number: { type: "integer" },
          body: { type: "string" },
        },
        required: ["step_number", "body"],
        additionalProperties: false,
      },
    },
  },
  required: ["steps"],
  additionalProperties: false,
} as const;

export type ParsedBackfill =
  | { ok: true; bodies: Map<number, string> }
  | { ok: false; reason: string };

export function parseBackfillResponse(json: unknown, expectedStepNumbers: number[]): ParsedBackfill {
  const steps = (json as { steps?: unknown } | null)?.steps;
  if (!Array.isArray(steps)) return { ok: false, reason: "The response has no steps array." };
  const bodies = new Map<number, string>();
  for (const item of steps) {
    const stepNumber = (item as { step_number?: unknown } | null)?.step_number;
    const body = (item as { body?: unknown } | null)?.body;
    if (typeof stepNumber !== "number" || !Number.isInteger(stepNumber) || typeof body !== "string") {
      return { ok: false, reason: "A step in the response is malformed." };
    }
    if (bodies.has(stepNumber)) return { ok: false, reason: `Step ${stepNumber} appears twice in the response.` };
    bodies.set(stepNumber, body);
  }
  const expected = new Set(expectedStepNumbers);
  if (bodies.size !== expected.size || [...bodies.keys()].some((n) => !expected.has(n))) {
    return { ok: false, reason: "The response's step numbers do not match the recipe's steps." };
  }
  return { ok: true, bodies };
}

// ---------------------------------------------------------------------------
// SQL generation (the script writes these files; a human runs them with psql)
// ---------------------------------------------------------------------------

export type ApplyRow = { step_id: string; old_body: string; new_body: string };

// With standard_conforming_strings on (set at the top of every generated
// file), a single-quoted literal needs only its single quotes doubled.
function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function payloadLiteral(rows: ApplyRow[]): string {
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.step_id)) throw new Error(`Duplicate step_id ${row.step_id}`);
    ids.add(row.step_id);
    if (row.old_body === row.new_body) throw new Error(`Step ${row.step_id} has no change`);
  }
  if (rows.length === 0) throw new Error("Nothing to apply");
  return `${sqlLiteral(JSON.stringify(rows))}::jsonb`;
}

export function buildApplySql(rows: ApplyRow[], finish: "COMMIT" | "ROLLBACK", label: string): string {
  return [
    `-- Meal Queue milestone 18 step-amounts backfill: ${label}.`,
    `-- Steps in this file: ${rows.length}. Changes public.recipe_steps.body only. Ends with ${finish}.`,
    "\\set ON_ERROR_STOP on",
    "SET standard_conforming_strings = on;",
    "BEGIN;",
    "",
    "CREATE TEMP TABLE m18_backfill (step_id uuid PRIMARY KEY, old_body text NOT NULL, new_body text NOT NULL) ON COMMIT DROP;",
    "",
    "INSERT INTO m18_backfill (step_id, old_body, new_body)",
    "SELECT step_id, old_body, new_body",
    `FROM jsonb_to_recordset(${payloadLiteral(rows)}) AS x(step_id uuid, old_body text, new_body text);`,
    "",
    "-- Every reviewed step must still exist with exactly the reviewed text.",
    "DO $$",
    "DECLARE v_expected int; v_matching int;",
    "BEGIN",
    "  SELECT count(*) INTO v_expected FROM m18_backfill;",
    "  SELECT count(*) INTO v_matching FROM public.recipe_steps s JOIN m18_backfill b ON b.step_id = s.id AND s.body = b.old_body;",
    "  IF v_matching <> v_expected THEN",
    "    RAISE EXCEPTION 'M18 preflight: % of % steps still match their reviewed text', v_matching, v_expected;",
    "  END IF;",
    "END $$;",
    "",
    "UPDATE public.recipe_steps s SET body = b.new_body FROM m18_backfill b WHERE s.id = b.step_id AND s.body = b.old_body;",
    "",
    "DO $$",
    "DECLARE v_expected int; v_done int;",
    "BEGIN",
    "  SELECT count(*) INTO v_expected FROM m18_backfill;",
    "  SELECT count(*) INTO v_done FROM public.recipe_steps s JOIN m18_backfill b ON b.step_id = s.id AND s.body = b.new_body;",
    "  IF v_done <> v_expected THEN",
    "    RAISE EXCEPTION 'M18 verify: % of % steps carry the new text', v_done, v_expected;",
    "  END IF;",
    "  RAISE NOTICE 'M18 backfill: % steps updated', v_done;",
    "END $$;",
    "",
    `${finish};`,
    "",
  ].join("\n");
}

export function buildCheckSql(rows: ApplyRow[]): string {
  return [
    "-- Meal Queue milestone 18 check (read-only). Run before and after the apply; compare the output.",
    "\\set ON_ERROR_STOP on",
    "SET standard_conforming_strings = on;",
    `WITH b AS (SELECT * FROM jsonb_to_recordset(${payloadLiteral(rows)}) AS x(step_id uuid, old_body text, new_body text))`,
    "SELECT",
    "  (SELECT count(*) FROM b) AS payload_steps,",
    "  (SELECT count(*) FROM public.recipe_steps s JOIN b ON b.step_id = s.id AND s.body = b.old_body) AS still_old,",
    "  (SELECT count(*) FROM public.recipe_steps s JOIN b ON b.step_id = s.id AND s.body = b.new_body) AS now_new,",
    "  (SELECT count(*) FROM public.recipes) AS recipes,",
    "  (SELECT count(*) FROM public.recipe_steps) AS steps,",
    "  (SELECT count(*) FROM public.ingredients) AS ingredients,",
    "  (SELECT md5(string_agg(s.id::text || ':' || s.step_number || ':' || s.body, '|' ORDER BY s.id)) FROM public.recipe_steps s WHERE s.id NOT IN (SELECT step_id FROM b)) AS untouched_steps_md5,",
    "  (SELECT md5(string_agg(i.id::text || ':' || i.name || ':' || i.amount::text || ':' || i.unit_code || ':' || i.is_pantry_staple::text, '|' ORDER BY i.id)) FROM public.ingredients i) AS ingredients_md5,",
    "  (SELECT md5(string_agg(p.id::text || ':' || p.version || ':' || coalesce(p.groceries_version::text, 'null'), '|' ORDER BY p.id)) FROM public.meal_plans p) AS plan_versions_md5,",
    "  (SELECT md5(string_agg(r.id::text || ':' || r.updated_at::text, '|' ORDER BY r.id)) FROM public.recipes r) AS recipes_updated_md5;",
    "",
  ].join("\n");
}
````

## Appendix B: `lib/step-amounts.test.ts` (create verbatim, 30 tests)

````ts
import { describe, expect, it } from "vitest";
import { IMPORT_MODEL } from "./import/anthropic";
import {
  BACKFILL_JSON_SCHEMA,
  BACKFILL_MODEL,
  BACKFILL_SYSTEM_PROMPT,
  auditInsertions,
  buildApplySql,
  buildBackfillUserContent,
  buildCheckSql,
  checkInsertOnly,
  parseBackfillResponse,
  parseQuantities,
  tokenize,
} from "./step-amounts";

const STEP_ID = "00000000-0000-0000-0000-000000000001";

describe("tokenize", () => {
  it("splits words from punctuation and ignores whitespace", () => {
    expect(tokenize("Add 1/2 cup.").map((t) => t.text)).toEqual(["Add", "1", "/", "2", "cup", "."]);
    expect(tokenize("Add 1/2 cup.")[4]).toEqual({ text: "cup", start: 8, end: 11 });
    expect(tokenize("  skin-side \n down ").map((t) => t.text)).toEqual(["skin", "-", "side", "down"]);
  });

  it("keeps accented words and number-fraction runs whole", () => {
    expect(tokenize("Sauté the jalapeño").map((t) => t.text)).toEqual(["Sauté", "the", "jalapeño"]);
    expect(tokenize("Sauté it").map((t) => t.text)).toEqual(["Sauté", "it"]);
    expect(tokenize("350°F, 1½ cups").map((t) => t.text)).toEqual(["350", "°", "F", ",", "1½", "cups"]);
  });
});

describe("checkInsertOnly", () => {
  it("accepts an amount inserted before the ingredient", () => {
    const result = checkInsertOnly("Season with pepper.", "Season with 2 tsp pepper.");
    expect(result).toMatchObject({ ok: true, changed: true, final: "Season with 2 tsp pepper." });
    if (result.ok) expect(result.insertions).toEqual([{ after: 1, text: "2 tsp" }]);
  });

  it("accepts a parenthetical before trailing punctuation", () => {
    const result = checkInsertOnly("Add the garlic.", "Add the garlic (4 cloves).");
    expect(result).toMatchObject({ ok: true, final: "Add the garlic (4 cloves)." });
    if (result.ok) expect(result.insertions).toEqual([{ after: 2, text: "(4 cloves)" }]);
  });

  it("accepts insertions at the very start and end", () => {
    const result = checkInsertOnly("eggs, beaten", "3 eggs, beaten (about 1 cup)");
    expect(result).toMatchObject({ ok: true, final: "3 eggs, beaten (about 1 cup)" });
    if (result.ok) {
      expect(result.insertions).toEqual([
        { after: -1, text: "3" },
        { after: 2, text: "(about 1 cup)" },
      ]);
    }
  });

  it("reports an identical proposal as unchanged", () => {
    const text = "Roast 15 minutes, rest 5, then serve.";
    expect(checkInsertOnly(text, text)).toMatchObject({ ok: true, changed: false, final: text });
  });

  it("rejects a changed word", () => {
    const result = checkInsertOnly("Add salt.", "Add 1 tsp salts.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('"salt"');
  });

  it("rejects a dropped word", () => {
    expect(checkInsertOnly("Stir well and serve.", "Stir and serve.").ok).toBe(false);
  });

  it("rejects reordered words", () => {
    expect(checkInsertOnly("Add salt and pepper.", "Add pepper and salt.").ok).toBe(false);
  });

  it("rejects changed or dropped punctuation", () => {
    expect(checkInsertOnly("Add salt, then pepper.", "Add salt; then pepper.").ok).toBe(false);
    expect(checkInsertOnly("Simmer 3–4 minutes.", "Simmer 3-4 minutes.").ok).toBe(false);
    expect(checkInsertOnly("Season to taste.", "Season to taste").ok).toBe(false);
  });

  it("rejects a capitalization change", () => {
    expect(checkInsertOnly("add salt", "Add 1 tsp salt").ok).toBe(false);
  });

  it("keeps the original's whitespace wherever nothing was inserted", () => {
    expect(checkInsertOnly("Mix well.\nServe hot.", "Mix well. Serve hot with 1 cup rice.")).toMatchObject({
      ok: true,
      final: "Mix well.\nServe hot with 1 cup rice.",
    });
    expect(checkInsertOnly("Add  salt", "Add salt (1 tsp)")).toMatchObject({ ok: true, final: "Add  salt (1 tsp)" });
  });

  it("rejects an empty original and an empty proposal", () => {
    expect(checkInsertOnly("   ", "Add 1 tsp salt").ok).toBe(false);
    expect(checkInsertOnly("Add salt", "").ok).toBe(false);
  });

  it("attributes an insertion to the first of repeated words", () => {
    const result = checkInsertOnly(
      "Melt half the butter, then add the rest of the butter.",
      "Melt half the butter (2 tbsp), then add the rest of the butter.",
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.insertions).toEqual([{ after: 3, text: "(2 tbsp)" }]);
  });

  it("returns segments that join to the final text and mark only insertions", () => {
    const cases: Array<[string, string]> = [
      ["Season with pepper.", "Season with 2 tsp pepper."],
      ["eggs, beaten", "  3 eggs, beaten (about 1 cup)  "],
      ["Mix well.\nServe hot.", "Mix well. Serve hot with 1 cup rice."],
      ["  Add salt  ", "Add 1 tsp salt"],
    ];
    for (const [original, proposal] of cases) {
      const result = checkInsertOnly(original, proposal);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.segments.map((s) => s.text).join("")).toBe(result.final);
      expect(result.segments.filter((s) => s.inserted).map((s) => s.text)).toEqual(
        result.insertions.map((i) => i.text),
      );
      expect(result.segments.every((s) => s.text.length > 0)).toBe(true);
    }
  });
});

describe("auditInsertions", () => {
  it("flags inserted words that are not amounts, units, or ingredient words", () => {
    const result = checkInsertOnly(
      "Warm cherry tomatoes until they burst.",
      "Warm 1 lb cherry tomatoes until they do not burst.",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(auditInsertions(result.insertions, [{ name: "cherry tomatoes", amount: 1 }])).toEqual([
      'Unexpected word "do" in "do not"',
      'Unexpected word "not" in "do not"',
    ]);
  });

  it("accepts ingredient words, plurals, units, and glue words", () => {
    const ingredients = [
      { name: "kosher salt", amount: 1 },
      { name: "lemon", amount: 2 },
    ];
    expect(auditInsertions([{ after: 0, text: "1 tsp kosher" }], ingredients)).toEqual([]);
    expect(auditInsertions([{ after: 0, text: "(2 lemons)" }], ingredients)).toEqual([]);
    expect(auditInsertions([{ after: 0, text: "2 tablespoons of the" }], ingredients)).toEqual([]);
    expect(auditInsertions([{ after: 0, text: "1tsp" }], ingredients)).toEqual(['Unexpected word "1tsp" in "1tsp"']);
  });

  it("flags an amount that is not in the ingredient list", () => {
    expect(auditInsertions([{ after: 0, text: "3 cups" }], [{ name: "broth", amount: 1.5 }])).toEqual([
      'Amount 3 in "3 cups" is not in the ingredient list',
    ]);
  });

  it("matches cookbook fractions and numbers inside ingredient names", () => {
    const ingredients = [
      { name: "broth", amount: 1.5 },
      { name: "black beans (15-oz can)", amount: 1 },
      { name: "sugar", amount: 0.333 },
    ];
    expect(auditInsertions([{ after: 0, text: "1 1/2 cups" }], ingredients)).toEqual([]);
    expect(auditInsertions([{ after: 0, text: "(15-oz can)" }], ingredients)).toEqual([]);
    expect(auditInsertions([{ after: 0, text: "1/3 cup" }], ingredients)).toEqual([]);
  });
});

describe("parseQuantities", () => {
  it("reads mixed numbers, fractions, decimals, and vulgar fractions", () => {
    expect(parseQuantities("1 1/2 cups")).toEqual([1.5]);
    expect(parseQuantities("1/2 tsp")).toEqual([0.5]);
    expect(parseQuantities("½ tsp and 1½ cups and 2.25 lb")).toEqual([0.5, 1.5, 2.25]);
    expect(parseQuantities("(4 cloves)")).toEqual([4]);
  });
});

describe("parseBackfillResponse", () => {
  it("returns step bodies keyed by step number", () => {
    const parsed = parseBackfillResponse(
      { steps: [{ step_number: 1, body: "a" }, { step_number: 2, body: "b" }] },
      [1, 2],
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.bodies.get(2)).toBe("b");
  });

  it("rejects missing, duplicate, malformed, or non-integer steps", () => {
    expect(parseBackfillResponse({ steps: [{ step_number: 1, body: "a" }] }, [1, 2]).ok).toBe(false);
    expect(
      parseBackfillResponse({ steps: [{ step_number: 1, body: "a" }, { step_number: 1, body: "b" }] }, [1]).ok,
    ).toBe(false);
    expect(parseBackfillResponse({ steps: [{ step_number: 1, body: 5 }] }, [1]).ok).toBe(false);
    expect(parseBackfillResponse({ steps: [{ step_number: 1.5, body: "a" }] }, [1]).ok).toBe(false);
    expect(parseBackfillResponse({ steps: [null] }, [1]).ok).toBe(false);
    expect(parseBackfillResponse(null, [1]).ok).toBe(false);
  });
});

describe("backfill prompt", () => {
  it("uses the import model", () => {
    expect(BACKFILL_MODEL).toBe(IMPORT_MODEL);
  });

  it("states the insert-only, to-taste, and no-guessing rules", () => {
    expect(BACKFILL_SYSTEM_PROMPT).toContain("You may only INSERT text");
    expect(BACKFILL_SYSTEM_PROMPT).toContain('listed as "to taste"');
    expect(BACKFILL_SYSTEM_PROMPT).toContain("never guess a portion");
  });

  it("builds the user content with amounts and numbered steps", () => {
    const content = buildBackfillUserContent({
      name: "Soup",
      base_servings: 4,
      ingredients: [
        { name: "salt", amountText: "to taste" },
        { name: "broth", amountText: "1.5 cup" },
      ],
      steps: [{ step_number: 1, body: "Add broth." }],
    });
    expect(content).toBe(
      "RECIPE: Soup (serves 4)\n\nINGREDIENTS:\n- salt: to taste\n- broth: 1.5 cup\n\nSTEPS:\n1. Add broth.",
    );
  });

  it("uses only structured-output keywords Haiku accepts", () => {
    expect(BACKFILL_JSON_SCHEMA.additionalProperties).toBe(false);
    expect(BACKFILL_JSON_SCHEMA.properties.steps.items.additionalProperties).toBe(false);
    const text = JSON.stringify(BACKFILL_JSON_SCHEMA);
    for (const keyword of ["minItems", "maxItems", "minLength", "maxLength", "minimum", "maximum"]) {
      expect(text).not.toContain(keyword);
    }
  });
});

describe("SQL generation", () => {
  const rows = [
    { step_id: STEP_ID, old_body: "Add the cook's salt \\ now.", new_body: "Add the cook's salt (1 tsp) \\ now." },
  ];

  it("doubles single quotes and keeps backslashes literal", () => {
    const sql = buildApplySql(rows, "COMMIT", "apply");
    expect(sql).toContain("SET standard_conforming_strings = on;");
    expect(sql).toContain("cook''s salt");
    expect(sql).toContain("\\\\ now.");
  });

  it("ends with COMMIT or ROLLBACK as asked", () => {
    expect(buildApplySql(rows, "COMMIT", "apply").trimEnd().endsWith("COMMIT;")).toBe(true);
    expect(buildApplySql(rows, "ROLLBACK", "rehearsal").trimEnd().endsWith("ROLLBACK;")).toBe(true);
  });

  it("refuses empty, duplicate, or no-op payloads", () => {
    expect(() => buildApplySql([], "COMMIT", "apply")).toThrow();
    expect(() => buildApplySql([{ step_id: STEP_ID, old_body: "x", new_body: "x" }], "COMMIT", "apply")).toThrow();
    expect(() =>
      buildApplySql(
        [
          { step_id: STEP_ID, old_body: "x", new_body: "y" },
          { step_id: STEP_ID, old_body: "x", new_body: "z" },
        ],
        "COMMIT",
        "apply",
      ),
    ).toThrow();
  });

  it("builds a read-only check query over the same payload", () => {
    const sql = buildCheckSql(rows);
    expect(sql).toContain("untouched_steps_md5");
    expect(sql).toContain("plan_versions_md5");
    expect(sql).not.toMatch(/\b(UPDATE|INSERT|DELETE|BEGIN|COMMIT)\b/);
  });
});
````

## Appendix C: `scripts/backfill-step-amounts.mjs` (create verbatim)

````js
// Milestone 18: one-time backfill that writes ingredient amounts into existing
// recipe steps (insert-only, owner-reviewed). Spec: docs/plans/amounts-in-steps.md.
//
//   export   --target local|prod --out <dir>   read recipes into <dir>/snapshot.json (read-only)
//   propose  --out <dir> [--responses <file>] [--limit <n>]
//            ask the model (or replay canned responses) for insert-only rewrites;
//            writes <dir>/proposals.json and <dir>/review.html
//   sql      --out <dir> [--exclude <codes>]   write apply.sql, rehearsal.sql, revert.sql,
//            check.sql and applied-steps.json for every accepted, non-excluded step
//
// This script never writes to a database. `export` runs one read-only SELECT
// through psql; the generated SQL files are run by a person, by hand, with psql.
// --out must be outside the repo: snapshots and proposals hold household data.
// Run with: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/backfill-step-amounts.mjs ...
// (Node >= 23.6 loads the two imported .ts files with built-in type stripping.)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatIngredientAmount } from "../lib/grocery.ts";
import {
  BACKFILL_JSON_SCHEMA,
  BACKFILL_MODEL,
  BACKFILL_SYSTEM_PROMPT,
  auditInsertions,
  buildApplySql,
  buildBackfillUserContent,
  buildCheckSql,
  checkInsertOnly,
  parseBackfillResponse,
} from "../lib/step-amounts.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PSQL = "/opt/homebrew/opt/libpq/bin/psql";
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
// Claude Haiku 4.5 list price per million tokens (checked 2026-10-02).
const USD_PER_MTOK_IN = 1;
const USD_PER_MTOK_OUT = 5;

const EXPORT_SQL = `
select coalesce(json_agg(r order by r.name, r.id), '[]'::json)
from (
  select rec.id, rec.name, rec.base_servings::float8 as base_servings,
    (select coalesce(json_agg(json_build_object(
              'name', i.name, 'amount', i.amount::float8, 'unit_code', i.unit_code, 'unit_label', u.label)
            order by i.created_at, i.id), '[]'::json)
       from public.ingredients i join public.units u on u.code = i.unit_code
      where i.recipe_id = rec.id) as ingredients,
    (select json_agg(json_build_object('id', s.id, 'step_number', s.step_number, 'body', s.body)
            order by s.step_number)
       from public.recipe_steps s
      where s.recipe_id = rec.id) as steps
  from public.recipes rec
  where exists (select 1 from public.recipe_steps s2 where s2.recipe_id = rec.id)
) r`;

function die(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    if (!rest[i].startsWith("--")) die(`Unexpected argument ${rest[i]}`);
    options[rest[i].slice(2)] = rest[i + 1];
    i += 1;
  }
  return { command, options };
}

function resolveOut(dir) {
  if (!dir) die("--out <dir> is required.");
  const abs = path.resolve(dir.replace(/^~(?=$|\/)/, os.homedir()));
  if (abs === REPO_ROOT || abs.startsWith(REPO_ROOT + path.sep)) {
    die("--out must be outside the repo (snapshots and proposals hold household data).");
  }
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

// Reads one key from .env.local without printing it.
function readEnvLocal(key) {
  const file = path.join(REPO_ROOT, ".env.local");
  if (!fs.existsSync(file)) return undefined;
  const line = fs.readFileSync(file, "utf8").split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  if (!line) return undefined;
  return line.slice(key.length + 1).trim().replace(/^(["'])(.*)\1$/, "$2") || undefined;
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------- export

function runExport(options) {
  const out = resolveOut(options.out);
  const target = options.target;
  if (target !== "local" && target !== "prod") die("--target must be local or prod.");
  const url = target === "local" ? LOCAL_DB : readEnvLocal("DATABASE_URL");
  if (!url) die("DATABASE_URL is missing from .env.local.");
  console.log(`Exporting from ${target === "local" ? "the LOCAL stack (127.0.0.1:54322)" : "PROD (DATABASE_URL from .env.local)"} ...`);
  const raw = execFileSync(PSQL, [url, "-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", EXPORT_SQL], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const recipes = JSON.parse(raw);
  writeJson(path.join(out, "snapshot.json"), { exported_at: new Date().toISOString(), target, recipes });
  const steps = recipes.reduce((sum, r) => sum + r.steps.length, 0);
  console.log(`Wrote snapshot.json: ${recipes.length} recipes with steps, ${steps} steps.`);
}

// ---------------------------------------------------------------- propose

async function callModel(apiKey, userContent) {
  const body = JSON.stringify({
    model: BACKFILL_MODEL,
    max_tokens: 8192,
    temperature: 0,
    system: BACKFILL_SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: BACKFILL_JSON_SCHEMA } },
    messages: [{ role: "user", content: userContent }],
  });
  const post = () =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(60_000),
    });
  let res = await post();
  if (res.status === 429 || res.status === 529) {
    await sleep(2000);
    res = await post();
  }
  if (!res.ok) throw new Error(`API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const payload = await res.json();
  if (payload.stop_reason === "max_tokens") throw new Error("The response was cut off (max_tokens).");
  if (payload.stop_reason === "refusal") throw new Error("The model declined this recipe.");
  const text = payload.content?.find((block) => block?.type === "text")?.text;
  if (typeof text !== "string") throw new Error("The response had no text block.");
  return {
    json: JSON.parse(text),
    usage: { input: payload.usage?.input_tokens ?? 0, output: payload.usage?.output_tokens ?? 0 },
  };
}

async function runPropose(options) {
  const out = resolveOut(options.out);
  const snapshotFile = path.join(out, "snapshot.json");
  if (!fs.existsSync(snapshotFile)) die(`No snapshot.json in ${out}. Run export first.`);
  const snapshot = readJson(snapshotFile);
  const canned = options.responses ? readJson(path.resolve(options.responses)) : null;
  const apiKey = canned ? null : process.env.ANTHROPIC_API_KEY || readEnvLocal("ANTHROPIC_API_KEY");
  if (!canned && !apiKey) die("ANTHROPIC_API_KEY is not set (env or .env.local).");
  const limit = options.limit ? Number(options.limit) : snapshot.recipes.length;
  const recipes = snapshot.recipes.slice(0, limit);
  const width = Math.max(2, String(recipes.length).length);
  const usage = { input: 0, output: 0 };
  const results = [];

  for (const [index, recipe] of recipes.entries()) {
    const code = `R${String(index + 1).padStart(width, "0")}`;
    const ingredients = recipe.ingredients.map((ing) => ({
      name: ing.name,
      amount: ing.amount,
      amountText: formatIngredientAmount(ing.amount, ing.unit_label),
    }));
    const entry = {
      code,
      id: recipe.id,
      name: recipe.name,
      base_servings: recipe.base_servings,
      ingredients: ingredients.map(({ name, amountText }) => ({ name, amountText })),
      status: "ok",
      reason: null,
      steps: [],
    };
    const keep = (step, status, reason, proposal) => ({
      code: `${code}.${step.step_number}`,
      step_id: step.id,
      step_number: step.step_number,
      original: step.body,
      proposal,
      status,
      reason,
      final: step.body,
      segments: [{ text: step.body, inserted: false }],
      insertions: [],
      flags: [],
    });

    let json = null;
    try {
      if (canned) {
        json = canned[recipe.name];
        if (json === undefined) {
          entry.status = "skipped";
          entry.reason = "No canned response for this recipe.";
        }
      } else {
        const userContent = buildBackfillUserContent({
          name: recipe.name,
          base_servings: recipe.base_servings,
          ingredients: entry.ingredients,
          steps: recipe.steps.map((s) => ({ step_number: s.step_number, body: s.body })),
        });
        const result = await callModel(apiKey, userContent);
        json = result.json;
        usage.input += result.usage.input;
        usage.output += result.usage.output;
      }
    } catch (error) {
      entry.status = "rejected";
      entry.reason = String(error.message ?? error);
    }

    if (entry.status === "ok") {
      const parsed = parseBackfillResponse(json, recipe.steps.map((s) => s.step_number));
      if (!parsed.ok) {
        entry.status = "rejected";
        entry.reason = parsed.reason;
      } else {
        for (const step of recipe.steps) {
          const proposal = parsed.bodies.get(step.step_number);
          const guard = checkInsertOnly(step.body, proposal);
          if (!guard.ok) {
            entry.steps.push(keep(step, "rejected", guard.reason, proposal));
          } else if (!guard.changed) {
            entry.steps.push(keep(step, "unchanged", null, proposal));
          } else {
            entry.steps.push({
              ...keep(step, "accepted", null, proposal),
              final: guard.final,
              segments: guard.segments,
              insertions: guard.insertions,
              flags: auditInsertions(guard.insertions, ingredients),
            });
          }
        }
      }
    }
    if (entry.status !== "ok") {
      entry.steps = recipe.steps.map((step) => keep(step, "kept", null, null));
    }
    results.push(entry);
    console.log(`${code} ${recipe.name}: ${entry.status === "ok" ? summarizeSteps(entry.steps) : `${entry.status} (${entry.reason})`}`);
  }

  const estimatedUsd = (usage.input * USD_PER_MTOK_IN + usage.output * USD_PER_MTOK_OUT) / 1_000_000;
  const proposals = {
    generated_at: new Date().toISOString(),
    source: snapshot.target,
    model: canned ? "canned responses" : BACKFILL_MODEL,
    usage: { ...usage, estimated_usd: Number(estimatedUsd.toFixed(4)) },
    recipes: results,
  };
  writeJson(path.join(out, "proposals.json"), proposals);
  fs.writeFileSync(path.join(out, "review.html"), renderReview(proposals));
  const all = results.flatMap((r) => r.steps);
  console.log(
    `\n${results.length} recipes: ${count(all, "accepted")} steps get amounts, ${count(all, "unchanged")} unchanged, ` +
      `${count(all, "rejected") + count(all, "kept")} kept as is, ${all.filter((s) => s.flags.length > 0).length} flagged.`,
  );
  console.log(`Tokens: ${usage.input} in / ${usage.output} out, about $${estimatedUsd.toFixed(4)}.`);
  console.log(`Wrote proposals.json and review.html in ${out}`);
}

const count = (steps, status) => steps.filter((s) => s.status === status).length;
const summarizeSteps = (steps) =>
  `${count(steps, "accepted")} accepted, ${count(steps, "unchanged")} unchanged, ${count(steps, "rejected")} rejected`;

// ---------------------------------------------------------------- review page

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const STATUS_LABEL = {
  accepted: ["ok", "amounts added"],
  unchanged: ["", "no change"],
  rejected: ["bad", "kept as is"],
  kept: ["bad", "kept as is"],
};

function renderStep(step) {
  const [tone, label] = STATUS_LABEL[step.status];
  const text = step.segments
    .map((segment) => (segment.inserted ? `<ins>${escapeHtml(segment.text)}</ins>` : escapeHtml(segment.text)))
    .join("");
  const flags = step.flags.length
    ? `<ul class="flags">${step.flags.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`
    : "";
  const reason = step.reason ? `<p class="reason">Why: ${escapeHtml(step.reason)}</p>` : "";
  const rejected =
    step.status === "rejected" && typeof step.proposal === "string"
      ? `<details><summary>The rejected proposal</summary><p class="proposal">${escapeHtml(step.proposal)}</p></details>`
      : "";
  return `<li class="step" id="${step.code}"><div class="step-head"><span class="code">${step.code}</span><span class="chip ${tone}">${label}</span>${step.flags.length ? '<span class="chip flag">check</span>' : ""}</div><p class="body">${text}</p>${flags}${reason}${rejected}</li>`;
}

function renderRecipe(recipe) {
  const accepted = count(recipe.steps, "accepted");
  const headline =
    recipe.status === "ok"
      ? `<span class="chip ${accepted ? "ok" : ""}">${accepted} of ${recipe.steps.length} steps get amounts</span>`
      : `<span class="chip bad">kept as is</span>`;
  const reason = recipe.status === "ok" ? "" : `<p class="reason">Why: ${escapeHtml(recipe.reason)}</p>`;
  const ingredients = recipe.ingredients
    .map((ing) => `<li>${escapeHtml(ing.name)}: ${escapeHtml(ing.amountText)}</li>`)
    .join("");
  return `<article class="recipe" id="${recipe.code}"><header><span class="code">${recipe.code}</span><h2>${escapeHtml(recipe.name)}</h2>${headline}</header>${reason}<details class="ings"><summary>Ingredients (${recipe.ingredients.length}) at ${escapeHtml(recipe.base_servings)} servings</summary><ul>${ingredients}</ul></details><ol class="steps">${recipe.steps.map(renderStep).join("")}</ol></article>`;
}

function renderReview(proposals) {
  const steps = proposals.recipes.flatMap((r) => r.steps);
  const look = steps.filter((s) => s.flags.length > 0 || s.status === "rejected");
  const lookList = look.length
    ? `<p class="look">Worth a look first: ${look.map((s) => `<a href="#${s.code}">${s.code}</a>`).join(", ")}</p>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Step amounts review</title>
<style>
:root {
  --bg: #fafaf8; --surface: #ffffff; --ink: #16211e; --muted: #5e6b67; --line: #e4e6e1;
  --brand: #12695e; --ok-bg: #e3eeeb; --ins-bg: #f6e8cf; --ins-ink: #7a5a17;
  --bad-bg: #f3e3e3; --bad-ink: #a13c3c;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #131a18; --surface: #1d2724; --ink: #f3f6f4; --muted: #9fb0aa; --line: #2a3733;
    --brand: #8fd1c4; --ok-bg: #24413b; --ins-bg: #4d3b12; --ins-ink: #f6e8cf;
    --bad-bg: #4a2626; --bad-ink: #f0b9b9;
  }
}
:root[data-theme="dark"] {
  --bg: #131a18; --surface: #1d2724; --ink: #f3f6f4; --muted: #9fb0aa; --line: #2a3733;
  --brand: #8fd1c4; --ok-bg: #24413b; --ins-bg: #4d3b12; --ins-ink: #f6e8cf;
  --bad-bg: #4a2626; --bad-ink: #f0b9b9;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow-wrap: anywhere; }
main { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
.summary, .look, .reason { color: var(--muted); }
.howto { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; margin: 12px 0 20px; }
.recipe { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; margin: 0 0 16px; }
.recipe header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.recipe h2 { font-size: 1.1rem; margin: 0; flex: 1 1 auto; }
.code { font-weight: 800; font-variant-numeric: tabular-nums; color: var(--brand); }
.chip { font-size: 0.78rem; font-weight: 700; border-radius: 999px; padding: 2px 8px; background: var(--line); color: var(--muted); }
.chip.ok { background: var(--ok-bg); color: var(--brand); }
.chip.bad { background: var(--bad-bg); color: var(--bad-ink); }
.chip.flag { background: var(--ins-bg); color: var(--ins-ink); }
.ings { margin: 8px 0; color: var(--muted); }
.steps { list-style: none; margin: 8px 0 0; padding: 0; border-top: 1px solid var(--line); }
.step { padding: 10px 0; border-bottom: 1px solid var(--line); }
.step-head { display: flex; gap: 8px; align-items: center; }
.body { margin: 6px 0 0; }
ins { background: var(--ins-bg); color: var(--ins-ink); text-decoration: none; font-weight: 700; border-radius: 4px; padding: 0 3px; }
.flags { margin: 6px 0 0; padding-left: 18px; color: var(--ins-ink); }
.proposal { color: var(--muted); }
a { color: var(--brand); }
</style>
</head>
<body>
<main>
<h1>Step amounts review</h1>
<p class="summary">Recipes: ${proposals.recipes.length}. Steps with amounts added: ${count(steps, "accepted")}. No change needed: ${count(steps, "unchanged")}. Left as they are: ${count(steps, "rejected") + count(steps, "kept")}. Source: ${escapeHtml(proposals.source)}, ${escapeHtml(proposals.model)}.</p>
<div class="howto">Highlighted text is the only thing that would be added. Reply in chat with <b>apply</b> to write every highlighted step, or with codes to leave things out, for example <b>apply, exclude R03.2, R11</b> (one step, then a whole recipe). Nothing is written until you say apply.</div>
${lookList}
${proposals.recipes.map(renderRecipe).join("\n")}
</main>
</body>
</html>
`;
}

// ---------------------------------------------------------------- sql

function runSql(options) {
  const out = resolveOut(options.out);
  const proposalsFile = path.join(out, "proposals.json");
  if (!fs.existsSync(proposalsFile)) die(`No proposals.json in ${out}. Run propose first.`);
  const proposals = readJson(proposalsFile);
  const known = new Set(proposals.recipes.flatMap((r) => [r.code, ...r.steps.map((s) => s.code)]));
  const excluded = (options.exclude ?? "")
    .split(/[\s,]+/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  for (const code of excluded) if (!known.has(code)) die(`Unknown code ${code}. Nothing written.`);
  const skip = new Set(excluded);

  const applied = [];
  for (const recipe of proposals.recipes) {
    if (recipe.status !== "ok" || skip.has(recipe.code)) continue;
    for (const step of recipe.steps) {
      if (step.status !== "accepted" || skip.has(step.code)) continue;
      applied.push({ code: step.code, recipe: recipe.name, step_id: step.step_id, old_body: step.original, new_body: step.final });
    }
  }
  if (applied.length === 0) {
    console.log("Nothing to apply. No files written.");
    return;
  }
  const rows = applied.map(({ step_id, old_body, new_body }) => ({ step_id, old_body, new_body }));
  const reverse = rows.map(({ step_id, old_body, new_body }) => ({ step_id, old_body: new_body, new_body: old_body }));
  fs.writeFileSync(path.join(out, "apply.sql"), buildApplySql(rows, "COMMIT", "apply"));
  fs.writeFileSync(path.join(out, "rehearsal.sql"), buildApplySql(rows, "ROLLBACK", "rehearsal (rolls back)"));
  fs.writeFileSync(path.join(out, "revert.sql"), buildApplySql(reverse, "COMMIT", "revert (restores the reviewed originals)"));
  fs.writeFileSync(path.join(out, "check.sql"), buildCheckSql(rows));
  writeJson(path.join(out, "applied-steps.json"), { generated_at: new Date().toISOString(), excluded, steps: applied });
  const recipeCount = new Set(applied.map((a) => a.recipe)).size;
  console.log(`${applied.length} steps across ${recipeCount} recipes. Excluded: ${excluded.length ? excluded.join(", ") : "none"}.`);
  console.log(`Wrote apply.sql, rehearsal.sql, revert.sql, check.sql, applied-steps.json in ${out}`);
}

// ---------------------------------------------------------------- main

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "export") runExport(options);
  else if (command === "propose") await runPropose(options);
  else if (command === "sql") runSql(options);
  else die("Usage: backfill-step-amounts.mjs <export|propose|sql> --out <dir> [options]");
}

main().catch((error) => {
  console.error("FAILED:", error);
  process.exitCode = 1;
});
````

## Appendix D: `scripts/backfill-fixtures/seed-review-responses.json` (create verbatim)

Canned model responses for the seed recipes, keyed by recipe name. Each one exercises a path: accepted, unchanged, rejected (a changed word), rejected (a missing step), flagged (an amount not in the list), flagged (meaning-changing words).

````json
{
  "Lemon Chicken Thighs": { "steps": [
    { "step_number": 1, "body": "Pat the chicken thighs (1 1/2 lb) dry and season all over with 1 tsp salt." },
    { "step_number": 2, "body": "Sear the chicken thighs skin-side down in 2 tbsp olive oil until golden, about 6 minutes." },
    { "step_number": 3, "body": "Add the garlic (4 cloves), squeeze in the lemon (2), and scrape up the brown bits." },
    { "step_number": 4, "body": "Roast 15 minutes, rest 5, then serve." } ] },
  "Weeknight Chili": { "steps": [
    { "step_number": 1, "body": "Brown the ground beef (1 lb) with the onion (1)." },
    { "step_number": 2, "body": "Stir in 2 tbsp chili powder and 1 tsp cumin until fragrant." },
    { "step_number": 3, "body": "Add 2 cups crushed tomatoes and 3 cups kidney beans; simmer 25 minutes." } ] },
  "Sheet-Pan Salmon": { "steps": [
    { "step_number": 1, "body": "Start the 1 1/2 cups jasmine rice." },
    { "step_number": 2, "body": "Toss the broccoli (1 lb) in 2 tbsp soy sauce; roast with the salmon fillet (1 lb) 12 minutes." } ] },
  "Caprese Pasta": { "steps": [
    { "step_number": 1, "body": "Boil the rigatoni (12 oz)." },
    { "step_number": 2, "body": "Warm 1 lb cherry tomatoes in 1 tbsp olive oil until they do not burst." },
    { "step_number": 3, "body": "Toss with 8 oz mozzarella and basil off the heat." } ] }
}
````

Expected `propose` output on the seed recipes (as run before handoff on a synthetic snapshot of the same data, with one extra local recipe, "Import Verify Pancakes", that a harness leaves behind):

```
R01 Caprese Pasta: 3 accepted, 0 unchanged, 0 rejected
R02 Import Verify Pancakes: skipped (No canned response for this recipe.)
R03 Lemon Chicken Thighs: 2 accepted, 1 unchanged, 1 rejected
R04 Sheet-Pan Salmon: rejected (The response's step numbers do not match the recipe's steps.)
R05 Weeknight Chili: 3 accepted, 0 unchanged, 0 rejected
```

Flags: Caprese step 2 `Unexpected word "do"` and `"not"`; Chili step 3 `Amount 3 in "3 cups" is not in the ingredient list`. Lemon step 3's reason: `Original word 14 ("browned") is missing, changed, or out of order.` `sql --exclude <Caprese step 2 code>` then reports `7 steps across 3 recipes`.

## Appendix E: recipe-page wake lock (ONLY if W1 = b)

Ported from `components/cook-mode.tsx:74-107` without the state and the on-screen note (no UI, so no board pin). Add inside `RecipeDetailScreen` in `app/recipes/[id]/page.tsx`, directly after the existing `useEffect(() => { loadRecipe(); ... }, [recipeId]);` block:

```tsx
  // Keep the screen awake while a recipe is open (milestone 18, fork W1: b).
  // Best-effort: the browser can refuse (low battery, hidden tab), and iOS
  // releases the lock whenever the app is backgrounded, so re-acquire on return.
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      if (!("wakeLock" in navigator)) return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
      } catch {
        // Best-effort only.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") acquire();
    }

    acquire();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sentinel?.release().catch(() => {});
    };
  }, []);
```

With W1 = b, the Phase 2 `wakeLock` grep expects matches only in `app/recipes/[id]/page.tsx`.

## Appendix F: the smoke-test recipe (`$SMOKE/recipe.txt`)

Written for this spec (no copyrighted source). It has a divided ingredient, an amount already in a step, and to-taste items.

```text
Weeknight Lemon Garlic Chicken
Serves 4

Ingredients
1 1/2 pounds boneless chicken thighs
1 teaspoon kosher salt
1/2 teaspoon black pepper
2 tablespoons olive oil, divided
4 cloves garlic, minced
1 lemon
Salt and pepper to taste

Steps
1. Pat the chicken dry and season it with the kosher salt and black pepper.
2. Heat 1 tablespoon of the olive oil in a large skillet over medium heat. Add the chicken and cook until golden, about 6 minutes per side.
3. Add the remaining oil and the garlic to the pan and cook for 1 minute. Squeeze in the lemon, then season to taste.
```
