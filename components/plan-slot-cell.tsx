"use client";

import Link from "next/link";
import { formatDisplayDate } from "@/lib/date-utils";
import type { MealPlanItem, usePlan } from "@/lib/hooks/use-plan";

// Shared lunch/dinner slot cell for the plans grid (milestone 6 extraction —
// the two meal columns were ~330 near-identical JSX lines). All state and
// writes come in as props from usePlan; the cell owns no state. The root div
// must stay `plan-slot-cell` and remain a direct child of `plan-grid-row`:
// the mobile Lunch/Dinner labels are injected by nth-child ::before rules in
// globals.css that depend on the row's child order.

const EAT_OUT_NOTE_PLACEHOLDER: Record<MealPlanItem["meal_type"], string> = {
  lunch: "Optional note (e.g. sushi)",
  dinner: "Optional note (e.g. date night)",
};

type PlanSlotCellProps = Pick<
  ReturnType<typeof usePlan>,
  | "itemById"
  | "activeSlot"
  | "quickMode"
  | "setQuickMode"
  | "quickQuery"
  | "setQuickQuery"
  | "quickNote"
  | "setQuickNote"
  | "quickLeftoverId"
  | "setQuickLeftoverId"
  | "quickInputRef"
  | "quickMatches"
  | "quickLeftoverOptions"
  | "handleQuickAddKeyDown"
  | "upsertPlanSlot"
  | "removeItem"
  | "adjustServing"
  | "openQuickAdd"
> & {
  day: string;
  mealType: MealPlanItem["meal_type"];
  items: MealPlanItem[];
};

export function PlanSlotCell({
  day,
  mealType,
  items,
  itemById,
  activeSlot,
  quickMode,
  setQuickMode,
  quickQuery,
  setQuickQuery,
  quickNote,
  setQuickNote,
  quickLeftoverId,
  setQuickLeftoverId,
  quickInputRef,
  quickMatches,
  quickLeftoverOptions,
  handleQuickAddKeyDown,
  upsertPlanSlot,
  removeItem,
  adjustServing,
  openQuickAdd,
}: PlanSlotCellProps) {
  return (
    <div className="plan-slot-cell">
      {activeSlot?.day === day && activeSlot.meal_type === mealType ? (
        <div className="quick-add-card">
          <div className="quick-add-list">
            <button
              className={quickMode === "cook" ? "pill active" : "pill"}
              onClick={() => setQuickMode("cook")}
              type="button"
            >
              Cook
            </button>
            <button
              className={quickMode === "leftover" ? "pill active" : "pill"}
              onClick={() => setQuickMode("leftover")}
              type="button"
            >
              Leftovers
            </button>
            <button
              className={quickMode === "eat_out" ? "pill active" : "pill"}
              onClick={() => setQuickMode("eat_out")}
              type="button"
            >
              Eating out
            </button>
          </div>
          {quickMode === "cook" ? (
            <>
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
                    onClick={() =>
                      upsertPlanSlot(day, mealType, { slotType: "cook", recipeId: recipe.id, servingMultiplier: 1 })
                    }
                    type="button"
                  >
                    {recipe.name}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {quickMode === "leftover" ? (
            <>
              <select
                value={quickLeftoverId}
                onChange={(event) => setQuickLeftoverId(event.target.value)}
              >
                {quickLeftoverOptions.length === 0 ? <option value="">No prior cooked meals</option> : null}
                {quickLeftoverOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {formatDisplayDate(option.plan_date)} {option.meal_type}: {option.recipe_name}
                  </option>
                ))}
              </select>
              <div className="section-actions">
                <button
                  className="secondary-btn"
                  disabled={quickLeftoverOptions.length === 0}
                  onClick={() => {
                    const choice =
                      quickLeftoverOptions.find((option) => option.id === quickLeftoverId) ??
                      quickLeftoverOptions[0];
                    if (!choice) return;
                    upsertPlanSlot(day, mealType, {
                      slotType: "leftover",
                      recipeId: choice.recipe_id,
                      leftoverFromItemId: choice.id,
                      servingMultiplier: 1,
                    });
                  }}
                  type="button"
                >
                  Add leftovers
                </button>
              </div>
            </>
          ) : null}
          {quickMode === "eat_out" ? (
            <>
              <input
                ref={quickInputRef}
                placeholder={EAT_OUT_NOTE_PLACEHOLDER[mealType]}
                value={quickNote}
                onChange={(event) => setQuickNote(event.target.value)}
                onKeyDown={handleQuickAddKeyDown}
              />
              <button
                className="secondary-btn"
                onClick={() =>
                  upsertPlanSlot(day, mealType, {
                    slotType: "eat_out",
                    note: quickNote || "Eating out",
                    servingMultiplier: 1,
                  })
                }
                type="button"
              >
                Save eating out
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {items.length > 0 ? (
        <>
          {items.map((item) => (
            <div className="slot-card" key={item.id}>
              {item.slot_type === "eat_out" ? (
                <strong>{item.note?.trim() || "Eating out"}</strong>
              ) : (
                <>
                  {item.recipe?.id ? (
                    <Link className="recipe-link" href={`/recipes/${item.recipe.id}`}>
                      {item.recipe?.name ?? "Recipe"}
                    </Link>
                  ) : (
                    <strong>{item.recipe?.name ?? "Recipe"}</strong>
                  )}
                  {item.slot_type === "leftover" ? (
                    <span>
                      Leftover from{" "}
                      {item.leftover_from_item_id && itemById.get(item.leftover_from_item_id)
                        ? formatDisplayDate(itemById.get(item.leftover_from_item_id)!.plan_date)
                        : "earlier cook"}
                    </span>
                  ) : null}
                </>
              )}
              {item.slot_type === "cook" ? (
                <div className="serving-controls">
                  <button className="text-btn" onClick={() => adjustServing(item, -0.25)} type="button">
                    -
                  </button>
                  <span>x {item.serving_multiplier}</span>
                  <button className="text-btn" onClick={() => adjustServing(item, 0.25)} type="button">
                    +
                  </button>
                </div>
              ) : null}
              <button className="text-btn" onClick={() => removeItem(item.id)} type="button">
                Remove
              </button>
            </div>
          ))}
          <button className="secondary-btn" onClick={() => openQuickAdd(day, mealType)} type="button">
            Add another {mealType} recipe
          </button>
        </>
      ) : (
        <button className="secondary-btn" onClick={() => openQuickAdd(day, mealType)} type="button">
          Add {mealType}
        </button>
      )}
    </div>
  );
}
