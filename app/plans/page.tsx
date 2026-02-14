"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { supabase } from "@/lib/supabase/client";

type MealPlan = {
  id: string;
  start_date: string;
  end_date: string;
  order_date: string | null;
  pickup_date: string | null;
  version: number;
};

type RecipeOption = {
  id: string;
  name: string;
  base_servings: number;
};

type MealPlanItem = {
  id: string;
  plan_date: string;
  meal_type: "lunch" | "dinner";
  serving_multiplier: number;
  recipe: RecipeOption | null;
};

type PlanForm = {
  start_date: string;
  end_date: string;
  order_date: string;
  pickup_date: string;
};

type SettingsDefaults = {
  default_plan_days: number;
  week_starts_on: number;
  default_order_weekday: number | null;
  default_pickup_weekday: number | null;
};

type SlotTarget = {
  day: string;
  meal_type: "lunch" | "dinner";
};

function toYmd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(ymd: string, days: number) {
  const date = new Date(`${ymd}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toYmd(date);
}

function nextWeekday(weekday: number) {
  const today = new Date();
  const copy = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const delta = (weekday - copy.getDay() + 7) % 7;
  copy.setDate(copy.getDate() + delta);
  return toYmd(copy);
}

function weekdayOnOrBefore(startDate: string, weekday: number) {
  const start = new Date(`${startDate}T00:00:00`);
  let delta = weekday - start.getDay();
  if (delta > 0) delta -= 7;
  start.setDate(start.getDate() + delta);
  return toYmd(start);
}

function dateRange(start: string, end: string) {
  const out: string[] = [];
  let cursor = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  while (cursor <= endDate) {
    out.push(toYmd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function formatDisplayDate(ymd: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${ymd}T00:00:00`),
  );
}

function createDefaultsFromStart(startDate: string, settings: SettingsDefaults): PlanForm {
  return {
    start_date: startDate,
    end_date: addDays(startDate, settings.default_plan_days - 1),
    order_date:
      settings.default_order_weekday === null ? "" : weekdayOnOrBefore(startDate, settings.default_order_weekday),
    pickup_date:
      settings.default_pickup_weekday === null ? "" : weekdayOnOrBefore(startDate, settings.default_pickup_weekday),
  };
}

function findNextAvailableStartDate(weekday: number, plans: MealPlan[]) {
  const usedStartDates = new Set(plans.map((plan) => plan.start_date));
  let candidate = nextWeekday(weekday);
  for (let i = 0; i < 120; i += 1) {
    if (!usedStartDates.has(candidate)) return candidate;
    candidate = addDays(candidate, 7);
  }
  return candidate;
}

function nextDayInRange(day: string, endDate: string) {
  const next = addDays(day, 1);
  return next <= endDate ? next : null;
}

export default function PlansPage() {
  return (
    <AuthGate>
      {(session) => <PlansScreen userId={session.user.id} userEmail={session.user.email} />}
    </AuthGate>
  );
}

