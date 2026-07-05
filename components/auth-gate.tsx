"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { StatusMessage } from "@/components/status-message";
import { DEFAULT_USER_SETTINGS } from "@/lib/constants";
import { toAuthErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";

type AuthGateProps = {
  children: (session: Session) => ReactNode;
};

// Last-known session, shared across AuthGate mounts. Every page wraps itself
// in its own AuthGate, so without this each tab navigation re-awaited
// getSession() and flashed the full-screen "Loading session..." state. With
// it, navigations render immediately from the cached session while the
// background refresh + onAuthStateChange keep it honest (sign-out still
// snaps back to the form).
let cachedSession: Session | null = null;

export function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(cachedSession);
  const [loading, setLoading] = useState(cachedSession === null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [initializedUserId, setInitializedUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      cachedSession = data.session ?? null;
      if (!mounted) return;
      setSession(cachedSession);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      cachedSession = nextSession;
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const formTitle = useMemo(() => (isSignUp ? "Create Account" : "Sign In"), [isSignUp]);

  async function ensureUserSettings(userId: string) {
    const { error: settingsError } = await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        ...DEFAULT_USER_SETTINGS,
      },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

    if (settingsError) {
      console.error("Failed to initialize user settings:", settingsError.message);
    }
  }

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const authCall = isSignUp
      ? supabase.auth.signUp({ email, password })
      : supabase.auth.signInWithPassword({ email, password });

    const { error: authError } = await authCall;
    if (authError) {
      setError(toAuthErrorMessage(authError));
    }
    // ensureUserSettings runs once per sign-in via the session effect below
    // (guarded by initializedUserId) — the duplicate call here is gone.
    setBusy(false);
  }

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || initializedUserId === userId) return;

    ensureUserSettings(userId).finally(() => {
      setInitializedUserId(userId);
    });
  }, [session, initializedUserId]);

  if (loading) {
    return (
      <main className="shell">
        <section className="hero">
          <h1>Loading session...</h1>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="shell">
        <section className="hero auth-panel">
          <p className="eyebrow">Meal Queue</p>
          <h1>{formTitle}</h1>
          <p>Sign in with your Meal Queue app account (email/password).</p>

          <form className="stack" onSubmit={submitAuth}>
            <label>
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
            <label>
              Password
              <input
                required
                minLength={6}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
            </label>
            <button className="primary-btn" disabled={busy} type="submit">
              {busy ? "Working..." : formTitle}
            </button>
          </form>

          <StatusMessage error={error} />

          <button className="text-btn" onClick={() => setIsSignUp((current) => !current)} type="button">
            {isSignUp ? "Already have an account? Sign in" : "Need an account? Create one"}
          </button>
        </section>
      </main>
    );
  }

  return <>{children(session)}</>;
}
