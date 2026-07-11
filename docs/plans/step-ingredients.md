# Milestone 16 (candidate): Step↔ingredient link — accurate cook-mode chips

**Status: scoped, owner forks NOT yet locked.** This spec was written 2026-07-11
after real-use feedback (One-Pot Chicken and Rice: wrong chips on step 3). The
§2 forks need owner verdicts before this is builder-ready; everything else is
spelled out. Builder: follow it literally; where it says STOP, stop and ask.
This milestone changes the DATABASE — the full DB ritual applies.

---

## 1. Context (why)

Cook mode shows "ingredients used in this step" as chips, but the schema has no
step↔ingredient association — `recipe_steps` and `ingredients` are independent
children of `recipes` (`supabase/schema.sql:49-66`). The chips are guessed by a
name-match heuristic in `components/cook-mode.tsx` (`matchesStep`): a chip shows
when any 3+ letter word of the ingredient name appears in the step text. Real
use (2026-07-11) showed the failure mode: "**medium** shallot or **medium**
onion, minced" chips onto any step cooked over "medium heat", and staples chip
onto every seasoning mention. This has been a flagged heuristic since the
reflow (see `docs/design-flags.md` → "Cook mode: per-step ingredient chips use
a name-match heuristic").

The accurate fix is to capture the mapping at import time — the parsing LLM
sees the whole recipe and knows which ingredients each step uses — persist it,
and have cook mode trust it. The heuristic stays only as a fallback for
recipes that predate the mapping.

Related but separate (already shipped, 2026-07-11 session): zero amounts render
as "to taste" (`formatIngredientAmount` in `lib/grocery.ts`), and the import
prompt now tells the model to keep the source's step boundaries. Fewer,
source-shaped steps also make per-step chips more useful.

**Key constraint discovered while scoping:** `save_recipe`
(`supabase/schema.sql:304+`) deletes and re-inserts ALL ingredients and steps
with fresh UUIDs on every save. Any persisted link must therefore be rebuilt
inside that same transaction — a free-standing FK join table populated outside
`save_recipe` would dangle after the first edit. Also note: the recipe detail
page currently selects ingredients with **no `.order()`** (physical order), so
positional indexes stored against an unordered list would be fragile — any
design using positions must also pin an explicit ingredient order.

---

## 2. Owner forks (decide before build — STOP until locked)

| # | Fork | Options | Recommendation |
|---|---|---|---|
| F1 | Persistence shape | (a) nullable `recipe_steps.ingredient_ids uuid[]` — `null` = unmapped (pre-feature recipe → heuristic fallback), `[]` = mapped as "no ingredients this step" (→ no chips, no fallback); ids are written by `save_recipe` itself in the same transaction, so they can never dangle. (b) a `recipe_step_ingredients` join table — normalized, FK-enforced, but needs an extra "recipe is mapped" marker to distinguish empty-from-unmapped, and more moving parts inside `save_recipe`. | **(a)** — one nullable column, ambiguity solved by `null` vs `[]`, integrity by construction |
| F2 | Editor behavior v1 | (a) the editor form state carries each step's mapping invisibly and reindexes mechanically on ingredient add/remove; step-body edits keep the step's mapping. (b) any manual save clears mappings (recipe falls back to the heuristic). | **(a)** — otherwise fixing a typo silently degrades cook mode |
| F3 | Backfill for existing imported recipes | (a) none — old recipes keep the heuristic until re-imported by hand (owner re-imports One-Pot Chicken after ship). (b) a one-off script that re-runs the parser over `instructions_raw` for imported recipes. | **(a)** — household-scale; re-import is one paste |
| F4 | Chip UI when mapped | (a) unchanged visuals — same muted text line, just the correct ingredients. (b) restyle round. | **(a)** — no board round needed; visuals were signed off in PR #17 |

---

## 3. The migration (next `supabase/migrations/` slot)

NOTE: `plans/unit-merge.md` (M12) also calls itself "the fifth migration".
Whichever ships second takes the sixth slot and renumbers its language.

Assuming F1(a):

1. `alter table public.recipe_steps add column if not exists ingredient_ids uuid[];`
   (nullable, no default — existing rows stay `null` = unmapped).
2. `create or replace` **`save_recipe`** keeping its exact signature, security
   posture, and validation (`security invoker`, `set search_path`, the
   auth.uid()/p_user_id contract). Changes inside:
   - `p_steps` accepts BOTH shapes, branched on `jsonb_typeof(elem)`:
     - `"string"` (legacy: app editor today, `mcp/` server, any stale caller) →
       insert with `ingredient_ids = null`. **Backward compatible — this is
       what makes "migration before dependent client merge" safe.**
     - `"object"` `{ body: text, ingredient_indexes: int[] }` → insert the
       bodies, then resolve each step's `ingredient_indexes` (0-based positions
       in the `p_ingredients` array as sent) to the uuids of the ingredients
       just inserted. Insertion mapping: insert ingredients from
       `jsonb_array_elements(...) with ordinality` and capture `ordinality →
       id` (e.g. `returning` into a CTE/temp structure keyed by ordinality —
       exact plpgsql mechanics builder's choice, pgTAP-proven). Out-of-range or
       negative indexes are discarded silently (the LLM can be sloppy);
       an empty/absent `ingredient_indexes` on an object-shaped step means `[]`
       (mapped as none), NOT null.
   - Ingredient rows skipped by the existing empty-name filter shift positions:
     compute ordinality BEFORE the name filter so indexes keep meaning
     positions in the payload as the client sent it (skipped rows simply
     resolve to nothing).
3. Pin ingredient display order while here (the F1 fragility note): add
   `order by created_at, id` guidance to the client reads (client change, §5) —
   no schema change needed since `save_recipe` inserts preserve payload order
   via ordinality; verify insert order is stable in pgTAP or add an explicit
   `position int` column if it is not (builder: prove it, don't assume — STOP
   and flag if `position` turns out to be required).

Then update `supabase/schema.sql` to match and regenerate the CI baseline copy
per the drift-guard's documented command (never hand-edit the baseline).

RLS: `recipe_steps` policies are recipe-scoped and unaffected by a new column.
Grants carry over with `create or replace`.

---

## 4. Import pipeline (server + client, `lib/import/`)

1. **LLM output schema** (`lib/import/schema.ts` + the tool JSON schema fed to
   the API): `steps` items become
   `{ body: string (1..2000), ingredient_indexes: int[] (0-based, ≤50 items) }`.
2. **Prompt** (`lib/import/prompt.ts` STEPS block): add — every step lists the
   indexes of the ingredients used in that step, 0-based into the ingredients
   array you output; a step that uses none gets `[]`; prep mentions count
   ("season the chicken with the salt" → salt's index).
3. **Normalize** (`lib/import/normalize.ts`): clamp/discard out-of-range
   indexes, dedupe, sort.
4. **`draftToFormState`** (`lib/hooks/draft-to-form.ts`): carry
   `ingredient_indexes` per step into form state.
5. **Live smoke** (B13-style, one paid call, owner-approved): paste the
   One-Pot Chicken source; assert steps arrive with plausible non-empty
   mappings and that the caramelized-lemon step maps to lemons only.

`mcp/` stays untouched (its string-steps calls hit the legacy branch).

---

## 5. App changes

1. **Form state + save path** (`lib/hooks/use-recipes.ts` `saveRecipeForm`,
   recipes editor in `app/recipes/page.tsx`): steps in form state become
   `{ body, ingredient_indexes: int[] | null }`; the RPC payload sends the
   object shape when a step has a mapping (F2(a): reindex on ingredient
   add/remove — add row = no-op, remove row = drop that index and shift higher
   ones down) and the bare string when `null`. A manually created recipe stays
   all-`null` (heuristic fallback), exactly as today.
2. **Recipe detail** (`app/recipes/[id]/page.tsx`): select `ingredient_ids` on
   steps, add the explicit `.order()` on ingredients (§3.3), and pass CookMode
   per-step resolved ingredients when the step is mapped.
3. **Cook mode** (`components/cook-mode.tsx`): a step with `ingredient_ids`
   non-null renders exactly those chips (amounts still scale); `null` falls
   back to `matchesStep` unchanged. Update the heuristic comment to describe
   the fallback role.

---

## 6. Verification

- pgTAP (new assertions in the save_recipe suite; suite total grows, never
  shrinks): string-steps → `ingredient_ids null`; object-steps → resolved
  uuids match the payload positions; out-of-range indexes dropped; `[]`
  persists as empty-not-null; re-save (delete/reinsert) keeps mappings
  consistent with the NEW ingredient ids; legacy caller after migration
  unaffected.
- vitest: normalize clamping; `draftToFormState` mapping carry;
  editor reindex-on-remove logic (pure helper, unit-tested).
- Playwright `verify-cook-pass.mjs` (new, self-seeding like the other
  harnesses): a mapped recipe shows exactly the mapped chips per step and no
  heuristic bleed; an unmapped recipe still shows heuristic chips.
- Gate: lint / typecheck / vitest / build; `supabase test db`; CI green.
- Prod ritual: backup → preflight → owner "apply" → verify → rolled-back
  smoke → **migration before dependent client merge** → owner "merge".

## 7. Do-not-touch

Every existing migration file (forward-only), `mcp/**`,
`regenerate_grocery_list`, grocery identity keys (this milestone must not
change grocery behavior at all).
