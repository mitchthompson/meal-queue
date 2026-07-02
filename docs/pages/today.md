# Today page

> Per-page doc for the reflow's home screen (screen 2, replaces the old
> dashboard). Behavior below is confirmed against source (`app/page.tsx`,
> `lib/hooks/use-today.ts`); nothing here is invented. Design intent:
> [redesign-brief.md](../redesign-brief.md) + the mockup
> ([mockups/reflow-v1.html](../mockups/reflow-v1.html)).

## Purpose

Opens to *what today needs*: tonight's dinner one tap from Cook mode, the
grocery deadline when it's near, the rest of the week at a glance, and a
"plan next week" nudge. Read-only — it performs no writes; all editing happens
on `/plans` and `/grocery`.

## Route(s)

- Path: `/`
- File: `app/page.tsx`
- Kind: page (App Router, client component — `"use client"`)
- `TodayPage` wraps `TodayScreen` in `<AuthGate>`; data comes from
  `useToday()` (`lib/hooks/use-today.ts`).

## Layout (top to bottom, per the mockup)

1. **Header** — "Today" + the date (`formatLongDate`) + a settings gear
   (settings left the tabbar in the reflow; flagged in
   [design-flags](../design-flags.md)).
2. **Tonight hero** (`.tonight-card`, teal) — tonight's dinner: recipe name,
   "Serves N · M steps · planned {range}", and **Start cooking →**
   deep-linking to `/recipes/[id]?cook=1` (auto-opens the Cook takeover).
   Leftover slots show "Leftovers: {name}" + View recipe; eat-out shows the
   note; an empty tonight shows "Nothing planned tonight" + a plan link.
3. **Context strip** (`.today-strip`, links to `/grocery`) — shown while the
   plan's `order_date`/`pickup_date` is today or later: "Grocery order due
   today/tomorrow/{Day}" with the live unchecked count
   (`!is_checked && !is_on_hand && !is_pantry_staple`).
4. **This week peek** (`.today-week`) — one row per remaining plan day
   (today → `end_date`): day abbreviation, each slot's label with meal type,
   an amber **leftover** pill for leftover slots, "Nothing planned" +
   `plan →` pill for empty days.
5. **Next week nudge** (`.today-next`) — "Plan starts {date} / Open plan"
   when a next plan exists, else "Nothing planned yet / Plan it".

## Derived state (confirmed from source — `useToday`)

- `currentPlan` — the plan active today (`start_date <= today <= end_date`),
  else the soonest upcoming plan, else **null**. Unlike the old dashboard
  there is no fallback to a finished plan: past-only data renders the
  plan-less state.
- `nextPlan` — the soonest plan starting after `currentPlan.start_date`.
- Items are loaded **only for those two plans** (fixes the old dashboard's
  4-newest-plans window, which could silently exclude the active week).
- `heroItem` — tonight's dinner item, preferring `cook` > `leftover` >
  `eat_out`; `heroStepCount` — step count for the hero's recipe.
- `uncheckedCount` — head-count query on `grocery_list_items` for the current
  plan.

## States

- **Loading** — "Loading..." muted line under the header.
- **Plan-less (first run / gap weeks)** — teal hero: "Plan your week to get
  started" → `/plans`, plus a recipes pointer card. (Open question resolved
  with this default; owner may refine — see [design-flags](../design-flags.md).)
- **Plan ended (all days past, plan still "current")** — cannot occur:
  a finished plan is never selected as current.
- **Errors** — `StatusMessage` with `toErrorMessage` mapping.

## Known flags

- Settings gear placement (header vs tabbar) — owner to confirm.
- Desktop presentation constrains the column to 640px (`.today-col`); the
  mockup only specifies the phone layout.
