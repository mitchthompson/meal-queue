"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { supabase } from "@/lib/supabase/client";

type MealPlan = {
  id: string;
  start_date: string;
  end_date: string;
  order_date: string | null;
  pickup_date: string | null;
};

type PlanItem = {
  id?: string;
  meal_plan_id: string;
  plan_date: string;
  meal_type: "lunch" | "dinner";
  recipe: { id?: string; name?: string }[] | { id?: string; name?: string } | null;
};

type GroceryPreviewItem = {
  id: string;
  ingredient_name: string;
  amount: number;
  unit_code: string;
  is_checked: boolean;
  is_on_hand: boolean;
};

type RecipeOption = {
  id: string;
  name: string;
};

function ymdToday() {
  return new Date().toISOString().slice(0, 10);
}

function toYmd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(ymd: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${ymd}T00:00:00`));
}

function formatDayName(ymd: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date(`${ymd}T00:00:00`));
}

function formatLongDate(ymd: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${ymd}T00:00:00`));
}

function planDays(plan: MealPlan) {
  const out: string[] = [];
  let cursor = new Date(`${plan.start_date}T00:00:00`);
  const end = new Date(`${plan.end_date}T00:00:00`);
  while (cursor <= end) {
    out.push(toYmd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export default function HomePage() {
  return (
    <AuthGate>
      {(session) => <HomeDashboard userEmail={session.user.email} />}
    </AuthGate>
  );
}

function HomeDashboard({ userEmail }: { userEmail?: string }) {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [groceryByPlanId, setGroceryByPlanId] = useState<Record<string, GroceryPreviewItem[]>>({});
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [quickAddDay, setQuickAddDay] = useState("");
  const [quickAddMealType, setQuickAddMealType] = useState<"lunch" | "dinner">("dinner");
  const [quickAddRecipeId, setQuickAddRecipeId] = useState("");
  const [quickAddQuery, setQuickAddQuery] = useState("");
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showNextWeek, setShowNextWeek] = useState(false);

  const currentPlan = useMemo(() => {
    if (plans.length === 0) return null;
    const today = ymdToday();
    const active = plans.find((plan) => plan.start_date <= today && plan.end_date >= today);
    if (active) return active;
    const upcoming = plans.filter((plan) => plan.start_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
    if (upcoming.length > 0) return upcoming[0];
    return plans[0];
  }, [plans]);

  const nextPlan = useMemo(() => {
    if (!currentPlan) return null;
    return (
      plans
        .filter((plan) => plan.start_date > currentPlan.start_date)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))[0] ?? null
    );
  }, [plans, currentPlan]);

  const currentItems = useMemo(
    () => (currentPlan ? items.filter((item) => item.meal_plan_id === currentPlan.id) : []),
    [items, currentPlan],
  );
  const nextItems = useMemo(
    () => (nextPlan ? items.filter((item) => item.meal_plan_id === nextPlan.id) : []),
    [items, nextPlan],
  );

  const currentGroceryItems = useMemo(
    () => (currentPlan ? groceryByPlanId[currentPlan.id] ?? [] : []),
    [currentPlan, groceryByPlanId],
  );
  const nextGroceryItems = useMemo(
    () => (nextPlan ? groceryByPlanId[nextPlan.id] ?? [] : []),
    [nextPlan, groceryByPlanId],
  );

  const needToBuyItems = useMemo(
    () =>
      currentGroceryItems
        .filter((item) => !item.is_checked && !item.is_on_hand)
        .sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name)),
    [currentGroceryItems],
  );
  const needToBuyPreview = useMemo(() => needToBuyItems.slice(0, 6), [needToBuyItems]);
  const nextNeedToBuyPreview = useMemo(
    () =>
      nextGroceryItems
        .filter((item) => !item.is_checked && !item.is_on_hand)
        .sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name))
        .slice(0, 6),
    [nextGroceryItems],
  );

  const emptyDinnerCount = useMemo(() => {
    if (!currentPlan) return 0;
    const dinners = new Set(currentItems.filter((item) => item.meal_type === "dinner").map((item) => item.plan_date));
    return planDays(currentPlan).filter((day) => !dinners.has(day)).length;
  }, [currentPlan, currentItems]);

  const currentPlanDays = useMemo(() => (currentPlan ? planDays(currentPlan) : []), [currentPlan]);
  const today = ymdToday();
  const focusDay = useMemo(() => {
    if (!currentPlan) return "";
    return today >= currentPlan.start_date && today <= currentPlan.end_date ? today : currentPlan.start_date;
  }, [currentPlan, today]);

  const todayLunch = useMemo(
    () => currentItems.filter((item) => item.plan_date === focusDay && item.meal_type === "lunch"),
    [currentItems, focusDay],
  );
  const todayDinner = useMemo(
    () => currentItems.filter((item) => item.plan_date === focusDay && item.meal_type === "dinner"),
    [currentItems, focusDay],
  );
  const todayLunchRecipes = useMemo(
    () =>
      todayLunch
        .map((item) => (Array.isArray(item.recipe) ? item.recipe[0] : item.recipe))
        .filter((recipe): recipe is { id?: string; name?: string } => Boolean(recipe)),
    [todayLunch],
  );
  const todayDinnerRecipes = useMemo(
    () =>
      todayDinner
        .map((item) => (Array.isArray(item.recipe) ? item.recipe[0] : item.recipe))
        .filter((recipe): recipe is { id?: string; name?: string } => Boolean(recipe)),
    [todayDinner],
  );
  const quickAddMatches = useMemo(() => {
    const query = quickAddQuery.trim().toLowerCase();
    if (!query) return recipes.slice(0, 8);
    return recipes.filter((recipe) => recipe.name.toLowerCase().includes(query)).slice(0, 8);
  }, [quickAddQuery, recipes]);

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    const weekPref = window.localStorage.getItem("home_show_next_week");
    setShowNextWeek(weekPref === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("home_show_next_week", String(showNextWeek));
  }, [showNextWeek]);

  useEffect(() => {
    if (!currentPlan || currentPlanDays.length === 0) return;
    setQuickAddDay(currentPlanDays.includes(focusDay) ? focusDay : currentPlanDays[0]);
  }, [currentPlan, currentPlanDays, focusDay]);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    setMessage(null);

    const { data: plansData, error: plansError } = await supabase
      .from("meal_plans")
      .select("id, start_date, end_date, order_date, pickup_date")
      .order("start_date", { ascending: false });
    if (plansError) {
      setError(plansError.message);
      setLoading(false);
      return;
    }

    const loadedPlans = (plansData ?? []) as MealPlan[];
    setPlans(loadedPlans);

    const planIds = loadedPlans.slice(0, 4).map((plan) => plan.id);
    if (planIds.length > 0) {
      const { data: planItemsData, error: planItemsError } = await supabase
        .from("meal_plan_items")
        .select("meal_plan_id, plan_date, meal_type, recipe:recipes(id, name)")
        .in("meal_plan_id", planIds);
      if (planItemsError) {
        setError(planItemsError.message);
        setLoading(false);
        return;
      }
      setItems((planItemsData ?? []) as PlanItem[]);
    } else {
      setItems([]);
    }

    const { data: recipeListData, error: recipeListError } = await supabase
      .from("recipes")
      .select("id, name")
      .order("name", { ascending: true });
    if (recipeListError) {
      setError(recipeListError.message);
      setLoading(false);
      return;
    }
    setRecipes((recipeListData ?? []) as RecipeOption[]);

    if (planIds.length > 0) {
      const { data: groceryData, error: groceryError } = await supabase
        .from("grocery_list_items")
        .select("id, meal_plan_id, ingredient_name, amount, unit_code, is_checked, is_on_hand")
        .in("meal_plan_id", planIds)
        .eq("is_pantry_staple", false);
      if (groceryError) {
        setError(groceryError.message);
        setLoading(false);
        return;
      }

      const grouped: Record<string, GroceryPreviewItem[]> = {};
      for (const planId of planIds) grouped[planId] = [];
      for (const row of (groceryData ?? []) as Array<GroceryPreviewItem & { meal_plan_id: string }>) {
        if (!grouped[row.meal_plan_id]) grouped[row.meal_plan_id] = [];
        grouped[row.meal_plan_id].push({
          id: row.id,
          ingredient_name: row.ingredient_name,
          amount: row.amount,
          unit_code: row.unit_code,
          is_checked: row.is_checked,
          is_on_hand: row.is_on_hand,
        });
      }
      setGroceryByPlanId(grouped);
    } else {
      setGroceryByPlanId({});
    }

    setLoading(false);
  }

  async function quickAddToPlan() {
    const resolvedRecipeId = quickAddRecipeId || quickAddMatches[0]?.id || "";
    if (!currentPlan || !quickAddDay || !resolvedRecipeId) return;

    setQuickAddSaving(true);
    setError(null);
    setMessage(null);

    const { error: insertError } = await supabase.from("meal_plan_items").insert({
      meal_plan_id: currentPlan.id,
      plan_date: quickAddDay,
      meal_type: quickAddMealType,
      recipe_id: resolvedRecipeId,
      serving_multiplier: 1,
    });
    if (insertError) {
      setError(insertError.message);
      setQuickAddSaving(false);
      return;
    }

    const refreshIds = plans.slice(0, 4).map((plan) => plan.id);
    if (refreshIds.length > 0) {
      const { data: refreshedItems, error: refreshError } = await supabase
        .from("meal_plan_items")
        .select("meal_plan_id, plan_date, meal_type, recipe:recipes(id, name)")
        .in("meal_plan_id", refreshIds);
      if (refreshError) {
        setError(refreshError.message);
        setQuickAddSaving(false);
        return;
      }
      setItems((refreshedItems ?? []) as PlanItem[]);
    }

    setQuickAddRecipeId("");
    setQuickAddQuery("");
    setMessage("Meal added.");
    setQuickAddSaving(false);
  }

  function renderWeek(plan: MealPlan, planItems: PlanItem[]) {
    const byKey = new Map<string, PlanItem[]>();
    for (const item of planItems) {
      const key = `${item.plan_date}:${item.meal_type}`;
      const current = byKey.get(key) ?? [];
      current.push(item);
      byKey.set(key, current);
    }

    return (
      <div className="home-week-card">
        <div className="section-head">
          <h3>
            {formatDisplayDate(plan.start_date)} to {formatDisplayDate(plan.end_date)}
          </h3>
          <Link className="ghost-btn" href="/plans">
            Open plan
          </Link>
        </div>
        <div className="home-week-grid">
          {planDays(plan).map((day) => {
            const lunchItems = byKey.get(`${day}:lunch`) ?? [];
            const dinnerItems = byKey.get(`${day}:dinner`) ?? [];
            const lunchRecipes = lunchItems
              .map((item) => (Array.isArray(item.recipe) ? item.recipe[0] : item.recipe))
              .filter((recipe): recipe is { id?: string; name?: string } => Boolean(recipe));
            const dinnerRecipes = dinnerItems
              .map((item) => (Array.isArray(item.recipe) ? item.recipe[0] : item.recipe))
              .filter((recipe): recipe is { id?: string; name?: string } => Boolean(recipe));
            return (
              <div className="home-day-block" key={day}>
                <div className="home-day-head">
                  <strong>{formatDayName(day)}</strong>
                </div>
                <span className="muted">{formatDisplayDate(day)}</span>
                {lunchRecipes.length > 0 ? (
                  <span>
                    Lunch:{" "}
                    {lunchRecipes.map((recipe, index) => (
                      <span key={`${recipe.id ?? recipe.name ?? "recipe"}-${index}`}>
                        {index > 0 ? ", " : ""}
                        {recipe.id ? (
                          <Link className="recipe-link" href={`/recipes/${recipe.id}`}>
                            {recipe.name ?? "Recipe"}
                          </Link>
                        ) : (
                          recipe.name ?? "Recipe"
                        )}
                      </span>
                    ))}
                  </span>
                ) : null}
                {dinnerRecipes.length > 0 ? (
                  <span>
                    Dinner:{" "}
                    {dinnerRecipes.map((recipe, index) => (
                      <span key={`${recipe.id ?? recipe.name ?? "recipe"}-${index}`}>
                        {index > 0 ? ", " : ""}
                        {recipe.id ? (
                          <Link className="recipe-link" href={`/recipes/${recipe.id}`}>
                            {recipe.name ?? "Recipe"}
                          </Link>
                        ) : (
                          recipe.name ?? "Recipe"
                        )}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <AppShell userEmail={userEmail}>
      <section className="hero">
        <p className="eyebrow">Meal Queue</p>
        <h1>Home</h1>
        <p>Plan today quickly, keep this week on track, and stay ahead of grocery runs.</p>
      </section>

      {error ? <p className="error-text">{error}</p> : null}
      {loading ? <p>Loading dashboard...</p> : null}

      {!loading ? (
        <section className="home-grid">
          <article className="panel home-today-card">
            <div className="section-head">
              <h2>Today</h2>
              {focusDay ? <span className="muted">{formatLongDate(focusDay)}</span> : null}
            </div>
            <p className="muted home-section-subtitle">Plan and adjust today&apos;s meals quickly.</p>
            {currentPlan ? (
              <div className="home-today-grid">
                <div className="home-today-slot">
                  <strong>Lunch</strong>
                  {todayLunchRecipes.length > 0 ? (
                    <span>
                      {todayLunchRecipes.map((recipe, index) => (
                        <span key={`${recipe.id ?? recipe.name ?? "recipe"}-${index}`}>
                          {index > 0 ? ", " : ""}
                          {recipe.id ? (
                            <Link className="recipe-link" href={`/recipes/${recipe.id}`}>
                              {recipe.name ?? "Recipe"}
                            </Link>
                          ) : (
                            recipe.name ?? "Recipe"
                          )}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="muted">Not planned</span>
                  )}
                  <span className={`chip ${todayLunchRecipes.length > 0 ? "active" : ""}`}>
                    {todayLunchRecipes.length > 0 ? `${todayLunchRecipes.length} planned` : "Missing"}
                  </span>
                  <Link className={todayLunchRecipes.length > 0 ? "secondary-btn" : "primary-btn"} href="/plans">
                    {todayLunchRecipes.length > 0 ? "Adjust lunch" : "Pick lunch"}
                  </Link>
                </div>
                <div className="home-today-slot">
                  <strong>Dinner</strong>
                  {todayDinnerRecipes.length > 0 ? (
                    <span>
                      {todayDinnerRecipes.map((recipe, index) => (
                        <span key={`${recipe.id ?? recipe.name ?? "recipe"}-${index}`}>
                          {index > 0 ? ", " : ""}
                          {recipe.id ? (
                            <Link className="recipe-link" href={`/recipes/${recipe.id}`}>
                              {recipe.name ?? "Recipe"}
                            </Link>
                          ) : (
                            recipe.name ?? "Recipe"
                          )}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="muted">Not planned</span>
                  )}
                  <span className={`chip ${todayDinnerRecipes.length > 0 ? "active" : ""}`}>
                    {todayDinnerRecipes.length > 0 ? `${todayDinnerRecipes.length} planned` : "Missing"}
                  </span>
                  <Link className={todayDinnerRecipes.length > 0 ? "secondary-btn" : "primary-btn"} href="/plans">
                    {todayDinnerRecipes.length > 0 ? "Adjust dinner" : "Pick dinner"}
                  </Link>
                </div>
                <div className="home-today-slot">
                  <strong>Grocery status</strong>
                  <span>{needToBuyItems.length} need to buy</span>
                  <span>{currentGroceryItems.filter((item) => item.is_checked).length} checked</span>
                </div>
              </div>
            ) : (
              <p className="muted">No current meal plan yet.</p>
            )}
            {currentPlan ? (
              <div className="home-quick-add">
                <h3>Quick add meal</h3>
                <div className="home-quick-add-grid">
                  <select value={quickAddDay} onChange={(event) => setQuickAddDay(event.target.value)}>
                    {currentPlanDays.map((day) => (
                      <option key={day} value={day}>
                        {formatDisplayDate(day)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={quickAddMealType}
                    onChange={(event) => setQuickAddMealType(event.target.value as "lunch" | "dinner")}
                  >
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                  </select>
                  <input
                    placeholder="Search recipe..."
                    value={quickAddQuery}
                    onChange={(event) => {
                      setQuickAddQuery(event.target.value);
                      setQuickAddRecipeId("");
                    }}
                  />
                  <button
                    className="primary-btn"
                    disabled={quickAddSaving || !quickAddDay || (!quickAddRecipeId && quickAddMatches.length === 0)}
                    onClick={quickAddToPlan}
                    type="button"
                  >
                    {quickAddSaving ? "Adding..." : "Add meal"}
                  </button>
                </div>
                <div className="home-quick-search-results">
                  {quickAddMatches.map((recipe) => (
                    <button
                      className={quickAddRecipeId === recipe.id ? "pill active" : "pill"}
                      key={recipe.id}
                      onClick={() => {
                        setQuickAddRecipeId(recipe.id);
                        setQuickAddQuery(recipe.name);
                      }}
                      type="button"
                    >
                      {recipe.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {emptyDinnerCount > 0 ? <p className="muted">{emptyDinnerCount} dinner slot(s) still empty this week.</p> : null}
            {message ? <p className="success-text">{message}</p> : null}
          </article>

          <article className="panel home-week-panel">
            <div className="section-head">
              <h2>This week</h2>
              <div className="section-actions">
                <button className="secondary-btn" onClick={() => setShowNextWeek((current) => !current)} type="button">
                  {showNextWeek ? "Hide next week" : "Show next week"}
                </button>
                <Link className="ghost-btn" href="/plans">
                  Manage plans
                </Link>
              </div>
            </div>
            <p className="muted home-section-subtitle">See the full week at a glance.</p>
            {currentPlan ? renderWeek(currentPlan, currentItems) : <p className="muted">No meal plan yet.</p>}
            {nextPlan && showNextWeek ? <div className="home-next-wrap">{renderWeek(nextPlan, nextItems)}</div> : null}
          </article>

          <article className="panel home-grocery-panel">
            <div className="section-head">
              <h2>Grocery</h2>
              <div className="section-actions">
                <Link className="secondary-btn" href="/grocery">
                  Regenerate list
                </Link>
                <Link className="primary-btn" href="/grocery">
                  Open grocery
                </Link>
              </div>
            </div>
            <p className="muted home-section-subtitle">Per-plan lists with order and pickup context.</p>
            <div className="home-grocery-split">
              <div>
                <div className="home-plan-block">
                  <div className="section-head">
                    <h3>Current grocery</h3>
                    <span className="muted">
                      {currentPlan ? `${formatDisplayDate(currentPlan.start_date)} to ${formatDisplayDate(currentPlan.end_date)}` : "None"}
                    </span>
                  </div>
                  {currentPlan ? (
                    <p className="muted">
                      {currentPlan.order_date ? `Order ${formatDisplayDate(currentPlan.order_date)}` : "No order date"}
                      {" | "}
                      {currentPlan.pickup_date ? `Pickup ${formatDisplayDate(currentPlan.pickup_date)}` : "No pickup date"}
                    </p>
                  ) : null}
                  {needToBuyPreview.length === 0 ? (
                    <p className="muted">No outstanding items.</p>
                  ) : (
                    <div className="stack">
                      {needToBuyPreview.map((item) => (
                        <div className="grocery-row" key={item.id}>
                          <span>
                            {item.amount} {item.unit_code} {item.ingredient_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="home-plan-block">
                <div className="section-head">
                  <h3>Next grocery</h3>
                </div>
                {nextPlan ? (
                  <p className="muted">
                    {formatDisplayDate(nextPlan.start_date)} to {formatDisplayDate(nextPlan.end_date)}
                  </p>
                ) : (
                  <p className="muted">No next plan yet.</p>
                )}
                {nextPlan ? (
                  <>
                    <p className="muted">
                      {nextPlan.order_date ? `Order ${formatDisplayDate(nextPlan.order_date)}` : "No order date"}
                      {" | "}
                      {nextPlan.pickup_date ? `Pickup ${formatDisplayDate(nextPlan.pickup_date)}` : "No pickup date"}
                    </p>
                    {nextNeedToBuyPreview.length === 0 ? (
                      <p className="muted">No generated list yet for next plan.</p>
                    ) : (
                      <div className="stack">
                        {nextNeedToBuyPreview.map((item) => (
                          <div className="grocery-row" key={item.id}>
                            <span>
                              {item.amount} {item.unit_code} {item.ingredient_name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </article>
        </section>
      ) : null}
    </AppShell>
  );
}
