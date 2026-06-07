# Meal Queue

Meal Queue is a meal planner + recipe keeper + grocery list generator built with Next.js + Supabase.

## Current Features

- Recipe CRUD with ingredients, structured steps, serving scaling, and tags
- Custom date-range meal plans with lunch, dinner, leftovers, and eating-out slots
- Persisted grocery lists with pantry, on-hand, and checked states
- User settings for plan length, week start, ordering, and pickup
- Supabase email/password authentication and row-level security

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

## Project Context

Start with [`docs/README.md`](docs/README.md). It defines the reading order and
the documents that preserve current state, plans, decisions, and history between
working sessions.

The canonical database definition is [`supabase/schema.sql`](supabase/schema.sql).

