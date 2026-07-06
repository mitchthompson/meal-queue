import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import {
  createDefaultsFromStart,
  findNextAvailableStartDate,
  nextDayInRange,
  toYmd,
} from "@/lib/date-utils";
import { DEFAULT_USER_SETTINGS } from "@/lib/constants";
import { toErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";

// Data layer for the plans screen (milestone 6 extraction — behavior
// identical to the former in-page logic). Owns plan/recipe/settings loading,
// plan CRUD, slot upserts and leftover linking, list filtering, and the
// quick-add state machine (which the write flows mutate, so it lives here);
// the page keeps only presentation.

export type MealPlan = {
  id: string;
  start_date: string;
  end_date: string;
  order_date: string | null;
  pickup_date: string | null;
  version: number;
};

export type RecipeOption = {
  id: string;
  name: string;
  base_servings: number;
};

export type MealSlotType = "cook" | "leftover" | "eat_out";

export type MealPlanItem = {
  id: string;
  plan_date: string;
  slot_type: MealSlotType;
  leftover_from_item_id: string | null;
  note: string | null;
  serving_multiplier: number;
  created_at: string;
  recipe: RecipeOption | null;
};

export type PlanForm = {
  start_date: string;
  end_date: string;
  order_date: string;
  pickup_date: string;
};

export type SettingsDefaults = {
  default_plan_days: number;
  week_starts_on: number;
  default_order_weekday: number | null;
  default_pickup_weekday: number | null;
};

export type PlanListFilter = "current" | "upcoming" | "past" | "all";

export type LeftoverOption = {
  id: string;
  plan_date: string;
  recipe_id: string;
  recipe_name: string;
};

export function usePlan(userId: string) {
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
  const [settingsDefaults, setSettingsDefaults] = useState<SettingsDefaults>(DEFAULT_USER_SETTINGS);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [recentRecipeIds, setRecentRecipeIds] = useState<string[]>([]);
  const [quickQuery, setQuickQuery] = useState("");
  const [quickMode, setQuickMode] = useState<MealSlotType>("cook");
  const [quickLeftoverId, setQuickLeftoverId] = useState("");
  const [quickNote, setQuickNote] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanListFilter>("current");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const quickInputRef = useRef<HTMLInputElement | null>(null);
  const previousPlanFilterRef = useRef<PlanListFilter>(planFilter);

  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedPlanId) ?? null, [plans, selectedPlanId]);
  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const visiblePlans = useMemo(() => {
    const filtered = plans.filter((plan) => {
      if (planFilter === "all") return true;
      if (planFilter === "current") return plan.start_date <= todayYmd && plan.end_date >= todayYmd;
      if (planFilter === "upcoming") return plan.start_date > todayYmd;
      return plan.end_date < todayYmd;
    });

    if (planFilter === "upcoming") {
      return [...filtered].sort((a, b) => a.start_date.localeCompare(b.start_date));
    }
    if (planFilter === "past") {
      return [...filtered].sort((a, b) => b.start_date.localeCompare(a.start_date));
    }
    if (planFilter === "current") {
      return [...filtered].sort((a, b) => a.start_date.localeCompare(b.start_date));
    }
    return filtered;
  }, [planFilter, plans, todayYmd]);

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  // Most-recently-planned recipes surface first (owner request, 2026-07-02
  // review) so the household rotation is one tap away; ties fall back to name.
  const quickMatches = useMemo(() => {
    const query = quickQuery.trim().toLowerCase();
    const rank = (recipe: RecipeOption) => {
      const index = recentRecipeIds.indexOf(recipe.id);
      return index === -1 ? recentRecipeIds.length : index;
    };
    const pool = query ? recipes.filter((recipe) => recipe.name.toLowerCase().includes(query)) : recipes;
    return [...pool].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, 8);
  }, [recipes, quickQuery, recentRecipeIds]);

  const quickLeftoverOptions = useMemo(() => {
    if (!activeDay) return [] as LeftoverOption[];
    return items
      .filter((item) => item.slot_type === "cook" && item.plan_date < activeDay && item.recipe?.id && item.recipe?.name)
      .map((item) => ({
        id: item.id,
        plan_date: item.plan_date,
        recipe_id: item.recipe!.id,
        recipe_name: item.recipe!.name,
      }))
      .sort((a, b) => b.plan_date.localeCompare(a.plan_date));
  }, [activeDay, items]);

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
    const filterChanged = previousPlanFilterRef.current !== planFilter;
    previousPlanFilterRef.current = planFilter;
    if (visiblePlans.length === 0) return;
    if (filterChanged || !selectedPlanId || !visiblePlans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(visiblePlans[0].id);
    }
  }, [planFilter, selectedPlanId, visiblePlans]);

  useEffect(() => {
    if (activeDay) quickInputRef.current?.focus();
  }, [activeDay]);

  useEffect(() => {
    if (quickMode !== "leftover") return;
    if (!quickLeftoverId && quickLeftoverOptions.length > 0) {
      setQuickLeftoverId(quickLeftoverOptions[0].id);
    }
  }, [quickMode, quickLeftoverId, quickLeftoverOptions]);

  async function loadInitialData() {
    setLoading(true);
    setError(null);

    const [plansRes, recipesRes, settingsRes, recentRes] = await Promise.all([
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
      supabase
        .from("meal_plan_items")
        .select("recipe_id, created_at")
        .not("recipe_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (plansRes.error || recipesRes.error || settingsRes.error) {
      setError(toErrorMessage(plansRes.error ?? recipesRes.error ?? settingsRes.error, "Failed loading plans."));
      setLoading(false);
      return;
    }

    const loadedPlans = (plansRes.data ?? []) as MealPlan[];
    setPlans(loadedPlans);
    if (loadedPlans.length > 0) setSelectedPlanId(loadedPlans[0].id);

    const settings = settingsRes.data ?? DEFAULT_USER_SETTINGS;
    setSettingsDefaults(settings);
    const defaultStart = findNextAvailableStartDate(settings.week_starts_on, loadedPlans);
    setCreateForm(createDefaultsFromStart(defaultStart, settings));

    const recipeRows = (recipesRes.data ?? []) as RecipeOption[];
    setRecipes(recipeRows);

    // Recency feeds quick-add ordering only — an error here degrades to
    // name order rather than failing the page.
    const recentRows = (recentRes.data ?? []) as Array<{ recipe_id: string | null }>;
    setRecentRecipeIds([
      ...new Set(recentRows.map((row) => row.recipe_id).filter((id): id is string => Boolean(id))),
    ]);

    setLoading(false);
  }

  async function loadPlanItems(planId: string) {
    const { data, error: planItemsError } = await supabase
      .from("meal_plan_items")
      .select("id, plan_date, slot_type, leftover_from_item_id, note, serving_multiplier, created_at, recipe:recipes(id, name, base_servings)")
      .eq("meal_plan_id", planId)
      .order("plan_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (planItemsError) {
      setError(toErrorMessage(planItemsError, "Failed loading the plan's meals."));
      return;
    }

    setItems(
      ((data ?? []) as Array<{
        id: string;
        plan_date: string;
        slot_type: MealSlotType;
        leftover_from_item_id: string | null;
        note: string | null;
        serving_multiplier: number;
        created_at: string;
        recipe: RecipeOption[] | RecipeOption | null;
      }>).map((row) => ({
        id: row.id,
        plan_date: row.plan_date,
        slot_type: row.slot_type,
        leftover_from_item_id: row.leftover_from_item_id,
        note: row.note,
        serving_multiplier: row.serving_multiplier,
        created_at: row.created_at,
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

  async function createPlan(event: FormEvent<HTMLFormElement>) {
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
      setError(toErrorMessage(caughtError, "Failed creating plan."));
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
      setError(toErrorMessage(caughtError, "Failed saving plan."));
    } finally {
      setSaving(false);
    }
  }

  // Plan version bumps are handled by the bump_plan_version database trigger
  // (grocery-relevant item changes only) — no client-side version writes.
  async function addMeal(
    day: string,
    options: {
      slotType: MealSlotType;
      recipeId?: string | null;
      servingMultiplier?: number;
      leftoverFromItemId?: string | null;
      note?: string | null;
    },
    moveToNextDay = false,
  ) {
    if (!selectedPlan) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    // Milestone 10 PR 2: append the new meal locally (temp id) before the
    // insert, then swap in the real id on success. tempId is declared out here
    // so the catch can remove exactly this row on failure — and only if the
    // insert never succeeded, since a successful insert swaps the id away
    // (making the filter a no-op, so a later refresh throw keeps the saved row).
    let tempId: string | null = null;
    try {
      // The grid renders from the (possibly unsaved) date form; the database
      // validates against the SAVED range. Catch the mismatch with a clear
      // message instead of a raw trigger error.
      if (day < selectedPlan.start_date || day > selectedPlan.end_date) {
        throw new Error("This day is outside the plan's saved dates. Save the plan dates first, then add meals.");
      }

      const slotType = options.slotType;
      const servingMultiplier = options.servingMultiplier ?? 1;
      const recipeId = options.recipeId ?? null;
      const leftoverFromItemId = options.leftoverFromItemId ?? null;
      const note = options.note?.trim() ? options.note.trim() : null;

      // Recipe object for the optimistic row: cook slots resolve from the
      // hook's recipe list, leftovers from the source item they copy, eat-out
      // has none. Real call paths always resolve (cook ids come from the recipe
      // list, leftover sources carry a recipe); null is only a defensive fallback.
      const optimisticRecipe: RecipeOption | null =
        slotType === "cook" && recipeId
          ? recipes.find((recipe) => recipe.id === recipeId) ?? null
          : slotType === "leftover" && leftoverFromItemId
            ? items.find((value) => value.id === leftoverFromItemId)?.recipe ?? null
            : null;

      // Random suffix (not just Date.now()) so two adds in the same millisecond
      // cannot share a temp id and get collapsed onto one real id by the swap.
      const newId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      tempId = newId;
      const optimisticItem: MealPlanItem = {
        id: newId,
        plan_date: day,
        slot_type: slotType,
        leftover_from_item_id: leftoverFromItemId,
        note,
        serving_multiplier: servingMultiplier,
        created_at: new Date().toISOString(),
        recipe: optimisticRecipe,
      };
      setItems((current) => [...current, optimisticItem]);

      const { data: inserted, error: insertError } = await supabase
        .from("meal_plan_items")
        .insert({
          meal_plan_id: selectedPlan.id,
          plan_date: day,
          // Vestigial since the flat-day rework (owner decision 2026-07-02):
          // the NOT NULL column stays in the schema, every new row writes
          // 'dinner', and nothing reads it.
          meal_type: "dinner",
          slot_type: slotType,
          recipe_id: recipeId,
          leftover_from_item_id: leftoverFromItemId,
          note,
          serving_multiplier: servingMultiplier,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      // Swap the temp id for the real one in place; keep the plan-version
      // refresh, drop the full item refetch (the local row is already truth).
      setItems((current) => current.map((value) => (value.id === newId ? { ...value, id: inserted.id } : value)));
      await refreshPlansAndKeepSelection(selectedPlan.id);
      if (slotType === "leftover") {
        setMessage("Leftover added to plan.");
      } else if (slotType === "eat_out") {
        setMessage("Eating out added to plan.");
      } else {
        setMessage("Recipe added to plan.");
      }
      if (moveToNextDay) {
        const nextDay = nextDayInRange(day, selectedForm.end_date);
        if (nextDay) {
          setActiveDay(nextDay);
          setQuickQuery("");
        } else {
          setActiveDay(null);
        }
      } else {
        setActiveDay(null);
      }
    } catch (caughtError) {
      // Remove only this optimistic row; a no-op once the id was swapped (so a
      // successful insert whose later refresh throws keeps the saved row).
      if (tempId) setItems((current) => current.filter((value) => value.id !== tempId));
      setError(toErrorMessage(caughtError, "Failed adding meal."));
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(itemId: string) {
    if (!selectedPlan) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    // Milestone 10 PR 2: drop the item locally before the delete round trip;
    // keep the plan-version refresh, drop the item refetch. Capture the removed
    // row (and its position) so a WRITE failure re-inserts just that row; a
    // successful delete whose later refresh throws must NOT bring it back.
    const removedIndex = items.findIndex((value) => value.id === itemId);
    const removed = removedIndex >= 0 ? items[removedIndex] : null;
    let deleted = false;
    setItems((current) => current.filter((value) => value.id !== itemId));
    try {
      const { error: deleteError } = await supabase.from("meal_plan_items").delete().eq("id", itemId);
      if (deleteError) throw deleteError;
      deleted = true;

      await refreshPlansAndKeepSelection(selectedPlan.id);
      setMessage("Meal removed.");
    } catch (caughtError) {
      if (!deleted && removed) {
        setItems((current) => {
          if (current.some((value) => value.id === itemId)) return current;
          const next = [...current];
          next.splice(Math.min(removedIndex, next.length), 0, removed);
          return next;
        });
      }
      setError(toErrorMessage(caughtError, "Failed removing meal."));
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
      setError(toErrorMessage(caughtError, "Failed deleting plan."));
    } finally {
      setSaving(false);
    }
  }

  async function adjustServing(item: MealPlanItem, delta: number) {
    if (!selectedPlan) return;
    if (item.slot_type !== "cook") return;
    const nextValue = Math.max(0.25, Number((item.serving_multiplier + delta).toFixed(2)));
    setSaving(true);
    setError(null);
    setMessage(null);
    // Milestone 10 PR 2: patch the serving locally before the write; the local
    // patch is the truth on success, so we keep the plan-version refresh but
    // drop the full item refetch. Roll back only this item's value, and only if
    // the WRITE failed (a successful write whose later refresh throws stays put).
    const priorValue = item.serving_multiplier;
    let written = false;
    setItems((current) =>
      current.map((value) => (value.id === item.id ? { ...value, serving_multiplier: nextValue } : value)),
    );
    try {
      const { error: updateError } = await supabase
        .from("meal_plan_items")
        .update({ serving_multiplier: nextValue })
        .eq("id", item.id);
      if (updateError) throw updateError;
      written = true;

      await refreshPlansAndKeepSelection(selectedPlan.id);
      setMessage("Serving updated.");
    } catch (caughtError) {
      if (!written) {
        setItems((current) =>
          current.map((value) => (value.id === item.id ? { ...value, serving_multiplier: priorValue } : value)),
        );
      }
      setError(toErrorMessage(caughtError, "Failed updating serving."));
    } finally {
      setSaving(false);
    }
  }

  function openQuickAdd(day: string) {
    setActiveDay(day);
    setQuickMode("cook");
    setQuickLeftoverId("");
    setQuickNote("");
    setQuickQuery("");
  }

  async function handleQuickAddKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!activeDay) return;
    if (event.key === "Escape") {
      setActiveDay(null);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (quickMode === "cook") {
        const top = quickMatches[0];
        if (!top) return;
        await addMeal(activeDay, { slotType: "cook", recipeId: top.id, servingMultiplier: 1 }, event.shiftKey);
        return;
      }
      if (quickMode === "leftover") {
        const choice = quickLeftoverOptions.find((option) => option.id === quickLeftoverId) ?? quickLeftoverOptions[0];
        if (!choice) return;
        await addMeal(
          activeDay,
          {
            slotType: "leftover",
            recipeId: choice.recipe_id,
            leftoverFromItemId: choice.id,
            servingMultiplier: 1,
          },
          event.shiftKey,
        );
        return;
      }
      await addMeal(activeDay, { slotType: "eat_out", note: quickNote || "Eating out", servingMultiplier: 1 }, event.shiftKey);
    }
  }

  return {
    plans,
    visiblePlans,
    selectedPlan,
    selectedPlanId,
    selectPlan: setSelectedPlanId,
    items,
    itemById,
    createForm,
    setCreateForm,
    selectedForm,
    setSelectedForm,
    settingsDefaults,
    planFilter,
    setPlanFilter,
    activeDay,
    quickQuery,
    setQuickQuery,
    quickMode,
    setQuickMode,
    quickLeftoverId,
    setQuickLeftoverId,
    quickNote,
    setQuickNote,
    quickInputRef,
    quickMatches,
    quickLeftoverOptions,
    loading,
    saving,
    error,
    message,
    createPlan,
    savePlanMeta,
    deleteSelectedPlan,
    addMeal,
    removeItem,
    adjustServing,
    openQuickAdd,
    handleQuickAddKeyDown,
  };
}
