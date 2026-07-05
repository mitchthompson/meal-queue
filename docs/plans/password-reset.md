# Milestone 11: Password reset — build spec for handoff

**Audience:** this plan will be executed by a lower-capability builder model. Everything is spelled out. Builder: follow it literally; where it says STOP, stop and ask. Where a value or behavior is not specified here, do NOT invent it — flag it in `docs/design-flags.md` and ask.

---

## 1. Context (why)

Auth is email/password through `components/auth-gate.tsx` (sign-in + sign-up only; the app-wide grep confirms no `resetPasswordForEmail` / `updateUser` / `verifyOtp` anywhere). A forgotten password currently has no recovery except the Supabase dashboard. This is the one real lockout risk in a single-household app.

**Owner decisions (locked, do not revisit):**
| Decision | Choice |
|---|---|
| Scope | Password reset ONLY. No sign-up confirmation work, no OAuth, no magic links. Sign-up stays exactly as-is. |
| Flow | "Forgot password?" on the sign-in form → `supabase.auth.resetPasswordForEmail` → email link → new route `/reset-password` → `supabase.auth.updateUser({ password })`. |
| New route | `app/reset-password/page.tsx`, reusing the existing `auth-panel` styles. No new schema, no new deps. |
| Friendly auth errors | Already handled by milestone 9's `toAuthErrorMessage` — build this milestone AFTER M9 and use that helper. |
| Design gate | Two board pins (AR1 link placement, AR2 reset page) in the next board round. |

---

## 2. Builder ground rules (non-negotiable)

1. **Repo root is `/Users/mitchell/Dev/meal-queue/meal-queue`** — one level BELOW the shell cwd.
2. **Never**: commit, push, merge, install/upgrade dependencies, change `supabase/schema.sql`/`migrations/`, or touch live Supabase data. Supabase **dashboard** changes (redirect URLs) are owner-only — STOP point.
3. **No hardcoded hex/font/spacing** — tokens only.
4. **Conventional Commits**, no `Co-Authored-By`, commits only after owner approval.
5. **Batch-Read before editing:** `components/auth-gate.tsx`, `components/status-message.tsx`, `lib/errors.ts`, `lib/supabase/client.ts`, `app/settings/page.tsx` (form idiom), `app/globals.css` (auth-panel styles), `docs/setup.md`.
6. Baseline before starting AND before done: `npm run typecheck && npm run test && npm run lint`.
7. `rtk` proxies shell commands; rerun as `rtk proxy <cmd>` if truncated.

**STOP points:** ① owner must add the redirect URLs in the Supabase dashboard BEFORE any live testing (§5); ② AR1/AR2 board verdicts before merge; ③ before ANY commit; ④ senior `/code-review` before merge.

Branch: `codex/password-reset`. One PR.

---

## 3. Phase 1 — "Forgot password?" on the sign-in form

`components/auth-gate.tsx` changes only:

1. Add state: `const [message, setMessage] = useState<string | null>(null);` and pass it to the existing `<StatusMessage error={error} />` at line 141 → `<StatusMessage error={error} message={message} />`. Clear `message` wherever `error` is currently cleared.
2. Below the mode-toggle text button (after line ~147), render ONLY when `!isSignUp`:
   ```tsx
   <button className="text-btn" onClick={requestPasswordReset} type="button">
     Forgot password?
   </button>
   ```
3. The handler:
   ```tsx
   async function requestPasswordReset() {
     setError(null);
     setMessage(null);
     const trimmed = email.trim();
     if (!trimmed) {
       setError("Enter your email above first, then tap Forgot password.");
       return;
     }
     setBusy(true);
     const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
       redirectTo: `${window.location.origin}/reset-password`,
     });
     setBusy(false);
     if (resetError) {
       setError(toAuthErrorMessage(resetError));
       return;
     }
     setMessage("Password reset email sent. Check your inbox.");
   }
   ```
   Copy strings exactly as written. `toAuthErrorMessage` comes from milestone 9 (`lib/errors.ts`).

No other auth-gate behavior changes: sign-in, sign-up, the session cache, and `ensureUserSettings` stay byte-identical.

---

## 4. Phase 2 — the reset page

New file `app/reset-password/page.tsx` (client component) + `app/reset-password/layout.tsx` (metadata stub copying the pattern of `app/settings/layout.tsx`, title `Reset password`).