function PlansScreen({ userId, userEmail }: { userId: string; userEmail?: string }) {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [items, setItems] = useState<MealPlanItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<PlanForm>({
    start_date: "",
    end_date: "",
    order_date: "",
    pickup_date: "",
  });
  const [selectedForm, setSelectedForm] = useState<PlanForm>({
    start_date: "",
    end_date: "",
    order_date: "",
    pickup_date: "",
  });
  const [settingsDefaults, setSettingsDefaults] = useState<SettingsDefaults>({
    default_plan_days: 7,
    week_starts_on: 5,
    default_order_weekday: 3,
    default_pickup_weekday: 4,
  });
  const [activeSlot, setActiveSlot] = useState<SlotTarget | null>(null);
  const [quickQuery, setQuickQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const quickInputRef = useRef<HTMLInputElement | null>(null);

  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedPlanId) ?? null, [plans, selectedPlanId]);

  const itemMap = useMemo(() => {
    const map = new Map<string, MealPlanItem[]>();
    for (const item of items) {
      const key = `${item.plan_date}:${item.meal_type}`;
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    }
    return map;
  }, [items]);

  const quickMatches = useMemo(() => {
    const query = quickQuery.trim().toLowerCase();
    if (!query) return recipes.slice(0, 8);
    return recipes.filter((recipe) => recipe.name.toLowerCase().includes(query)).slice(0, 8);
  }, [recipes, quickQuery]);

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!selectedPlan) return;
    setSelectedForm({
      start_date: selectedPlan.start_date,
      end_date: selectedPlan.end_date,
      order_date: selectedPlan.order_date ?? "",
      pickup_date: selectedPlan.pickup_date ?? "",
    });
    loadPlanItems(selectedPlan.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlanId]);

  useEffect(() => {
    if (activeSlot) quickInputRef.current?.focus();
  }, [activeSlot]);

  async function loadInitialData() {
    setLoading(true);
    setError(null);

    const [plansRes, recipesRes, settingsRes] = await Promise.all([
      supabase
        .from("meal_plans")
        .select("id, start_date, end_date, order_date, pickup_date, version")
        .order("start_date", { ascending: false }),
      supabase.from("recipes").select("id, name, base_servings").order("name", { ascending: true }),
      supabase
        .from("user_settings")
        .select("default_plan_days, week_starts_on, default_order_weekday, default_pickup_weekday")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (plansRes.error || recipesRes.error || settingsRes.error) {
      setError(plansRes.error?.message || recipesRes.error?.message || settingsRes.error?.message || "Failed loading plans.");
      setLoading(false);
      return;
    }

    const loadedPlans = (plansRes.data ?? []) as MealPlan[];
    setPlans(loadedPlans);
    if (loadedPlans.length > 0) setSelectedPlanId(loadedPlans[0].id);

    const settings = settingsRes.data ?? {
      default_plan_days: 7,
      week_starts_on: 5,
      default_order_weekday: 3,
      default_pickup_weekday: 4,
    };
    setSettingsDefaults(settings);
    const defaultStart = findNextAvailableStartDate(settings.week_starts_on, loadedPlans);
    setCreateForm(createDefaultsFromStart(defaultStart, settings));

    const recipeRows = (recipesRes.data ?? []) as RecipeOption[];
    setRecipes(recipeRows);

    setLoading(false);
  }

  async function loadPlanItems(planId: string) {
    const { data, error: planItemsError } = await supabase
      .from("meal_plan_items")
      .select("id, plan_date, meal_type, serving_multiplier, recipe:recipes(id, name, base_servings)")
      .eq("meal_plan_id", planId)
      .order("plan_date", { ascending: true });

    if (planItemsError) {
      setError(planItemsError.message);
      return;
    }

    setItems(
      ((data ?? []) as Array<{
        id: string;
        plan_date: string;
        meal_type: "lunch" | "dinner";
        serving_multiplier: number;
        recipe: RecipeOption[] | RecipeOption | null;
      }>).map((row) => ({
        id: row.id,
        plan_date: row.plan_date,
        meal_type: row.meal_type,
        serving_multiplier: row.serving_multiplier,
        recipe: Array.isArray(row.recipe) ? row.recipe[0] ?? null : row.recipe,
      })),
    );
  }

  async function refreshPlansAndKeepSelection(currentId?: string) {
    const { data, error: refreshError } = await supabase
      .from("meal_plans")
      .select("id, start_date, end_date, order_date, pickup_date, version")
      .order("start_date", { ascending: false });
    if (refreshError) throw refreshError;

    const nextPlans = (data ?? []) as MealPlan[];
    setPlans(nextPlans);
    const fallbackId = nextPlans[0]?.id ?? null;
    setSelectedPlanId(currentId && nextPlans.some((p) => p.id === currentId) ? currentId : fallbackId);
    return nextPlans;
  }

  async function createPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const { data, error: createError } = await supabase
        .from("meal_plans")
        .insert({
          user_id: userId,
          start_date: createForm.start_date,
          end_date: createForm.end_date,
          order_date: createForm.order_date || null,
          pickup_date: createForm.pickup_date || null,
        })
        .select("id")
        .single();
      if (createError) throw createError;

      const nextPlans = await refreshPlansAndKeepSelection(data.id);
      const nextStart = findNextAvailableStartDate(settingsDefaults.week_starts_on, nextPlans);
      setCreateForm(createDefaultsFromStart(nextStart, settingsDefaults));
      setMessage("Meal plan created.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed creating plan.");
    } finally {
      setSaving(false);
    }
  }

  async function savePlanMeta() {
    if (!selectedPlan) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const { error: updateError } = await supabase
        .from("meal_plans")
        .update({
          start_date: selectedForm.start_date,
          end_date: selectedForm.end_date,
          order_date: selectedForm.order_date || null,
          pickup_date: selectedForm.pickup_date || null,
        })
        .eq("id", selectedPlan.id);
      if (updateError) throw updateError;

      await refreshPlansAndKeepSelection(selectedPlan.id);
      setMessage("Plan dates saved.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed saving plan.");
    } finally {
      setSaving(false);
    }
  }

  async function bumpPlanVersion(planId: string) {
    const { data, error: versionReadError } = await supabase.from("meal_plans").select("version").eq("id", planId).single();
    if (versionReadError) throw versionReadError;

    const { error: bumpError } = await supabase
      .from("meal_plans")
      .update({ version: Number(data.version) + 1 })
      .eq("id", planId);
    if (bumpError) throw bumpError;
  }

  async function upsertPlanSlot(
    day: string,
    mealType: "lunch" | "dinner",
    recipeId: string,
    servingMultiplier: number,
    moveToNextDay = false,
  ) {
    if (!selectedPlan) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const { error: insertError } = await supabase.from("meal_plan_items").insert({
        meal_plan_id: selectedPlan.id,
        plan_date: day,
        meal_type: mealType,
        recipe_id: recipeId,
        serving_multiplier: servingMultiplier,
      });
      if (insertError) throw insertError;

      await bumpPlanVersion(selectedPlan.id);
      await loadPlanItems(selectedPlan.id);
      await refreshPlansAndKeepSelection(selectedPlan.id);
      setMessage("Recipe added to plan.");
      if (moveToNextDay) {
        const nextDay = nextDayInRange(day, selectedForm.end_date);
        if (nextDay) {
          setActiveSlot({ day: nextDay, meal_type: mealType });
          setQuickQuery("");
        } else {
          setActiveSlot(null);
        }
      } else {
        setActiveSlot(null);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed adding meal.");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(itemId: string) {
    if (!selectedPlan) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { error: deleteError } = await supabase.from("meal_plan_items").delete().eq("id", itemId);
      if (deleteError) throw deleteError;

      await bumpPlanVersion(selectedPlan.id);
      await loadPlanItems(selectedPlan.id);
      await refreshPlansAndKeepSelection(selectedPlan.id);
      setMessage("Meal removed.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed removing meal.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedPlan() {
    if (!selectedPlan) return;
    if (!window.confirm("Delete this meal plan and all its planned items?")) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const { error: deleteError } = await supabase.from("meal_plans").delete().eq("id", selectedPlan.id);
      if (deleteError) throw deleteError;

      const nextPlans = await refreshPlansAndKeepSelection();
      const nextStart = findNextAvailableStartDate(settingsDefaults.week_starts_on, nextPlans);
      setCreateForm(createDefaultsFromStart(nextStart, settingsDefaults));
      setItems([]);
      setMessage("Meal plan deleted.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed deleting plan.");
    } finally {
      setSaving(false);
    }
  }

  async function clearSlot(day: string, mealType: "lunch" | "dinner") {
    if (!selectedPlan) return;
    const currentItems = itemMap.get(`${day}:${mealType}`) ?? [];
    if (currentItems.length === 0) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const ids = currentItems.map((item) => item.id);
      const { error: deleteError } = await supabase.from("meal_plan_items").delete().in("id", ids);
      if (deleteError) throw deleteError;
      await bumpPlanVersion(selectedPlan.id);
      await loadPlanItems(selectedPlan.id);
      await refreshPlansAndKeepSelection(selectedPlan.id);
      setMessage("Meal slot cleared.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed clearing slot.");
    } finally {
      setSaving(false);
    }
  }

  async function adjustServing(item: MealPlanItem, delta: number) {
    if (!selectedPlan) return;
    const nextValue = Math.max(0.25, Number((item.serving_multiplier + delta).toFixed(2)));
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const { error: updateError } = await supabase
        .from("meal_plan_items")
        .update({ serving_multiplier: nextValue })
        .eq("id", item.id);
      if (updateError) throw updateError;

      await bumpPlanVersion(selectedPlan.id);
      await loadPlanItems(selectedPlan.id);
      await refreshPlansAndKeepSelection(selectedPlan.id);
      setMessage("Serving updated.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed updating serving.");
    } finally {
      setSaving(false);
    }
  }

  function openQuickAdd(day: string, mealType: "lunch" | "dinner") {
    setActiveSlot({ day, meal_type: mealType });
    setQuickQuery("");
  }

  async function handleQuickAddKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!activeSlot) return;
    if (event.key === "Escape") {
      setActiveSlot(null);
      return;
    }
    if ((event.key === "Backspace" || event.key === "Delete") && quickQuery.trim() === "") {
      event.preventDefault();
      await clearSlot(activeSlot.day, activeSlot.meal_type);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const top = quickMatches[0];
      if (!top) return;
      await upsertPlanSlot(activeSlot.day, activeSlot.meal_type, top.id, 1, event.shiftKey);
    }
  }

  return (
    <AppShell userEmail={userEmail}>
      <section className="hero">
        <p className="eyebrow">Meal Queue</p>
        <h1>Meal Plans</h1>
        <p>Create custom date-range plans and assign optional lunch/dinner recipes by day.</p>
      </section>

      <section className="split-layout">
        <aside className="panel">
          <h2>Create plan</h2>
          <form className="stack" onSubmit={createPlan}>
            <label>
              Start date
              <input
                required
                type="date"
                value={createForm.start_date}
                onChange={(event) => {
                  const startDate = event.target.value;
                  setCreateForm(createDefaultsFromStart(startDate, settingsDefaults));
                }}
              />
            </label>
            <label>
              End date
              <input
                required
                type="date"
                value={createForm.end_date}
                onChange={(event) => setCreateForm((current) => ({ ...current, end_date: event.target.value }))}
              />
            </label>
            <label>
              Order date
              <input
                type="date"
                value={createForm.order_date}
                onChange={(event) => setCreateForm((current) => ({ ...current, order_date: event.target.value }))}
              />
            </label>
            <label>
              Pickup date
              <input
                type="date"
                value={createForm.pickup_date}
                onChange={(event) => setCreateForm((current) => ({ ...current, pickup_date: event.target.value }))}
              />
            </label>
            <button className="primary-btn" disabled={saving} type="submit">
              {saving ? "Saving..." : "Create meal plan"}
            </button>
          </form>

          <h3>Plans</h3>
          {loading ? <p>Loading...</p> : null}
          <div className="list">
            {plans.map((plan) => (
              <button
                className={selectedPlanId === plan.id ? "list-item active" : "list-item"}
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                type="button"
              >
                <strong>
                  {formatDisplayDate(plan.start_date)} to {formatDisplayDate(plan.end_date)}
                </strong>
                <span>v{plan.version}</span>
              </button>
            ))}
            {!loading && plans.length === 0 ? <p>No plans yet.</p> : null}
          </div>
        </aside>

        <section className="panel">
          {!selectedPlan ? (
            <p>Select or create a plan.</p>
          ) : (
            <div className="stack">
              <div className="section-head">
                <h2>
                  Plan: {formatDisplayDate(selectedPlan.start_date)} to {formatDisplayDate(selectedPlan.end_date)}
                </h2>
                <div className="section-actions">
                  <button className="secondary-btn" disabled={saving} onClick={savePlanMeta} type="button">
                    Save dates
                  </button>
                  <button className="danger-btn" disabled={saving} onClick={deleteSelectedPlan} type="button">
                    Delete plan
                  </button>
                </div>
              </div>

              <div className="plan-meta-grid">
                <label>
                  Start
                  <input
                    type="date"
                    value={selectedForm.start_date}
                    onChange={(event) => setSelectedForm((current) => ({ ...current, start_date: event.target.value }))}
                  />
                </label>
                <label>
                  End
                  <input
                    type="date"
                    value={selectedForm.end_date}
                    onChange={(event) => setSelectedForm((current) => ({ ...current, end_date: event.target.value }))}
                  />
                </label>
                <label>
                  Order
                  <input
                    type="date"
                    value={selectedForm.order_date}
                    onChange={(event) => setSelectedForm((current) => ({ ...current, order_date: event.target.value }))}
                  />
                </label>
                <label>
                  Pickup
                  <input
                    type="date"
                    value={selectedForm.pickup_date}
                    onChange={(event) => setSelectedForm((current) => ({ ...current, pickup_date: event.target.value }))}
                  />
                </label>
              </div>

              <p className="muted">
                Quick add: click any lunch/dinner slot, type recipe, `Enter` to assign top match, `Shift+Enter` to
                assign and move to next day, `Backspace/Delete` on empty query to clear.
              </p>

              <div className="plan-grid">
                <div className="plan-grid-head">Date</div>
                <div className="plan-grid-head">Lunch</div>
                <div className="plan-grid-head">Dinner</div>
                {dateRange(selectedForm.start_date, selectedForm.end_date).map((day) => {
                  const lunchItems = itemMap.get(`${day}:lunch`) ?? [];
                  const dinnerItems = itemMap.get(`${day}:dinner`) ?? [];
                  return (
                    <div className="plan-grid-row" key={day}>
                      <div className="plan-day-cell">
                        <strong>{formatDisplayDate(day)}</strong>
                      </div>
                      <div className="plan-slot-cell">
                        {activeSlot?.day === day && activeSlot.meal_type === "lunch" ? (
                          <div className="quick-add-card">
                            <input
                              ref={quickInputRef}
                              placeholder="Search recipe..."
                              value={quickQuery}
                              onChange={(event) => setQuickQuery(event.target.value)}
                              onKeyDown={handleQuickAddKeyDown}
                            />
                            <div className="quick-add-list">
                              {quickMatches.map((recipe) => (
                                <button
                                  className="text-btn"
                                  key={recipe.id}
                                  onClick={() => upsertPlanSlot(day, "lunch", recipe.id, 1)}
                                  type="button"
                                >
                                  {recipe.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {lunchItems.length > 0 ? (
                          <>
                            {lunchItems.map((lunch) => (
                              <div className="slot-card" key={lunch.id}>
                                {lunch.recipe?.id ? (
                                  <Link className="recipe-link" href={`/recipes/${lunch.recipe.id}`}>
                                    {lunch.recipe?.name ?? "Recipe"}
                                  </Link>
                                ) : (
                                  <strong>{lunch.recipe?.name ?? "Recipe"}</strong>
                                )}
                                <div className="serving-controls">
                                  <button className="text-btn" onClick={() => adjustServing(lunch, -0.25)} type="button">
                                    -
                                  </button>
                                  <span>x {lunch.serving_multiplier}</span>
                                  <button className="text-btn" onClick={() => adjustServing(lunch, 0.25)} type="button">
                                    +
                                  </button>
                                </div>
                                <button className="text-btn" onClick={() => removeItem(lunch.id)} type="button">
                                  Remove
                                </button>
                              </div>
                            ))}
                            <button className="secondary-btn" onClick={() => openQuickAdd(day, "lunch")} type="button">
                              Add another lunch recipe
                            </button>
                          </>
                        ) : (
                          <button className="secondary-btn" onClick={() => openQuickAdd(day, "lunch")} type="button">
                            Add lunch
                          </button>
                        )}
                      </div>
                      <div className="plan-slot-cell">
                        {activeSlot?.day === day && activeSlot.meal_type === "dinner" ? (
                          <div className="quick-add-card">
                            <input
                              ref={quickInputRef}
                              placeholder="Search recipe..."
                              value={quickQuery}
                              onChange={(event) => setQuickQuery(event.target.value)}
                              onKeyDown={handleQuickAddKeyDown}
                            />
                            <div className="quick-add-list">
                              {quickMatches.map((recipe) => (
                                <button
                                  className="text-btn"
                                  key={recipe.id}
                                  onClick={() => upsertPlanSlot(day, "dinner", recipe.id, 1)}
                                  type="button"
                                >
                                  {recipe.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {dinnerItems.length > 0 ? (
                          <>
                            {dinnerItems.map((dinner) => (
                              <div className="slot-card" key={dinner.id}>
                                {dinner.recipe?.id ? (
                                  <Link className="recipe-link" href={`/recipes/${dinner.recipe.id}`}>
                                    {dinner.recipe?.name ?? "Recipe"}
                                  </Link>
                                ) : (
                                  <strong>{dinner.recipe?.name ?? "Recipe"}</strong>
                                )}
                                <div className="serving-controls">
                                  <button className="text-btn" onClick={() => adjustServing(dinner, -0.25)} type="button">
                                    -
                                  </button>
                                  <span>x {dinner.serving_multiplier}</span>
                                  <button className="text-btn" onClick={() => adjustServing(dinner, 0.25)} type="button">
                                    +
                                  </button>
                                </div>
                                <button className="text-btn" onClick={() => removeItem(dinner.id)} type="button">
                                  Remove
                                </button>
                              </div>
                            ))}
                            <button className="secondary-btn" onClick={() => openQuickAdd(day, "dinner")} type="button">
                              Add another dinner recipe
                            </button>
                          </>
                        ) : (
                          <button className="secondary-btn" onClick={() => openQuickAdd(day, "dinner")} type="button">
                            Add dinner
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {error ? <p className="error-text">{error}</p> : null}
          {message ? <p className="success-text">{message}</p> : null}
        </section>
      </section>
    </AppShell>
  );
}
