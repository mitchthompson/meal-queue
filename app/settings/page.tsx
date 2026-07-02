"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { WEEKDAYS } from "@/lib/constants";
import { StatusMessage } from "@/components/status-message";
import { supabase } from "@/lib/supabase/client";

type SettingsForm = {
  default_plan_days: number;
  week_starts_on: number;
  default_order_weekday: number | null;
  default_pickup_weekday: number | null;
};

const initialForm: SettingsForm = {
  default_plan_days: 7,
  week_starts_on: 5,
  default_order_weekday: 3,
  default_pickup_weekday: 4,
};

export default function SettingsPage() {
  return (
    <AuthGate>
      {(session) => <SettingsScreen userId={session.user.id} userEmail={session.user.email} />}
    </AuthGate>
  );
}

function SettingsScreen({ userId, userEmail }: { userId: string; userEmail?: string }) {
  const [form, setForm] = useState<SettingsForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      const { data, error: loadError } = await supabase
        .from("user_settings")
        .select("default_plan_days, week_starts_on, default_order_weekday, default_pickup_weekday")
        .eq("user_id", userId)
        .maybeSingle();

      if (loadError) {
        setError(loadError.message);
        setLoading(false);
        return;
      }

      if (data) {
        setForm({
          default_plan_days: data.default_plan_days,
          week_starts_on: data.week_starts_on,
          default_order_weekday: data.default_order_weekday,
          default_pickup_weekday: data.default_pickup_weekday,
        });
      }

      setLoading(false);
    }

    loadSettings();
  }, [userId]);

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const { error: upsertError } = await supabase.from("user_settings").upsert({
      user_id: userId,
      default_plan_days: form.default_plan_days,
      week_starts_on: form.week_starts_on,
      default_order_weekday: form.default_order_weekday,
      default_pickup_weekday: form.default_pickup_weekday,
    });

    if (upsertError) {
      setError(upsertError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setMessage("Settings saved.");
  }

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-col">
      <section className="settings-head">
        <h1>Settings</h1>
      </section>

      <section className="panel">
        <h2 className="settings-card-label">Account</h2>
        <p className="muted">{userEmail ?? "Signed in"}</p>
        <button
          className="secondary-btn settings-signout"
          onClick={() => supabase.auth.signOut()}
          type="button"
        >
          Sign out
        </button>
      </section>

      <section className="panel">
        <h2 className="settings-card-label">Planning defaults</h2>
        {loading ? (
          <p>Loading settings...</p>
        ) : (
          <form className="settings-form" onSubmit={saveSettings}>
            <label className="settings-row">
              Default plan length (days)
              <input
                min={1}
                max={21}
                required
                type="number"
                value={form.default_plan_days}
                onChange={(event) =>
                  setForm((current) => ({ ...current, default_plan_days: Number(event.target.value) }))
                }
              />
            </label>

            <label className="settings-row">
              Default week starts on
              <select
                value={form.week_starts_on}
                onChange={(event) =>
                  setForm((current) => ({ ...current, week_starts_on: Number(event.target.value) }))
                }
              >
                {WEEKDAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-row">
              Default grocery order day
              <select
                value={form.default_order_weekday ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    default_order_weekday: event.target.value === "" ? null : Number(event.target.value),
                  }))
                }
              >
                <option value="">No default</option>
                {WEEKDAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="settings-row">
              Default grocery pickup day
              <select
                value={form.default_pickup_weekday ?? ""}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    default_pickup_weekday: event.target.value === "" ? null : Number(event.target.value),
                  }))
                }
              >
                <option value="">No default</option>
                {WEEKDAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>

            <button className="settings-save" disabled={saving} type="submit">
              {saving ? "Saving..." : "Save settings"}
            </button>
          </form>
        )}
        <StatusMessage error={error} message={message} />
      </section>
      </div>
    </AppShell>
  );
}
