# Milestone 9: Resilience (error/loading boundaries + raw-error sweep) — build spec for handoff

**Audience:** this plan will be executed by a lower-capability builder model. Everything is spelled out. Builder: follow it literally; where it says STOP, stop and ask. Where a value or behavior is not specified here, do NOT invent it — flag it in `docs/design-flags.md` and ask.

---

## 1. Context (why)

Two related gaps, both from the 2026-06-11 audits and deferred until now:

1. **No React error boundaries anywhere.** Zero `error.tsx` / `loading.tsx` / `not-found.tsx` / `global-error.tsx` files exist under `app/` (verified 2026-07-05). A render crash white-screens the app.
2. **Raw Supabase/Postgres error strings reach the UI in ~18 places.** `lib/errors.ts` has a friendly mapper (`toErrorMessage`), but most load/mutation paths call `setError(x.message)` directly.

**Owner decisions (locked, do not revisit):**
| Decision | Choice |
|---|---|
| Boundary placement | One root `app/error.tsx` + `app/global-error.tsx` + `app/not-found.tsx` + `app/loading.tsx`. No per-segment boundaries (the four segment layouts are metadata stubs; a segment boundary buys nothing). |
| Boundary chrome | Boundary pages do NOT render `AppShell` (the shell lives inside each page below `AuthGate`; a crash may be in the shell itself). They render a minimal standalone panel. |
| Raw-error sweep | Every direct `setError(x.message)` is routed through `toErrorMessage(x, fallback)` with a per-site fallback string (table in §5). `lib/errors.ts` gains one new export for auth errors. |
| Recipe-detail 404 | A bad `/recipes/[id]` id calls `notFound()` instead of rendering a raw error string. |
| Design gate | One review-board pin (EB1, the error panel) in the next board round. Board round gates the PR merge, not the build. |

Zero schema changes. Zero new npm dependencies.

---

## 2. Builder ground rules (non-negotiable)

1. **Repo root is `/Users/mitchell/Dev/meal-queue/meal-queue`** — one level BELOW the shell cwd. `cd` there explicitly in every command.
2. **Never**: commit, push, merge, install/upgrade any npm dependency, change `supabase/schema.sql` or `supabase/migrations/`, or touch live Supabase data. If you believe you need any of these, STOP and ask.
3. **No hardcoded hex/font/spacing** in components — CSS tokens in `app/globals.css` only.
4. **Conventional Commits**, no `Co-Authored-By`, commits only after owner approval.
5. **Before the sweep in §5, batch-Read every file in its table first.**
6. Read before building: `lib/errors.ts`, `components/status-message.tsx`, `components/auth-gate.tsx`, `app/layout.tsx`, `components/app-shell.tsx`, `docs/design-system.md`, and every file named in §5.
7. Baseline check before starting AND before declaring any phase done: `cd /Users/mitchell/Dev/meal-queue/meal-queue && npm run typecheck && npm run test && npm run lint` (all green; vitest currently 128/128).
8. `rtk` proxies shell commands; if output looks truncated, rerun as `rtk proxy <cmd>`.

**STOP points:** ① before ANY commit; ② board pin EB1 verdict before merge; ③ senior `/code-review` before merge.

Branch: `codex/error-boundaries`. One PR.

---

## 3. Phase 1 — boundary files

All four files are new. Use ONLY existing CSS classes/tokens (`.shell`, `.hero`, `.panel`, `.primary-btn`, `.secondary-btn`, `.muted` — all exist in `app/globals.css`). If a new class is needed, add it to `app/globals.css` using tokens only and document it in `docs/design-system.md`.

