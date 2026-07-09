"use client";

import Link from "next/link";
import { formatDisplayDate } from "@/lib/date-utils";
import type { usePlan } from "@/lib/hooks/use-plan";

// The meals inside a Plan day card: one flat list per day (no lunch/dinner
// slots — owner decision, 2026-07-02 review) plus the add affordances. Adding a
// meal opens the full-screen PlanAddMeal takeover (owner feedback 2026-07-07);
// this component just triggers it via openQuickAdd. All state and writes come
// in as props from usePlan; this component owns no state.

type PlanDayItemsProps = Pick<
  ReturnType<typeof usePlan>,
  "items" | "itemById" | "removeItem" | "adjustServing" | "openQuickAdd"
> & {
  day: string;
};

export function PlanDayItems({
  day,
  items,
  itemById,
  removeItem,
  adjustServing,
  openQuickAdd,
}: PlanDayItemsProps) {
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
    </>
  );
}
