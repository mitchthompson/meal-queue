import { useEffect, useMemo, useState } from "react";
import { toErrorMessage } from "@/lib/errors";
import { dateRange, toYmd } from "@/lib/date-utils";
import { supabase } from "@/lib/supabase/client";

// Data layer for the Today screen (reflow screen 2). Loads items for the
// plans Today actually shows — the date-relevant current plan and its
// successor — instead of the old dashboard's 4-newest-plans window, which
// could silently exclude the active week.

export type TodayPlan = {
  id: string;
  start_date: string;
  end_date: string;
  order_date: string | null;
  pickup_date: string | null;
};

export type TodayRecipe = {
  id: string;
  name: string;
  base_servings: number;
};

export type TodayItem = {
  id: string;
  meal_plan_id: string;
  plan_date: string;
  slot_type: "cook" | "leftover" | "eat_out";
  note: string | null;
  serving_multiplier: number;
  created_at: string;
  recipe: TodayRecipe | null;
};

export function useToday() {
  const [plans, setPlans] = useState<TodayPlan[]>([]);
  const [items, setItems] = useState<TodayItem[]>([]);
  const [uncheckedCount, setUncheckedCount] = useState<number | null>(null);
  const [heroStepCount, setHeroStepCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = toYmd(new Date());

  const currentPlan = useMemo(() => {
    const active = plans.find((plan) => plan.start_date <= today && plan.end_date >= today);
    if (active) return active;
    return (
      plans
        .filter((plan) => plan.start_date > today)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))[0] ?? null
    );
  }, [plans, today]);

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

  const tonightItems = useMemo(
    () => currentItems.filter((item) => item.plan_date === today),
    [currentItems, today],
  );

  // The hero headlines one meal: prefer something to cook, then leftovers,
  // then an eat-out note.
  const heroItem = useMemo(() => {
    return (
      tonightItems.find((item) => item.slot_type === "cook") ??
      tonightItems.find((item) => item.slot_type === "leftover") ??
      tonightItems[0] ??
      null
    );
  }, [tonightItems]);

  // Up to two of tonight's meals show on the hero (owner request, 2026-07-02
  // review — e.g. a main plus a side); the rest collapse into "+N more".
  const alsoTonight = useMemo(
    () => tonightItems.filter((item) => item.id !== heroItem?.id)[0] ?? null,
    [tonightItems, heroItem],
  );
  const tonightMoreCount = Math.max(0, tonightItems.length - 2);

  const weekRows = useMemo(() => {
    if (!currentPlan) return [];
    const start = today > currentPlan.start_date ? today : currentPlan.start_date;
    if (start > currentPlan.end_date) return [];
    return dateRange(start, currentPlan.end_date).map((day) => ({
      day,
      items: currentItems.filter((item) => item.plan_date === day),
    }));
  }, [currentPlan, currentItems, today]);

  useEffect(() => {
    loadToday();
  }, []);

  async function loadToday() {
    setLoading(true);
    setError(null);

    const { data: plansData, error: plansError } = await supabase
      .from("meal_plans")
      .select("id, start_date, end_date, order_date, pickup_date")
      .order("start_date", { ascending: false });
    if (plansError) {
      setError(toErrorMessage(plansError, "Failed to load plans."));
      setLoading(false);
      return;
    }

    const loadedPlans = (plansData ?? []) as TodayPlan[];
    setPlans(loadedPlans);

    const nowYmd = toYmd(new Date());
    const active =
      loadedPlans.find((plan) => plan.start_date <= nowYmd && plan.end_date >= nowYmd) ??
      loadedPlans
        .filter((plan) => plan.start_date > nowYmd)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))[0] ??
      null;
    const following = active
      ? (loadedPlans
          .filter((plan) => plan.start_date > active.start_date)
          .sort((a, b) => a.start_date.localeCompare(b.start_date))[0] ?? null)
      : null;
    const planIds = [active?.id, following?.id].filter((id): id is string => Boolean(id));

    if (planIds.length === 0) {
      setItems([]);
      setUncheckedCount(null);
      setHeroStepCount(null);
      setLoading(false);
      return;
    }

    const [itemsRes, countRes] = await Promise.all([
      supabase
        .from("meal_plan_items")
        .select(
          "id, meal_plan_id, plan_date, slot_type, note, serving_multiplier, created_at, recipe:recipes(id, name, base_servings)",
        )
        .in("meal_plan_id", planIds)
        .order("plan_date", { ascending: true })
        .order("created_at", { ascending: true }),
      active
        ? supabase
            .from("grocery_list_items")
            .select("id", { count: "exact", head: true })
            .eq("meal_plan_id", active.id)
            .eq("is_checked", false)
            .eq("is_on_hand", false)
            .eq("is_pantry_staple", false)
        : Promise.resolve({ count: null, error: null }),
    ]);

    if (itemsRes.error || countRes.error) {
      setError(toErrorMessage(itemsRes.error ?? countRes.error, "Failed to load today."));
      setLoading(false);
      return;
    }

    const loadedItems = ((itemsRes.data ?? []) as Array<Omit<TodayItem, "recipe"> & { recipe: TodayRecipe[] | TodayRecipe | null }>).map(
      (row) => ({
        ...row,
        recipe: Array.isArray(row.recipe) ? (row.recipe[0] ?? null) : row.recipe,
      }),
    );
    setItems(loadedItems);
    setUncheckedCount(countRes.count ?? null);

    // Steps count for tonight's hero recipe (cook slots only — leftovers and
    // eat-out have nothing to cook).
    const tonightCook = active
      ? loadedItems.find(
          (item) =>
            item.meal_plan_id === active.id &&
            item.plan_date === nowYmd &&
            item.slot_type === "cook" &&
            item.recipe,
        )
      : null;
    if (tonightCook?.recipe) {
      const { count, error: stepsError } = await supabase
        .from("recipe_steps")
        .select("id", { count: "exact", head: true })
        .eq("recipe_id", tonightCook.recipe.id);
      setHeroStepCount(stepsError ? null : (count ?? null));
    } else {
      setHeroStepCount(null);
    }

    setLoading(false);
  }

  return {
    plans,
    currentPlan,
    nextPlan,
    currentItems,
    tonightItems,
    heroItem,
    alsoTonight,
    tonightMoreCount,
    heroStepCount,
    weekRows,
    uncheckedCount,
    today,
    loading,
    error,
    loadToday,
  };
}