### 3a. `app/error.tsx`
```tsx
"use client";

import { useEffect } from "react";

// Route-level error boundary (milestone 9). Renders INSTEAD of the page tree,
// so it must not depend on AppShell/AuthGate (the crash may be inside them).
// A plain <a> (not next/link) makes "Go to Today" a full reload, which also
// resets whatever client state caused the crash.
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error boundary:", error);
  }, [error]);

  return (
    <main className="shell">
      <section className="hero error-boundary-panel">
        <p className="eyebrow">Meal Queue</p>
        <h1>Something went wrong</h1>
        <p className="muted">The app hit an unexpected error. Your data is safe.</p>
        <div className="error-boundary-actions">
          <button className="primary-btn" onClick={reset} type="button">
            Try again
          </button>
          <a className="secondary-btn" href="/">
            Go to Today
          </a>
        </div>
      </section>
    </main>
  );
}
```
Copy strings exactly as written (no em-dashes). New CSS (add to `app/globals.css`, near the auth panel styles; tokens only):
```css
/* Error boundary panel (milestone 9) */
.error-boundary-panel { max-width: 28rem; }
.error-boundary-actions { display: flex; gap: 0.75rem; margin-top: 1rem; }
.error-boundary-actions .secondary-btn { display: inline-flex; align-items: center; justify-content: center; }
```
Check the rendered result at 390px: both controls ≥44px tall (the existing btn classes already size this; verify, don't restyle).

### 3b. `app/global-error.tsx`
Same content as 3a but it must render its own `<html lang="en"><body>` wrapper (it replaces the root layout) and must NOT import `globals.css` styles that failed — inline a minimal style block instead:
```tsx
"use client";

// Catches errors thrown by the root layout itself. Bare-bones by design:
// globals.css may not have loaded, so styles are inlined.
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1.5rem" }}>
        <h1>Something went wrong</h1>
        <p>The app hit an unexpected error. Your data is safe.</p>
        <button onClick={reset} type="button">Try again</button>
      </body>
    </html>
  );
}
```
(The inline `style` here is an approved exception to the token rule — global-error renders when the CSS pipeline itself may be broken. Note this exception in `docs/design-system.md` when documenting the new classes.)

### 3c. `app/not-found.tsx`
Same panel structure as 3a (it CAN be a server component — no `"use client"`, no `reset`):
- `<h1>That page doesn't exist</h1>`
- `<p className="muted">Check the address, or head back to your week.</p>`
- One action: `<a className="primary-btn" href="/">Go to Today</a>` (wrap in `.error-boundary-actions` for spacing).

### 3d. `app/loading.tsx`
```tsx
export default function Loading() {
  return (
    <main className="shell">
      <p className="muted">Loading...</p>
    </main>
  );
}
```
This matches the existing per-page loading language exactly ("Loading..." in `.muted`, see `app/page.tsx:67`). Do not build skeletons — explicitly out of scope (deferred with the rest of the mini-M5 loading polish).

### 3e. Recipe-detail 404
In `app/recipes/[id]/page.tsx`: the load block at lines 96-101 currently folds every failure into `setError(...)`. Change ONLY the no-row case: when `recipeRes.error` has `code === "PGRST116"` (PostgREST "no rows" from `.single()`), call `notFound()` (import from `next/navigation`) instead of `setError`. All other failures keep the error path (which §5 routes through `toErrorMessage`).

---

## 4. Phase 2 — `lib/errors.ts` addition (auth mapper)

Add ONE export; do not modify `toErrorMessage` or `CODE_MESSAGES`:

```ts
// Supabase auth errors arrive with human-ish but jargony messages
// ("Invalid login credentials"). Map the common ones; fall back generically.
// Milestone 9.
const AUTH_MESSAGES: Record<string, string> = {
  "Invalid login credentials": "Wrong email or password.",
  "Email not confirmed": "This email hasn't been confirmed yet. Check your inbox.",
  "User already registered": "An account with this email already exists. Sign in instead.",
};

export function toAuthErrorMessage(caught: unknown): string {
  const message =
    caught && typeof caught === "object" && "message" in caught && typeof caught.message === "string"
      ? caught.message
      : null;
  if (message && AUTH_MESSAGES[message]) return AUTH_MESSAGES[message];
  return "Sign-in failed. Check your email and password, then try again.";
}
```

Vitest (`lib/errors.test.ts` — extend if it exists, create if not): the three mapped strings, an unknown message, a non-object throw. 5 assertions minimum.

---

## 5. Phase 3 — raw-error sweep

Batch-Read ALL files below before editing any of them. Every row replaces `setError(<x>.message)` (or a `||`-chain of raw messages) with `setError(toErrorMessage(<x>, "<fallback>"))`. Import `toErrorMessage` where missing. Do not change any other logic, state, or copy.

| File | Line (pre-edit) | Site | Fallback string |
|---|---|---|---|
| `app/settings/page.tsx` | 43 | settings load | `Failed to load settings.` |
| `app/settings/page.tsx` | 78 | settings save | `Failed to save settings.` |
| `app/recipes/[id]/page.tsx` | 96-101 | detail load (`\|\|`-chain; keep the PGRST116 → `notFound()` branch from §3e first) | `Failed to load recipe.` |
| `app/recipes/[id]/page.tsx` | 144 | recipe delete | `Failed to delete recipe.` |
| `components/auth-gate.tsx` | 80 | sign-in/sign-up | use `toAuthErrorMessage(authError)` (§4), not `toErrorMessage` |
| `lib/hooks/use-plan.ts` | 212 | plans/recipes/settings load (`\|\|`-chain) | `Failed loading plans.` |
| `lib/hooks/use-plan.ts` | 248 | plan items load | `Failed loading the plan's meals.` |
| `lib/hooks/use-recipes.ts` | 173 | recipes load | `Failed to load recipes.` |
| `lib/hooks/use-recipes.ts` | 178 | tags load | `Failed to load tags.` |
| `lib/hooks/use-recipes.ts` | 208 | recipe-for-edit load (`\|\|`-chain) | `Failed to load recipe.` |
| `lib/hooks/use-recipes.ts` | 278 | recipe delete | `Failed to delete recipe.` |
| `lib/hooks/use-grocery-list.ts` | 85 | plans load | `Failed to load plans.` |
| `lib/hooks/use-grocery-list.ts` | 116 | grocery list load | `Failed to load the grocery list.` |
| `lib/hooks/use-grocery-list.ts` | 170 | toggle checked | `Failed to update the item.` |
| `lib/hooks/use-grocery-list.ts` | 182 | bucket check/uncheck | `Failed to update the items.` |
| `lib/hooks/use-grocery-list.ts` | 196 | pantry move | `Failed to move the item.` |
| `lib/hooks/use-grocery-list.ts` | 208 | on-hand update | `Failed to update the item.` |

For a `||`-chain site, pass the first non-null error object: `toErrorMessage(aRes.error ?? bRes.error ?? cRes.error, "<fallback>")`.

NOTE (do not "fix"): `toErrorMessage` deliberately passes through `P0001` messages (human-readable DB `raise_exception` strings) and unknown messages. That is its designed behavior — the sweep's win is the code-mapped classes (23505/23503/23514/42501/PGRST202) plus a guaranteed fallback. Leave `lib/errors.ts` `toErrorMessage` untouched.

NOTE (out of scope): `lib/hooks/use-import.ts` and `app/api/import-recipe/route.ts` already have their own error taxonomy — do not touch. `components/cook-mode.tsx` wake-lock catches are silent by design — do not touch.

---

## 6. Verification (all before the PR)

1. `npm run typecheck && npm run test && npm run lint` — green; vitest count goes UP (new errors tests), never down.
2. `npm run build` — 12 routes plus the new boundary files compile.
3. Grep proof of the sweep — this must return NOTHING:
   ```bash
   cd /Users/mitchell/Dev/meal-queue/meal-queue
   grep -rn "setError(.*\.message)" app components lib/hooks
   ```
4. Boundary smoke (local stack per `docs/setup.md`, dev server): temporarily add `if (typeof window !== "undefined" && window.location.search.includes("boom=1")) { throw new Error("boundary smoke"); }` at the top of the Today screen component body, load `/?boom=1`, confirm the error panel renders with working "Try again" + "Go to Today", then REMOVE the temporary line (grep for `boom=1` to prove removal).
5. `/nonexistent-route` renders the not-found panel; a made-up `/recipes/<random-uuid>` renders it too.
6. Re-run the existing harnesses (the sweep touched `use-recipes.ts`): `node scripts/verify-recipes-pass.mjs` (22/22) and `node scripts/verify-import-pass.mjs` (26/26) against the local stack.
7. Auth mapping: sign in with a wrong password on the local stack → "Wrong email or password." renders.

**Acceptance:**
- A thrown render error shows the branded panel, never a white screen; recovery works both ways.
- No `setError(x.message)` sites remain (grep in step 3).
- Wrong-password shows the friendly string.
- All existing behavior otherwise byte-identical; vitest ≥128 green.

## 7. Do-not-touch list

`supabase/**`, `mcp/**`, `lib/import/**`, `app/api/**`, `components/cook-mode.tsx`, `components/recipe-import.tsx`, `lib/hooks/use-import.ts`, `next.config.mjs`, `package.json`.
