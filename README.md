# Meal Queue

Meal Queue is a meal planner + recipe keeper + grocery list generator built with Next.js + Supabase.

## V1 Scope

- Recipe CRUD with optional lunch/dinner planning
- Custom date-range meal plans (default start/end behavior from user settings)
- Grocery list persistence per meal plan (regenerates when the plan changes)
- User-defined tags with starter suggestions
- Supabase auth gate for all app sections

## Stack

- Next.js 15 (App Router, TypeScript)
- Supabase (Postgres + Auth)

## Local Setup

1. Install deps:
```bash
npm install
```
2. Create env file:
```bash
Copy .env.example to .env.local
```
3. Add your Supabase values in `.env.local`.
4. Apply SQL in `supabase/schema.sql` to your Supabase project.
5. Run dev server:
```bash
npm run dev
```
6. Open `http://localhost:3000` and sign in/sign up.

## Current Routes

- `/` dashboard + navigation
- `/settings` user defaults (plan days, start day, order/pickup weekdays)
- `/recipes` recipe CRUD (ingredients, steps, tags)
- `/plans` meal plan creation and quick-add scheduling
- `/grocery` persisted grocery generation + checklist buckets

## Docs

- Decisions: `docs/DECISIONS.md`
- Implementation plan: `docs/IMPLEMENTATION_PLAN.md`
- Database schema: `supabase/schema.sql`

