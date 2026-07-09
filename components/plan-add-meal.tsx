"use client";

import { useEffect, useRef } from "react";
import { formatDisplayDate } from "@/lib/date-utils";
import type { usePlan } from "@/lib/hooks/use-plan";

// Full-screen takeover for adding a meal to a plan day. Replaces the former
// inline quick-add card (which, on iOS, let the keyboard shift the viewport and
// reflow the long day list — owner feedback 2026-07-07). Rendered once at the
// page level and driven by `activeDay`; a fixed overlay above the tabbar means
// the page behind never moves when the keyboard opens.
//
// It owns no state — the quick-add state machine stays in usePlan; this is a
// new container around the same props PlanDayItems used to render inline.

type PlanAddMealProps = Pick<
  ReturnType<typeof usePlan>,
  | "activeDay"
  | "setActiveDay"
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
>;

export function PlanAddMeal({
  activeDay,
  setActiveDay,
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
}: PlanAddMealProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lock the page scroll while the takeover is open (same as Cook mode), close
  // on Escape, and trap Tab focus inside the dialog — the overlay is opaque, so
  // focus must not reach the (still-mounted) controls behind it. All key on
  // activeDay so they attach only while a day is active.
  useEffect(() => {
    if (!activeDay) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveDay(null);
        return;
      }
      if (event.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!root.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDay, setActiveDay]);

  if (!activeDay) return null;

  const close = () => setActiveDay(null);

  return (
    <div
      aria-label={`Add a meal on ${formatDisplayDate(activeDay, { year: false })}`}
      aria-modal="true"
      className="plan-add-meal"
      ref={dialogRef}
      role="dialog"
    >
      <div className="plan-add-head">
        <button className="plan-add-close" onClick={close} type="button">
          ✕ Close
        </button>
        <span className="plan-add-day">Add to {formatDisplayDate(activeDay, { year: false })}</span>
      </div>

      <div className="plan-add-body">
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
                  onClick={() => addMeal(activeDay, { slotType: "cook", recipeId: recipe.id, servingMultiplier: 1 })}
                  type="button"
                >
                  <span>{recipe.name}</span>
                  <span className="muted">Serves {recipe.base_servings}</span>
                </button>
              ))}
              {quickMatches.length === 0 ? (
                <p className="plan-slot-sub">No recipes match. Try a different search.</p>
              ) : null}
            </div>
            <p className="plan-slot-sub quick-add-hint">
              Enter adds the top match · Shift+Enter adds and jumps to the next day
            </p>
          </>
        ) : null}

        {quickMode === "leftover" ? (
          <>
            <select value={quickLeftoverId} onChange={(event) => setQuickLeftoverId(event.target.value)}>
              {quickLeftoverOptions.length === 0 ? <option value="">No prior cooked meals</option> : null}
              {quickLeftoverOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {formatDisplayDate(option.plan_date)}: {option.recipe_name}
                </option>
              ))}
            </select>
            <button
              className="secondary-btn"
              disabled={quickLeftoverOptions.length === 0}
              onClick={() => {
                const choice =
                  quickLeftoverOptions.find((option) => option.id === quickLeftoverId) ?? quickLeftoverOptions[0];
                if (!choice) return;
                addMeal(activeDay, {
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
              onClick={() => addMeal(activeDay, { slotType: "eat_out", note: quickNote || "Eating out", servingMultiplier: 1 })}
              type="button"
            >
              Save eating out
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
