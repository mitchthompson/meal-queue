"use client";

import Link from "next/link";
import { formatDisplayDate } from "@/lib/date-utils";
import type { MealPlanItem, usePlan } from "@/lib/hooks/use-plan";

// One meal (lunch or dinner) inside a Plan day card: slot rows with an
// explicit L/D label in the markup, the quick-add card when this slot is
// active, and the add affordances. All state and writes come in as props
// from usePlan; the cell owns no state. (The reflow removed the old
// nth-child ::before label injection — labels are real markup now.)

const MEAL_KEY: Record<MealPlanItem["meal_type"], string> = {
  lunch: "L",
  dinner: "D",
};

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
  const isActive = activeSlot?.day === day && activeSlot.meal_type === mealType;

  return (
    <>
      {items.map((item) => (
        <div className="plan-slot" key={item.id}>
          <span className="plan-slot-k">{MEAL_KEY[mealType]}</span>
          <div className="plan-slot-main">
            {item.slot_type === "eat_out" ? (
              <span>{item.note?.trim() || "Eating out"}</span>
            ) : item.recipe?.id ? (
              <Link className="recipe-link" href={`/recipes/${item.recipe.id}`}>
                {item.recipe?.name ?? "Recipe"}
              </Link>
            ) : (
              <span>{item.recipe?.name ?? "Recipe"}</span>
            )}
            {item.slot_type === "leftover" ? (
              <span className="plan-slot-sub">
                Leftover from{" "}
                {item.leftover_from_item_id && itemById.get(item.leftover_from_item_id)
                  ? formatDisplayDate(itemById.get(item.leftover_from_item_id)!.plan_date, { year: false })
                  : "earlier cook"}
              </span>
            ) : null}
          </div>
          <div className="plan-slot-actions">
            {item.slot_type === "cook" ? (
              <div className="serving-controls">
                <button aria-label="Fewer servings" className="text-btn" onClick={() => adjustServing(item, -0.25)} type="button">
                  −
                </button>
                <span>×{item.serving_multiplier}</span>
                <button aria-label="More servings" className="text-btn" onClick={() => adjustServing(item, 0.25)} type="button">
                  +
                </button>
              </div>
            ) : null}
            <button className="text-btn" onClick={() => removeItem(item.id)} type="button">
              remove
            </button>
          </div>
        </div>
      ))}

      {items.length === 0 ? (
        <div className="plan-slot empty">
          <span className="plan-slot-k">{MEAL_KEY[mealType]}</span>
          Add {mealType}
          <button
            aria-label={`Add ${mealType} on ${formatDisplayDate(day, { year: false })}`}
            className="plan-slot-add"
            onClick={() => openQuickAdd(day, mealType)}
            type="button"
          >
            +
          </button>
        </div>
      ) : (
        <div className="plan-slot-more">
          <button className="text-btn" onClick={() => openQuickAdd(day, mealType)} type="button">
            + add another {mealType} item
          </button>
        </div>
      )}

      {isActive ? (
        <div className="plan-quick-wrap">
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
                <p className="plan-slot-sub">
                  Enter adds · Shift+Enter adds and moves to the next day · Backspace on empty clears the slot
                </p>
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
        </div>
      ) : null}
    </>
  );
}
