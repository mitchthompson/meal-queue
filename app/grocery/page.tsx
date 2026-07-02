"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { toYmd } from "@/lib/date-utils";
import { formatAmount } from "@/lib/grocery";
import { toErrorMessage } from "@/lib/errors";
import { StatusMessage } from "@/components/status-message";
import { supabase } from "@/lib/supabase/client";

type MealPlan = {
  id: string;
  start_date: string;
  end_date: string;
  version: number;
  groceries_version: number | null;
};

type GroceryItem = {
  id: string;
  ingredient_name: string;
  amount: number;
  unit_code: string;
  is_pantry_staple: boolean;
  is_on_hand: boolean;
  is_checked: boolean;
  source_key: string;
};

function formatDisplayDate(ymd: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${ymd}T00:00:00`),
  );
}

export default function GroceryPage() {
  return (
    <AuthGate>
      {(session) => <GroceryScreen userEmail={session.user.email} />}
    </AuthGate>
  );
}

function GroceryScreen({ userEmail }: { userEmail?: string }) {
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [showPantry, setShowPantry] = useState(true);
  const [showOnHand, setShowOnHand] = useState(true);
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
      .select("id, start_date, end_date, version, groceries_version")
      .gte("end_date", todayYmd);

    if (plansError) {
      setError(plansError.message);
      setLoading(false);
      return;
    }

    const loaded = (data ?? []) as MealPlan[];
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
      await regenerateForPlan(plan, true);
    }
  }

  async function regenerateForPlan(plan: MealPlan, silent = false) {
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

  return (
    <AppShell userEmail={userEmail}>
      <section className="split-layout">
        <aside className="panel">
          <h2>Meal plans</h2>
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
              </button>
            ))}
            {!loading && plans.length === 0 ? <p>No meal plans yet.</p> : null}
          </div>
        </aside>

        <section className="panel">
          {!selectedPlan ? (
            <p>Select a meal plan.</p>
          ) : (
            <div className="stack">
              <div className="section-head">
                <h2>
                  Grocery for {formatDisplayDate(selectedPlan.start_date)} to {formatDisplayDate(selectedPlan.end_date)}
                </h2>
                <button
                  className="secondary-btn"
                  disabled={regenerating}
                  onClick={() => regenerateForPlan(selectedPlan)}
                  type="button"
                >
                  {regenerating ? "Regenerating..." : "Regenerate"}
                </button>
              </div>

              <div className="stack">
                <div className="section-head">
                  <h3>Main list</h3>
                  <div className="section-actions">
                    <button className="text-btn" onClick={() => setCheckedForBucket(mainItems, true)} type="button">
                      Check all
                    </button>
                    <button className="text-btn" onClick={() => setCheckedForBucket(mainItems, false)} type="button">
                      Uncheck all
                    </button>
                  </div>
                </div>
                {mainItems.length === 0 ? <p className="muted">No main-list items.</p> : null}
                {mainItems.map((item) => (
                  <div className={item.is_checked ? "grocery-row checked" : "grocery-row"} key={item.id}>
                    <label className="grocery-check">
                      <input checked={item.is_checked} onChange={() => toggleChecked(item)} type="checkbox" />
                      <span>
                        {formatAmount(item.amount)} {item.unit_code} {item.ingredient_name}
                      </span>
                    </label>
                    <button className="text-btn" onClick={() => setOnHand(item, true)} type="button">
                      Have this
                    </button>
                  </div>
                ))}
              </div>

              <div className="stack">
                <button className="text-btn" onClick={() => setShowOnHand((current) => !current)} type="button">
                  {showOnHand ? "Hide on-hand items" : "Show on-hand items"} ({onHandItems.length})
                </button>
                {showOnHand ? (
                  <div className="stack">
                    <div className="section-head">
                      <h3>On hand</h3>
                      <div className="section-actions">
                        <button className="text-btn" onClick={() => setCheckedForBucket(onHandItems, true)} type="button">
                          Check all
                        </button>
                        <button className="text-btn" onClick={() => setCheckedForBucket(onHandItems, false)} type="button">
                          Uncheck all
                        </button>
                      </div>
                    </div>
                    {onHandItems.length === 0 ? <p className="muted">No on-hand items.</p> : null}
                    {onHandItems.map((item) => (
                      <div className="grocery-row" key={item.id}>
                        <label className="grocery-check">
                          <input checked={item.is_checked} onChange={() => toggleChecked(item)} type="checkbox" />
                          <span>
                            {formatAmount(item.amount)} {item.unit_code} {item.ingredient_name}
                          </span>
                        </label>
                        <button className="text-btn" onClick={() => setOnHand(item, false)} type="button">
                          Move back
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="stack">
                <button className="text-btn" onClick={() => setShowPantry((current) => !current)} type="button">
                  {showPantry ? "Hide pantry staples" : "Show pantry staples"} ({pantryItems.length})
                </button>
                {showPantry ? (
                  <div className="stack">
                    <div className="section-head">
                      <h3>Pantry staples</h3>
                      <div className="section-actions">
                        <button className="text-btn" onClick={() => setCheckedForBucket(pantryItems, true)} type="button">
                          Check all
                        </button>
                        <button className="text-btn" onClick={() => setCheckedForBucket(pantryItems, false)} type="button">
                          Uncheck all
                        </button>
                      </div>
                    </div>
                    {pantryItems.length === 0 ? <p className="muted">No pantry staples.</p> : null}
                    {pantryItems.map((item) => (
                      <div className={item.is_checked ? "grocery-row checked" : "grocery-row"} key={item.id}>
                        <label className="grocery-check">
                          <input checked={item.is_checked} onChange={() => toggleChecked(item)} type="checkbox" />
                          <span>
                            {formatAmount(item.amount)} {item.unit_code} {item.ingredient_name}
                          </span>
                        </label>
                        <button className="text-btn" onClick={() => movePantryToMain(item)} type="button">
                          Move to main list
                        </button>
                        <button className="text-btn" onClick={() => setOnHand(item, true)} type="button">
                          Have this
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <StatusMessage error={error} message={message} />
        </section>
      </section>
    </AppShell>
  );
}
