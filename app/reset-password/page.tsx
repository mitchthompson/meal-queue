"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { StatusMessage } from "@/components/status-message";
import { toAuthErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // The recovery link carries a token supabase-js exchanges for a session on
    // load; that arrives either through getSession() or the PASSWORD_RECOVERY
    // auth event (mirrors auth-gate's session resolution).
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      setError(toAuthErrorMessage(updateError));
      return;
    }

    setDone(true);
    setMessage("Password updated. You're signed in.");
  }

  if (loading) {
    return (
      <main className="shell">
        <section className="hero auth-panel">
          <h1>Loading session...</h1>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="shell">
        <section className="hero auth-panel">
          <h1>Reset link expired</h1>
          <p className="muted">
            This reset link is invalid or has already been used. Request a new one from the sign-in
            screen.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- plain anchor by design (matches not-found.tsx); a full reload re-initializes auth cleanly */}
          <a className="primary-btn" href="/">
            Back to sign in
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="hero auth-panel">
        <h1>Choose a new password</h1>
        {done ? (
          /* eslint-disable-next-line @next/next/no-html-link-for-pages -- plain anchor by design (matches not-found.tsx); a full reload picks up the refreshed session cleanly */
          <a className="primary-btn" href="/">
            Go to Today
          </a>
        ) : (
          <form className="stack" onSubmit={submit}>
            <label>
              New password
              <input
                required
                minLength={6}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirm new password
              <input
                required
                minLength={6}
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
            <button className="primary-btn" disabled={busy} type="submit">
              {busy ? "Working..." : "Save new password"}
            </button>
          </form>
        )}
        <StatusMessage error={error} message={message} />
      </section>
    </main>
  );
}
