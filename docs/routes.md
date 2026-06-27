# Routes

Sitemap for Meal Queue. Every route is an App Router page under `app/`. There are no API routes or route handlers — all data access is client-side via the browser supabase-js client, scoped by owner-based RLS.

## Route table

| Path | File | Purpose | Reads / Writes |
| --- | --- | --- | --- |
| `/` | `app/page.tsx` | Dashboard: current (and optional next) meal-plan week at a glance plus a grocery "need to buy" preview. | Reads `meal_plans`, `meal_plan_items`, `grocery_list_items`. No writes. |
| `/recipes` | `app/recipes/page.tsx` | Recipe library: searchable/sortable list, create/edit editor (ingredients, steps, tags), and a "Load sample data" seeder. | Reads `recipes`, `tags`, `units`, plus `ingredients` / `recipe_steps` / `recipe_tags` on select. Writes `recipes`, `ingredients`, `recipe_steps`, `recipe_tags`, `tags` (upsert); deletes `recipes`. |
| `/recipes/[id]` | `app/recipes/[id]/page.tsx` | Read-only recipe detail: servings scaling, ingredient list, step-by-step focus mode, tags, delete. | Reads `recipes`, `ingredients`, `recipe_steps`, `recipe_tags`, `units`. Deletes `recipes`. |
| `/plans` | `app/plans/page.tsx` | Meal-plan manager: create plans, edit dates/order/pickup, fill a lunch/dinner grid per day via cook / leftover / eat-out quick-add with serving multipliers. | Reads `meal_plans`, `recipes`, `user_settings`, `meal_plan_items`. Writes `meal_plans` (insert/update, version bump), `meal_plan_items` (insert/update); deletes `meal_plans`, `meal_plan_items`. |
| `/grocery` | `app/grocery/page.tsx` | Per-plan grocery list: auto-generates/regenerates aggregated ingredients from cooked items, split into Main / On hand / Pantry buckets with check-off and move actions. | Reads `meal_plans`, `grocery_list_items`, `meal_plan_items`, `ingredients`. Writes `grocery_list_items` (delete+insert on regenerate; update `is_checked`, `is_pantry_staple`, `is_on_hand`). |
| `/settings` | `app/settings/page.tsx` | Account + planning defaults: signed-in email, sign-out, and a form for default plan length, week start, and default grocery order/pickup weekdays. | Reads `user_settings`. Writes `user_settings` (upsert). Auth: `supabase.auth.signOut()`. |

Schema for the tables above is defined in `supabase/schema.sql` and described in [data model](data-model.md).

## Page docs

Each user-facing screen has a per-page intent doc under `docs/pages/`:

- Dashboard (`/`) — [dashboard](pages/dashboard.md)
- Recipes (`/recipes`, plus the detail view `/recipes/[id]`) — [recipes](pages/recipes.md)
- Meal Plans (`/plans`) — [plans](pages/plans.md)
- Grocery (`/grocery`) — [grocery](pages/grocery.md)
- Settings (`/settings`) — [settings](pages/settings.md)

## Shared layout and navigation

`app/layout.tsx` (`RootLayout`) is the only layout file and is minimal: it injects the Fraunces (heading) and Manrope (body) fonts as CSS variables, imports `globals.css`, and sets metadata (title "Meal Queue"). It renders no nav or auth chrome itself.

Shared chrome lives in two client components that every page composes manually:

- `components/auth-gate.tsx` (`AuthGate`) wraps each page's default export. It gates on a Supabase session, renders a loading screen then a sign-in/sign-up form when unauthenticated, and ensures a `user_settings` row exists via upsert.
- `components/app-shell.tsx` (`AppShell`) provides the persistent navigation and content frame inside each authenticated screen. Navigation is a single `navLinks` array of 5 destinations rendered twice — a desktop `.nav-pills` pill bar and a `.mobile-tabbar` icon tab bar. Links: `/` (Home), `/recipes` (Recipes), `/plans` (Meal Plans), `/grocery` (Grocery), `/settings` (Settings). Active state derives from `usePathname()` with exact equality, so `/recipes/[id]` does not highlight the Recipes tab.

Design tokens for this chrome live in `app/globals.css` and are documented in [design system](design-system.md).

## Notes

- This is a single-household app; there are no multi-user, sharing, or public-product routes, and no auth flow beyond the existing email/password handled in `AuthGate`.
- `ensureUserSettings` (in `AuthGate`) currently runs twice per sign-in, and default settings values are duplicated across client files and disagree with the SQL defaults — see [design flags](design-flags.md).
- The dashboard can render an empty current week when 4+ future plans exist (the window only covers the 4 newest plans by `start_date`) — see [design flags](design-flags.md).
