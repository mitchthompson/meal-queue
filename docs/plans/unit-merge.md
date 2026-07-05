# Milestone 12: Grocery unit merge (dimension-aware grouping) — build spec for handoff

**Audience:** this plan will be executed by a lower-capability builder model. Everything is spelled out. Builder: follow it literally; where it says STOP, stop and ask. This milestone changes the DATABASE — the full DB ritual applies. Where a value or behavior is not specified here, do NOT invent it — flag it in `docs/design-flags.md` and ask.

---

## 1. Context (why)

Grocery grouping identity is `lower(name)|unit_code|pantryflag`, so `1 cup chicken stock` and `240 ml chicken stock` are two list lines. The aggregation truth lives in the DB function `regenerate_grocery_list` (`supabase/schema.sql:621-694`) — the client-side `buildGroceryRows` in `lib/grocery.ts` is a vestige no app code calls (only `formatAmount` is imported; verified 2026-07-05).

**Owner decisions (locked, do not revisit):**
| Decision | Choice |
|---|---|
| Merge rule | Within dimension, using the `units.unit_type` column that already exists (`volume`, `weight`, `count` — `supabase/schema.sql:8,12-27`). Volume merges with volume, weight with weight. `count` units (`item`, `clove`, `slice`) NEVER merge across codes. |
| Display unit | The largest unit (by base factor) among the units actually contributing to that bucket in this regeneration. `1 cup + 8 tbsp` → `1.5 cup`. Same-unit buckets keep their unit (largest of one). |
| Where | In `regenerate_grocery_list` only. `lib/grocery.ts` stays untouched (documented vestige). No client code changes at all. |
| Conversion data | A new `units.base_factor` column (exact factors, §3). Data-driven, no factors hardcoded in the function body. |
| State preservation | Existing checked/on-hand state survives the identity change. When two old rows collapse into one new bucket, merged state is `bool_and` (checked only if every part was checked; on-hand only if every part was on hand) — the conservative "still need to buy some of it" reading. |

This is the app's fifth migration. Ritual (from `docs/architecture.md` + `docs/decisions.md`): prove locally → green CI (pgTAP) → owner says "apply" → backup → preflight → hand-apply → verify → rolled-back live smoke → merge. **Migration before dependent client merge** (no dependent client change exists here, but the order stands).

---

## 2. Builder ground rules (non-negotiable)

1. **Repo root is `/Users/mitchell/Dev/meal-queue/meal-queue`** — one level BELOW the shell cwd.
2. **Never**: commit, push, merge, install/upgrade dependencies, or touch live Supabase data without the owner's explicit word. Prod applies are OWNER-GATED — the builder prepares, the owner says "apply".
3. **Schema truth is `supabase/schema.sql`**; the timestamped baseline copy is CI/local-only and MUST be regenerated in the same PR (the CI drift guard diffs them — see `.github/workflows/`, the "Baseline schema matches schema.sql" step).
4. **Batch-Read before editing:** `supabase/schema.sql` (whole file), every file in `supabase/migrations/`, every pgTAP suite in `supabase/tests/`, `docs/data-model.md`, `docs/architecture.md` (deploy & ops), `lib/grocery.ts`, `app/grocery/page.tsx` (how unit codes render today).
5. Local DB stack (Colima): `supabase start -x vector,logflare,realtime,imgproxy,studio,edge-runtime,mailpit,supavisor`; tests `supabase test db`; fresh build `supabase db reset`.
6. Baseline before starting AND before done: `npm run typecheck && npm run test && npm run lint` plus `supabase test db` (currently 108 pgTAP assertions — this milestone ADDS, never reduces).
7. `rtk` proxies shell commands; rerun as `rtk proxy <cmd>` if truncated.

**STOP points:** ① after local pgTAP is green, before opening the PR (owner reviews the migration SQL); ② owner "apply" before ANY prod DB action; ③ before ANY commit; ④ senior `/code-review` before merge.

Branch: `codex/grocery-unit-merge`. One PR: migration + schema.sql + baseline + pgTAP + docs.

---

## 3. The migration (`supabase/migrations/<timestamp>_grocery_unit_merge.sql`)

Forward-only, idempotent where cheap. Three parts:

### 3a. `units.base_factor`

```sql
alter table public.units add column if not exists base_factor numeric(12,6);

update public.units set base_factor = v.factor
from (values
  ('tsp',    4.928922),
  ('tbsp',  14.786765),
  ('cup',  236.588236),
  ('fl_oz', 29.573530),
  ('ml',     1.0),
  ('l',   1000.0),
  ('oz',    28.349523),
  ('lb',   453.592370),
  ('g',      1.0),
  ('kg',  1000.0),
  ('item',   1.0),
  ('clove',  1.0),
  ('slice',  1.0)
) as v(code, factor)
where units.code = v.code;

alter table public.units alter column base_factor set not null;
```
Base units: `ml` for volume, `g` for weight, self for count. Factors are the exact US-customary definitions to 6 decimals — do not round them further.

### 3b. Replace `regenerate_grocery_list`

`create or replace` the function keeping its exact signature, security posture, and lock behavior (`security invoker`, `set search_path = public, pg_temp`, `for no key update` row lock, the not-found raise — all from `supabase/schema.sql:621-640`). Changes inside:

1. **Bucket key.** The per-ingredient key segment becomes:
   ```
   key_unit := case u.unit_type
                 when 'volume' then 'vol'
                 when 'weight' then 'wt'
                 else i.unit_code
               end;
   source_key := lower(trim(i.name)) || '|' || key_unit || '|' || (case when i.is_pantry_staple then '1' else '0' end);
   ```
   (`u` = `units` joined on `i.unit_code`.) `count`-type units keep their code in the key, so `item`/`clove`/`slice` buckets never cross codes.
