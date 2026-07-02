"use client";

import Link from "next/link";
import { formatDisplayDate } from "@/lib/date-utils";
import type { usePlan } from "@/lib/hooks/use-plan";

// The meals inside a Plan day card: one flat list per day (no lunch/dinner
// slots — owner decision, 2026-07-02 review), the quick-add card when this
// day is active, and the add affordances. All state and writes come in as
// props from usePlan; this component owns no state.

type PlanDayItemsProps = Pick<
  ReturnType<typeof usePlan>,
  | "items"
  | "itemById"
  | "activeDay"
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
  | "addMeal"
  | "removeItem"
  | "adjustServing"
  | "openQuickAdd"
> & {
  day: string;
};

export function PlanDayItems({
  day,
  items,
  itemById,
  activeDay,
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
  addMeal,
  removeItem,
  adjustServing,
  openQuickAdd,
}: PlanDayItemsProps) {
  const isActive = activeDay === day;
  const dayItems = items.filter((item) => item.plan_date === day);

  return (
    <>
      {dayItems.map((item) => (
        <div className="plan-slot" key={item.id}>
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

      {dayItems.length === 0 ? (
        <div className="plan-slot empty">
          Nothing planned
          <button
            aria-label={`Add a meal on ${formatDisplayDate(day, { year: false })}`}
            className="plan-slot-add"
            onClick={() => openQuickAdd(day)}
            type="button"
          >
            +
          </button>
        </div>
      ) : (
        <div className="plan-slot-more">
          <button className="text-btn" onClick={() => openQuickAdd(day)} type="button">
            + add another meal
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
                <div className="quick-add-results">
                  {quickMatches.map((recipe) => (
                    <button
                      className="quick-add-row"
                      key={recipe.id}
                      onClick={() => addMeal(day, { slotType: "cook", recipeId: recipe.id, servingMultiplier: 1 })}
                      type="button"
                    >
                      <span>{recipe.name}</span>
                      <span className="muted">Serves {recipe.base_servings}</span>
                    </button>
                  ))}
                </div>
                <p className="plan-slot-sub quick-add-hint">
                  Enter adds the top match · Shift+Enter adds and jumps to the next day
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
                      {formatDisplayDate(option.plan_date)}: {option.recipe_name}
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
                      addMeal(day, {
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
                  placeholder="Optional note (e.g. pizza night)"
                  value={quickNote}
                  onChange={(event) => setQuickNote(event.target.value)}
                  onKeyDown={handleQuickAddKeyDown}
                />
                <button
                  className="secondary-btn"
                  onClick={() => addMeal(day, { slotType: "eat_out", note: quickNote || "Eating out", servingMultiplier: 1 })}
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
