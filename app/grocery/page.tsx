"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { StatusMessage } from "@/components/status-message";
import { formatDisplayDate } from "@/lib/date-utils";
import { formatAmount } from "@/lib/grocery";
import { useGroceryList } from "@/lib/hooks/use-grocery-list";

export default function GroceryPage() {
  return (
    <AuthGate>
      {(session) => <GroceryScreen userEmail={session.user.email} />}
    </AuthGate>
  );
}

function GroceryScreen({ userEmail }: { userEmail?: string }) {
  const {
    plans,
    selectedPlanId,
    selectPlan,
    selectedPlan,
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
  } = useGroceryList();
  const [showPantry, setShowPantry] = useState(true);
  const [showOnHand, setShowOnHand] = useState(true);

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
                onClick={() => selectPlan(plan.id)}
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
                  onClick={() => regenerate(selectedPlan)}
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