2. **Aggregation.** Per bucket: `sum(i.amount * m.serving_multiplier * u.base_factor)` as the base amount; the display unit is the contributing unit with the greatest `base_factor` (ties: impossible within a dimension — every factor is distinct; for count buckets there is exactly one code). Final `amount = round(base_sum / display_factor, 3)`; `unit_code = display_unit`.
3. **Legacy-key normalization** (extends the existing v-prefix normalization block, `schema.sql:645-648`). Before the upsert, convert surviving rows of this plan from old identity (`name|unit_code|flag`) to new identity, preserving state:
   ```sql
   -- collapse old rows that now share a bucket, keeping bool_and state
   -- (checked only if every merged part was checked; same for on-hand)
   ```
   Implement as: compute each existing row's NEW key (join `units` on its `unit_code`); for key-groups with more than one row, keep the row with the smallest `id`, set its `is_checked = bool_and(...)`, `is_on_hand = bool_and(...)` over the group, delete the others; then update every survivor's `source_key` to the new key. Only then run the upsert/delete phases. This block is a no-op on already-normalized rows (their computed key equals their stored key), so repeated regenerations stay clean.
4. Everything else — the upsert's `on conflict (meal_plan_id, source_key) do update` preserving `is_checked/is_on_hand/is_pantry_staple`, the delete-obsolete phase, the `groceries_version = version` stamp, the return count — keeps its current shape (`schema.sql:656-694`).

### 3c. Grants — none needed (same function signature; existing grant at `schema.sql:698-699` carries over with `create or replace`).

Then update `supabase/schema.sql` to match (the column in the `units` CREATE + seed, the new function body) and regenerate the CI baseline copy per the documented command (see the drift-guard step in the CI workflow for the exact regeneration command — do not hand-edit the baseline).

---

## 4. pgTAP (new suite, `supabase/tests/` alongside the existing three)

Follow the structure of the existing grocery suite (seeded users, RLS paths). Cases, each with exact expected numbers:

| # | Case | Expectation |
|---|---|---|
| 1 | `1 cup` + `8 tbsp` stock (two recipes, one plan) | one row, `unit_code='cup'`, `amount=1.500` |
| 2 | `1 lb` + `4 oz` beef | one row, `unit_code='lb'`, `amount=1.250` |
| 3 | `1 cup` + `240 ml` stock | one row, `unit_code='cup'`, `amount=2.014` |
| 4 | `2 item` garlic + `3 clove` garlic | TWO rows (count codes never merge) |
| 5 | `2 tsp` + `1 tsp` salt (same unit) | one row, `unit_code='tsp'`, `amount=3.000` |
| 6 | volume salt (pantry) vs volume salt (non-pantry) | two rows (pantry flag still separates) |
| 7 | check a merged row, add another volume ingredient of the same name elsewhere in the plan, regenerate | row still checked (identity stable under new key) |
| 8 | seed two OLD-key rows (`stock\|cup\|0` checked, `stock\|ml\|0` unchecked) then regenerate | one surviving row, new key `stock\|vol\|0`, `is_checked=false` (bool_and) |
| 9 | same as 8 but both checked | survivor `is_checked=true` |
| 10 | serving multiplier scales before conversion (`1 cup` at multiplier 1.5 + `4 tbsp` at 1) | `amount=1.750`, `unit_code='cup'` |
| 11 | regeneration is idempotent (run twice, same rows/keys/state) | row-for-row equal |

Target ≥22 new assertions (suite total ≥130). Numeric comparisons at 3 decimals.

Also extend the smallest existing suite touchpoint if any pgTAP assertion hardcodes an old-style `source_key` — update those assertions to the new key format (list every one you change in the PR description).

---

## 5. Verification and the prod ritual

1. Local: `supabase db reset` (fresh build proves schema.sql + baseline), `supabase test db` all green.
2. `npm run typecheck && npm run test && npm run lint` — the app is untouched but the gate still runs; `lib/grocery.test.ts` still passes (it tests the client vestige, which did not change — leave it; do NOT try to make it match the SQL).
3. CI green on the PR (app checks + db-tests incl. the baseline drift guard).
4. **STOP — owner reviews migration SQL, then says "apply".** Then, exactly in this order (runbook: `docs/architecture.md`):
   a. Backup: `pg_dump` snapshot per the documented backup runbook (libpq 18.4 path).
   b. Preflight (read-only, prod): count rows per plan whose old keys would collapse (`select meal_plan_id, count(*) ...` grouped by computed new key having count>1) — report the number to the owner before applying.
   c. Apply the migration by hand (SQL editor / psql per runbook).
   d. Verify: `units.base_factor` populated 13/13, function body updated (`\df+`), then a **rolled-back live smoke**: in a transaction, regenerate the owner's current plan, select the merged rows, ROLLBACK. Report before/after line counts and one merged example to the owner.
5. Owner says "merge" → merge the PR (CI re-proves against the fresh stack).
6. Post-merge: owner regenerates via the Shop banner (milestone 10) on real data; confirm the list reads correctly in the app.

**Acceptance:**
- Same-dimension duplicates merge to one line in the largest contributing unit, at 3-decimal precision (pgTAP cases 1-3, 10).
- Count units and pantry classification still separate buckets (cases 4, 6).
- No user state is lost across the identity change (cases 7-9), on real prod data (rolled-back smoke).
- pgTAP total ≥130 green in CI; baseline drift guard green.

## 6. Do-not-touch list

`lib/grocery.ts` (vestige — leave byte-identical), `lib/grocery.test.ts`, all app/client code, `mcp/**`, `lib/import/**`, every existing migration file (forward-only — new file only).
