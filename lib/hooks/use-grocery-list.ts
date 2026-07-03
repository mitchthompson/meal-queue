import { useEffect, useMemo, useState } from "react";
import { toErrorMessage } from "@/lib/errors";
import { toYmd } from "@/lib/date-utils";
import { supabase } from "@/lib/supabase/client";

// Data layer for the grocery screen (milestone 6 extraction — behavior
// identical to the former in-page logic). Owns plan selection, item state,
// staleness-driven regeneration, and all grocery_list_items writes; the page
// keeps only presentation and view toggles.

export type GroceryPlan = {
  id: string;
  start_date: string;
  end_date: string;
  order_date: string | null;
  pickup_date: string | null;
  version: number;
  groceries_version: number | null;
};

export type GroceryItem = {
  id: string;
  ingredient_name: string;
  amount: number;
  unit_code: string;
  is_pantry_staple: boolean;
  is_on_hand: boolean;
  is_checked: boolean;
  source_key: string;
};

export function useGroceryList() {
  const [plans, setPlans] = useState<GroceryPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const mainItems = useMemo(
    () =>
      items
        .filter((item) => !item.is_pantry_staple && !item.is_on_hand)
        .sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name)),
    [items],
  );
  const pantryItems = useMemo(
    () =>
      items
        .filter((item) => item.is_pantry_staple && !item.is_on_hand)
        .sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name)),
    [items],
  );
  const onHandItems = useMemo(
    () => items.filter((item) => item.is_on_hand).sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name)),
    [items],
  );

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (!selectedPlanId) return;
    loadGroceryItems(selectedPlanId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlanId]);

  async function loadPlans() {
    setLoading(true);
    setError(null);
    const todayYmd = toYmd(new Date());
    const { data, error: plansError } = await supabase
      .from("meal_plans")
      .select("id, start_date, end_date, order_date, pickup_date, version, groceries_version")
      .gte("end_date", todayYmd);

    if (plansError) {
      setError(plansError.message);
      setLoading(false);
      return;
    }

    const loaded = (data ?? []) as GroceryPlan[];
    const currentPlans = loaded
      .filter((plan) => plan.start_date <= todayYmd && plan.end_date >= todayYmd)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    const futurePlans = loaded
      .filter((plan) => plan.start_date > todayYmd)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    const ordered = [...currentPlans, ...futurePlans];

    setPlans(ordered);
    setSelectedPlanId((current) => {
      if (current && ordered.some((plan) => plan.id === current)) return current;
      return ordered[0]?.id ?? null;
    });
    setLoading(false);
  }

  async function loadGroceryItems(planId: string, options?: { skipStaleCheck?: boolean }) {
    setError(null);
    const { data, error: groceryError } = await supabase
      .from("grocery_list_items")
      .select("id, ingredient_name, amount, unit_code, is_pantry_staple, is_on_hand, is_checked, source_key")
      .eq("meal_plan_id", planId)
      .order("ingredient_name", { ascending: true });

    if (groceryError) {
      setError(groceryError.message);
      return;
    }

    setItems((data ?? []) as GroceryItem[]);

    if (options?.skipStaleCheck) return;
    const plan = plans.find((value) => value.id === planId);
    if (!plan) return;

    // Stale when the list was generated from a different plan version (or
    // never generated). Milestone 3's triggers bump the version only on
    // grocery-relevant changes, and regeneration preserves user state, so an
    // automatic regenerate here is safe.
    if (plan.groceries_version !== plan.version) {
      await regenerate(plan, true);
    }
  }

  async function regenerate(plan: GroceryPlan, silent = false) {
    setRegenerating(true);
    setError(null);
    if (!silent) setMessage(null);

    try {
      // Transactional, state-preserving regeneration in the database
      // (regenerate_grocery_list): unchanged items keep their checked,
      // on-hand, and pantry-override state; obsolete rows are removed only
      // after the replacement upsert succeeds.
      const { error: rpcError } = await supabase.rpc("regenerate_grocery_list", {
        p_plan_id: plan.id,
      });
      if (rpcError) throw rpcError;

      // The function stamped groceries_version = version; mirror that locally
      // so the reload below does not re-trigger regeneration.
      setPlans((current) =>
        current.map((value) => (value.id === plan.id ? { ...value, groceries_version: value.version } : value)),
      );
      await loadGroceryItems(plan.id, { skipStaleCheck: true });
      if (!silent) setMessage("Grocery list regenerated from current meal plan.");
    } catch (caughtError) {
      setError(toErrorMessage(caughtError, "Failed to regenerate grocery list."));
    } finally {
      setRegenerating(false);
    }
  }

  async function toggleChecked(item: GroceryItem) {
    const { error: toggleError } = await supabase
      .from("grocery_list_items")
      .update({ is_checked: !item.is_checked })
      .eq("id", item.id);
    if (toggleError) {
      setError(toggleError.message);
      return;
    }
    setItems((current) => current.map((value) => (value.id === item.id ? { ...value, is_checked: !value.is_checked } : value)));
  }

  async function setCheckedForBucket(bucketItems: GroceryItem[], isChecked: boolean) {
    if (bucketItems.length === 0) return;
    const ids = bucketItems.map((item) => item.id);
    const idSet = new Set(ids);
    const { error: updateError } = await supabase.from("grocery_list_items").update({ is_checked: isChecked }).in("id", ids);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((current) =>
      current.map((value) => (idSet.has(value.id) ? { ...value, is_checked: isChecked } : value)),
    );
  }

  async function movePantryToMain(item: GroceryItem) {
    const { error: moveError } = await supabase
      .from("grocery_list_items")
      .update({ is_pantry_staple: false })
      .eq("id", item.id);
    if (moveError) {
      setError(moveError.message);
      return;
    }
    setItems((current) => current.map((value) => (value.id === item.id ? { ...value, is_pantry_staple: false } : value)));
  }

  async function setOnHand(item: GroceryItem, isOnHand: boolean) {
    const { error: updateError } = await supabase
      .from("grocery_list_items")
      .update({ is_on_hand: isOnHand })
      .eq("id", item.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setItems((current) => current.map((value) => (value.id === item.id ? { ...value, is_on_hand: isOnHand } : value)));
  }

  return {
    plans,
    selectedPlanId,
    selectPlan: setSelectedPlanId,
    selectedPlan,
    items,
    mainItems,
    pantryItems,
    onHandItems,
    loading,
    regenerating,
    error,
    message,
    regenerate,
    toggleChecked,
    setCheckedForBucket,
    movePantryToMain,
    setOnHand,
  };
}
