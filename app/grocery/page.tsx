"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { StatusMessage } from "@/components/status-message";
import { formatDisplayDate, formatRelativeDay, toYmd } from "@/lib/date-utils";
import { formatAmount } from "@/lib/grocery";
import { useGroceryList } from "@/lib/hooks/use-grocery-list";
import type { GroceryItem } from "@/lib/hooks/use-grocery-list";

export default function GroceryPage() {
  return (
    <AuthGate>
      {() => <ShopScreen />}
    </AuthGate>
  );
}

function ShopScreen() {
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
  const [showOnHand, setShowOnHand] = useState(false);

  const today = toYmd(new Date());
  const uncheckedCount = useMemo(
    () => [...mainItems, ...pantryItems].filter((item) => !item.is_checked).length,
    [mainItems, pantryItems],
  );

  function renderItem(item: GroceryItem, actions: Array<{ label: string; onClick: () => void }>) {
    return (
      <div className={clsx("shop-item", item.is_checked && "done")} key={item.id}>
        <button
          aria-label={`${item.is_checked ? "Uncheck" : "Check"} ${item.ingredient_name}`}
          aria-pressed={item.is_checked}
          className="shop-check"
          onClick={() => toggleChecked(item)}
          type="button"
        >
          ✓
        </button>
        <div className="shop-item-main">
          <span className="shop-name">{item.ingredient_name}</span>
          <div className="shop-item-actions">
            {actions.map((action) => (
              <button className="text-btn" key={action.label} onClick={action.onClick} type="button">
                {action.label}
              </button>
            ))}
          </div>
        </div>
        <span className="shop-amt">
          {formatAmount(item.amount)} {item.unit_code}
        </span>
      </div>
    );
  }

  function sectionHead(label: string, items: GroceryItem[]) {
    return (
      <div className="shop-section-head">
        <span>{label}</span>
        {items.length > 0 ? (
          <div className="shop-section-actions">
            <button className="text-btn" onClick={() => setCheckedForBucket(items, true)} type="button">
              Check all
            </button>
            <button className="text-btn" onClick={() => setCheckedForBucket(items, false)} type="button">
              Uncheck all
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <AppShell>
      <div className="page-col">
        <section className="shop-head">
          <h1>Shop</h1>
          <div className="shop-head-meta">
            {selectedPlan ? (
              <span className="shop-range">
                {formatDisplayDate(selectedPlan.start_date, { year: false })} – {formatDisplayDate(selectedPlan.end_date, { year: false })}
              </span>
            ) : null}
            {selectedPlan ? (
              <button
                className="ghost-btn"
                disabled={regenerating}
                onClick={() => regenerate(selectedPlan)}
                type="button"
              >
                {regenerating ? "Regenerating..." : "Regenerate"}
              </button>
            ) : null}
          </div>
        </section>

        {plans.length > 1 ? (
          <label className="shop-plan-picker">
            Plan
            <select onChange={(event) => selectPlan(event.target.value)} value={selectedPlanId ?? ""}>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {formatDisplayDate(plan.start_date)} to {formatDisplayDate(plan.end_date)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <StatusMessage error={error} message={message} />
        {loading ? <p className="muted">Loading...</p> : null}
        {!loading && plans.length === 0 ? (
          <p className="muted">No current meal plan — plan the week first, then shop from it.</p>
        ) : null}

        {selectedPlan ? (
          <>
            <div className="shop-orderbar">
              <div>
                {selectedPlan.order_date && selectedPlan.order_date >= today
                  ? `Order ${formatRelativeDay(selectedPlan.order_date, today)}`
                  : "No upcoming order date"}
                <small>
                  {selectedPlan.pickup_date
                    ? `Pickup ${formatRelativeDay(selectedPlan.pickup_date, today)}`
                    : "No pickup date"}
                </small>
              </div>
              <span aria-label={`${uncheckedCount} items unchecked`} className="shop-count">
                {uncheckedCount}
              </span>
            </div>

            {sectionHead("Groceries", mainItems)}
            {mainItems.length === 0 ? <p className="shop-empty">Nothing to buy.</p> : null}
            {mainItems.map((item) =>
              renderItem(item, [{ label: "have this", onClick: () => setOnHand(item, true) }]),
            )}

            {sectionHead("Pantry check", pantryItems)}
            {pantryItems.length === 0 ? <p className="shop-empty">No pantry staples to check.</p> : null}
            {pantryItems.map((item) =>
              renderItem(item, [
                { label: "move to groceries", onClick: () => movePantryToMain(item) },
                { label: "have this", onClick: () => setOnHand(item, true) },
              ]),
            )}

            <div className="shop-section-head">
              <span>On hand ({onHandItems.length})</span>
              {onHandItems.length > 0 ? (
                <div className="shop-section-actions">
                  <button className="text-btn" onClick={() => setShowOnHand((current) => !current)} type="button">
                    {showOnHand ? "Hide" : "Show"}
                  </button>
                </div>
              ) : null}
            </div>
            {showOnHand
              ? onHandItems.map((item) =>
                  renderItem(item, [{ label: "move back", onClick: () => setOnHand(item, false) }]),
                )
              : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