Behavior contract:
- The email link signs the user in with a recovery session (supabase-js v2 handles the URL token exchange automatically on load; the client is already configured in `lib/supabase/client.ts` — do not change it).
- On mount, resolve the session exactly the way `auth-gate.tsx:32-51` does (`getSession()` + `onAuthStateChange` subscription; also treat the `PASSWORD_RECOVERY` event as session-arrival). Three render states:
  1. Resolving: `<h1>Loading session...</h1>` inside the auth panel (same as auth-gate's loading state).
  2. No session after resolution: panel with `<h1>Reset link expired</h1>` and `<p className="muted">This reset link is invalid or has already been used. Request a new one from the sign-in screen.</p>` plus `<a className="primary-btn" href="/">Back to sign in</a>`.
  3. Session present: the form below.
- The form (reuse `hero auth-panel` + `stack` classes from the auth gate; labels/inputs follow the settings-form idiom):
  - `<h1>Choose a new password</h1>`
  - Password input: `type="password"`, `required`, `minLength={6}`, `autoComplete="new-password"`, label `New password`.
  - Confirm input: same attributes, label `Confirm new password`.
  - Submit `<button className="primary-btn" disabled={busy}>` label `busy ? "Working..." : "Save new password"`.
  - `<StatusMessage error={error} message={message} />`.
- Submit handler: if the two fields differ → `setError("Passwords don't match.")` and return. Else `const { error } = await supabase.auth.updateUser({ password });` — on error `setError(toAuthErrorMessage(error))`; on success `setMessage("Password updated. You're signed in.")` and render a `<a className="primary-btn" href="/">Go to Today</a>` action in place of the form.

Copy strings exactly as written (no em-dashes). No new CSS classes should be needed; if one is, add it token-only and document it.

---

## 5. Owner setup (STOP — Mitchell does this, not the builder)

In the Supabase dashboard (project auth settings → URL Configuration):
1. Confirm Site URL: `https://meal-queue.vercel.app`.
2. Add to Redirect URLs: `https://meal-queue.vercel.app/reset-password` AND `http://localhost:3000/reset-password`.
3. The default recovery email template is fine (no template work this milestone).

Without step 2, `resetPasswordForEmail` silently falls back to the Site URL and the flow breaks. Builder: verify with the owner that this is done before live testing.

**Known constraint (accepted, document in `docs/design-flags.md`):** on the iPhone, the email link opens in the default browser, not the installed standalone app — the user resets there and then signs in inside the app. Sessions are per-context; this is how Supabase recovery works.

---

## 6. Verification

Local email testing needs the local stack's mail catcher. The standard stack command excludes `mailpit`; for this milestone's local test run, start it WITHOUT that exclusion:
```bash
supabase start -x vector,logflare,realtime,imgproxy,studio,edge-runtime,supavisor
```
and run the dev server pointed at the local stack (same env-swap pattern the review-board harness uses — see `scripts/review-board/README.md`). Mailpit UI: `http://127.0.0.1:54324`.

1. typecheck / test / lint / `npm run build` (13 routes now — the new `/reset-password`).
2. Local flow end to end: request reset for the reviewer account → open the mail in Mailpit → follow the link → land on `/reset-password` with the form (state 3) → mismatched passwords shows "Passwords don't match." → matching passwords shows "Password updated. You're signed in." → sign out → sign in with the NEW password works, old password shows "Wrong email or password."
3. Expired-link path: open `/reset-password` directly with no token → state 2 renders.
4. Empty-email path on sign-in: tap Forgot password with an empty field → the inline error renders, no request fires (network tab).
5. Existing flows regress-free: normal sign-in, sign-up toggle, sign-out (settings) all behave exactly as before.
6. **Needs Mitchell (prod, after deploy):** one real reset against his own account on the iPhone: email arrives, link opens in Safari, reset works, app sign-in with the new password works. Real Safari behavior (not Playwright WebKit) matters here.

**Acceptance:**
- A forgotten password is recoverable end to end without the Supabase dashboard.
- Reset-request, mismatch, expired-link, and success states all render the exact copy above.
- No behavior change to sign-in/sign-up/sign-out; no schema or dependency changes.

## 7. Do-not-touch list

`supabase/**`, `mcp/**`, `lib/import/**`, `app/api/**`, `lib/supabase/client.ts`, `lib/hooks/**`, sign-up logic in `auth-gate.tsx`.
