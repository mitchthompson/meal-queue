# Routes

Sitemap for Meal Queue. Almost every route is an App Router page under `app/`, with data access client-side via the browser supabase-js client and owner-based RLS. The one server-side exception is the route handler `POST /api/import-recipe` (recipe-import parsing, milestone 8), documented in the API routes section below; it parses only and never writes the database.

## Route table

| Path | File | Purpose | Reads / Writes |
| --- | --- | --- | --- |
| `/` | `app/page.tsx` | Today (reflow home): tonight's dinner one tap from Cook mode, grocery-deadline strip, remaining-week peek, next-week nudge. | Reads `meal_plans`, `meal_plan_items`, `grocery_list_items` (count), `recipe_steps` (count). No writes. |
| `/recipes` | `app/recipes/page.tsx` | Recipe library: searchable/sortable list, create/edit editor (ingredients, steps, tags), and the in-app import flow (Import button / `?import=1` → paste or URL → LLM parse → review → save; milestone 8). The old "Load sample data" seeder was removed (PR #21, RC3). | Reads `recipes`, `tags`, `units`, plus `ingredients` / `recipe_steps` / `recipe_tags` on select. Writes `recipes`, `ingredients`, `recipe_steps`, `recipe_tags`, `tags` (upsert); deletes `recipes`. |
| `/recipes/[id]` | `app/recipes/[id]/page.tsx` | Read-only recipe detail: servings scaling, ingredient list, full-screen Cook mode (`?cook=1` auto-launches it), tags, delete. | Reads `recipes`, `ingredients`, `recipe_steps`, `recipe_tags`, `units`. Deletes `recipes`. |
| `/plans` | `app/plans/page.tsx` | Plan (reflow + flat days): day-row cards each holding one flat meal list; per-day cook / leftover / eat-out quick-add opens a full-screen takeover (`components/plan-add-meal.tsx`, 2026-07-08) with serving multipliers; New-plan/Edit-plan sheets; reads `?plan=<id>` / `?new=1` deep links; "Shop this plan" exit to `/grocery?plan=<id>`. | Reads `meal_plans`, `recipes`, `user_settings`, `meal_plan_items`. Writes `meal_plans` (insert/update), `meal_plan_items` (insert/update); deletes `meal_plans`, `meal_plan_items`. |
| `/grocery` | `app/grocery/page.tsx` | Shop (reflow): pinned order/pickup bar with live unchecked count, chunky check-off rows in Groceries / Pantry check sections (On hand collapsed below); a stale plan shows an amber banner + explicit Generate/Update button (milestone 10 — nothing regenerates on load), with the manual Regenerate ghost button as the escape hatch; reads `?plan=<id>` deep links. | Reads `meal_plans`, `grocery_list_items`. Writes `grocery_list_items` via `regenerate_grocery_list` RPC and updates to `is_checked`, `is_pantry_staple`, `is_on_hand`. |
| `/settings` | `app/settings/page.tsx` | Account + planning defaults: signed-in email, sign-out, and a form for default plan length, week start, and default grocery order/pickup weekdays. | Reads `user_settings`. Writes `user_settings` (upsert). Auth: `supabase.auth.signOut()`. |
| `/reset-password` | `app/reset-password/page.tsx` (+ `layout.tsx`) | Recovery-session password reset (milestone 11): loading / expired-link / new-password states, entered from the "Forgot password?" reset email. On the unmerged `codex/password-reset` branch until M11 merges. | Reads the Supabase auth session. Writes via `supabase.auth.updateUser({ password })` — no table reads or writes. |

Schema for the tables above is defined in `supabase/schema.sql` and described in [data model](data-model.md).

## API routes

The app is otherwise 100% client components; `POST /api/import-recipe` is the first and only server-side route handler (`app/api/import-recipe/route.ts`, `runtime = "nodejs"`, `maxDuration = 60`, milestone 8).

| Path | File | Purpose | Reads / Writes |
| --- | --- | --- | --- |
| `POST /api/import-recipe` | `app/api/import-recipe/route.ts` | Parse a recipe from pasted text or an open URL into a review-ready draft, via Claude Haiku 4.5 (`lib/import/*`). Paste-first; a paywalled or blocked URL fails soft to a `paywall_or_blocked` response. | Verifies the caller's Supabase access token (`auth.getUser`) as an auth gate only. **No database reads or writes** — saving stays client-side through the `save_recipe` RPC. Calls the Anthropic API. |

Request body: `{ text?: string, url?: string, tags: string[] }`, with exactly one of `text`/`url`. Success (200): `{ draft, original_text, meta }`. Failure: `{ error: { code, message } }` with a mapped HTTP status (taxonomy in `lib/import/errors.ts`). Full contract: [plans/recipe-import.md](plans/recipe-import.md) §5 (Phase B).

## Page docs

Each user-facing screen has a per-page intent doc under `docs/pages/`:

- Today (`/`) — [today](pages/today.md)
- Recipes (`/recipes`, plus the detail view `/recipes/[id]`) — [recipes](pages/recipes.md)
- Meal Plans (`/plans`) — [plans](pages/plans.md)
- Grocery (`/grocery`) — [grocery](pages/grocery.md)
- Settings (`/settings`) — [settings](pages/settings.md)

## Shared layout and navigation

`app/layout.tsx` (`RootLayout`) is the only layout file and is minimal: it imports `globals.css` and sets metadata (title "Meal Queue") and the viewport theme color. Fonts are the native system stack, declared as `--font-body` / `--font-heading` tokens in `globals.css` (token set v2 — the Fraunces/Manrope Google fonts were retired with the reflow). It renders no nav or auth chrome itself.

Shared chrome lives in two client components that every page composes manually:

- `components/auth-gate.tsx` (`AuthGate`) wraps each page's default export. It gates on a Supabase session, renders a loading screen then a sign-in/sign-up form (with a "Forgot password?" reset-email link, milestone 11) when unauthenticated, and ensures a `user_settings` row exists via upsert.
- `components/app-shell.tsx` (`AppShell`) provides the persistent navigation and content frame inside each authenticated screen. Navigation is a single `navLinks` array of 4 destinations (the reflow cycle) rendered twice — a desktop `.nav-pills` pill bar and a `.mobile-tabbar` icon+label tab bar. Links: `/` (Today), `/plans` (Plan), `/grocery` (Shop), `/recipes` (Recipes). Settings is reached from the gear in the Today header (see [design flags](design-flags.md)). Active state derives from `usePathname()` with exact equality, so `/recipes/[id]` does not highlight the Recipes tab.

Design tokens for this chrome live in `app/globals.css` and are documented in [design system](design-system.md).

## Notes

- This is a single-household app; there are no multi-user, sharing, or public-product routes, and no auth flow beyond email/password plus the M11 password reset, handled in `AuthGate` and `/reset-password`.
- Today loads items only for the date-relevant current plan and its successor, which resolved the old dashboard's empty-current-week bug (items used to load for only the 4 newest plans).
