"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { createDefaultsFromStart, dateRange, formatDisplayDate } from "@/lib/date-utils";
import { StatusMessage } from "@/components/status-message";
import { usePlan } from "@/lib/hooks/use-plan";

function formatWeekday(ymd: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date(`${ymd}T00:00:00`));
}

function formatShortDate(ymd: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${ymd}T00:00:00`));
}

export default function PlansPage() {
  return (
    <AuthGate>
      {(session) => <PlansScreen userId={session.user.id} userEmail={session.user.email} />}
    </AuthGate>
  );
}

function PlansScreen({ userId, userEmail }: { userId: string; userEmail?: string }) {
  const {
    visiblePlans,
    selectedPlan,
    selectedPlanId,
    selectPlan,
    itemMap,
    itemById,
    createForm,
    setCreateForm,
    selectedForm,
    setSelectedForm,
    settingsDefaults,
    planFilter,
    setPlanFilter,
    activeSlot,
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
    upsertPlanSlot,
    removeItem,
    adjustServing,
    openQuickAdd,
    handleQuickAddKeyDown,
  } = usePlan(userId);

  return (
    <AppShell userEmail={userEmail}>
      <section className="plans-page-stack">
        <section className="panel">
          <h2>Create plan</h2>
          <form className="stack" onSubmit={createPlan}>
            <label>
              Start date
              <input
                required
                type="date"
                value={createForm.start_date}
                onChange={(event) => {
                  const startDate = event.target.value;
                  setCreateForm(createDefaultsFromStart(startDate, settingsDefaults));
                }}
              />
            </label>
            <label>
              End date
              <input
                required
                type="date"
                value={createForm.end_date}
                onChange={(event) => setCreateForm((current) => ({ ...current, end_date: event.target.value }))}
              />
            </label>
            <label>
              Order date
              <input
                type="date"
                value={createForm.order_date}
                onChange={(event) => setCreateForm((current) => ({ ...current, order_date: event.target.value }))}
              />
            </label>
            <label>
              Pickup date
              <input
                type="date"
                value={createForm.pickup_date}
                onChange={(event) => setCreateForm((current) => ({ ...current, pickup_date: event.target.value }))}
              />
            </label>
            <button className="primary-btn" disabled={saving} type="submit">
              {saving ? "Saving..." : "Create meal plan"}
            </button>
          </form>
        </section>

        <section className="panel">
          <div className="section-head">
            <h3>Plans</h3>
            <div className="section-actions">
              <button
                className={planFilter === "current" ? "pill active" : "pill"}
                onClick={() => setPlanFilter("current")}
                type="button"
              >
                Current
              </button>
              <button
                className={planFilter === "upcoming" ? "pill active" : "pill"}
                onClick={() => setPlanFilter("upcoming")}
                type="button"
              >
                Upcoming
              </button>
              <button className={planFilter === "past" ? "pill active" : "pill"} onClick={() => setPlanFilter("past")} type="button">
                Past
              </button>
              <button className={planFilter === "all" ? "pill active" : "pill"} onClick={() => setPlanFilter("all")} type="button">
                All
              </button>
            </div>
          </div>
          {loading ? <p>Loading...</p> : null}
          <div className="list">
            {visiblePlans.map((plan) => (
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
            {!loading && visiblePlans.length === 0 ? <p>No plans in this view yet.</p> : null}
          </div>
        </section>

        <section className="panel">
          {!selectedPlan ? (
            <p>Select or create a plan.</p>
          ) : (
            <div className="stack">
              <div className="section-head">
                <h2>
                  Plan: {formatDisplayDate(selectedPlan.start_date)} to {formatDisplayDate(selectedPlan.end_date)}
                </h2>
                <div className="section-actions">
                  <button className="secondary-btn" disabled={saving} onClick={savePlanMeta} type="button">
                    Save dates
                  </button>
                  <button className="danger-btn" disabled={saving} onClick={deleteSelectedPlan} type="button">
                    Delete plan
                  </button>
                </div>
              </div>

              <div className="plan-meta-grid">
                <label>
                  Start
                  <input
                    type="date"
                    value={selectedForm.start_date}
                    onChange={(event) => setSelectedForm((current) => ({ ...current, start_date: event.target.value }))}
                  />
                </label>
                <label>
                  End
                  <input
                    type="date"
                    value={selectedForm.end_date}
                    onChange={(event) => setSelectedForm((current) => ({ ...current, end_date: event.target.value }))}
                  />
                </label>
                <label>
                  Order
                  <input
                    type="date"
                    value={selectedForm.order_date}
                    onChange={(event) => setSelectedForm((current) => ({ ...current, order_date: event.target.value }))}
                  />
                </label>
                <label>
                  Pickup
                  <input
                    type="date"
                    value={selectedForm.pickup_date}
                    onChange={(event) => setSelectedForm((current) => ({ ...current, pickup_date: event.target.value }))}
                  />
                </label>
              </div>

              <p className="muted">
                Quick add: choose mode (cook, leftovers, or eating out). For cook mode, type recipe and press `Enter`.
                Use `Shift+Enter` to add and move to next day. `Backspace/Delete` on empty query clears the slot.
              </p>

              <div className="plan-grid">
                <div className="plan-grid-head">Date</div>
                <div className="plan-grid-head">Lunch</div>
                <div className="plan-grid-head">Dinner</div>
                {dateRange(selectedForm.start_date, selectedForm.end_date).map((day) => {
                  const lunchItems = itemMap.get(`${day}:lunch`) ?? [];
                  const dinnerItems = itemMap.get(`${day}:dinner`) ?? [];
                  return (
                    <div className="plan-grid-row" key={day}>
                      <div className="plan-day-cell">
                        <strong className="plan-day-primary">{formatWeekday(day)}</strong>
                        <span className="plan-day-secondary">{formatShortDate(day)}</span>
                      </div>
                      <div className="plan-slot-cell">
                        {activeSlot?.day === day && activeSlot.meal_type === "lunch" ? (
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
                                        upsertPlanSlot(day, "lunch", { slotType: "cook", recipeId: recipe.id, servingMultiplier: 1 })
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
                                      upsertPlanSlot(day, "lunch", {
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
                                  placeholder="Optional note (e.g. sushi)"
                                  value={quickNote}
                                  onChange={(event) => setQuickNote(event.target.value)}
                                  onKeyDown={handleQuickAddKeyDown}
                                />
                                <button
                                  className="secondary-btn"
                                  onClick={() =>
                                    upsertPlanSlot(day, "lunch", {
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
                        {lunchItems.length > 0 ? (
                          <>
                            {lunchItems.map((lunch) => (
                              <div className="slot-card" key={lunch.id}>
                                {lunch.slot_type === "eat_out" ? (
                                  <strong>{lunch.note?.trim() || "Eating out"}</strong>
                                ) : (
                                  <>
                                    {lunch.recipe?.id ? (
                                      <Link className="recipe-link" href={`/recipes/${lunch.recipe.id}`}>
                                        {lunch.recipe?.name ?? "Recipe"}
                                      </Link>
                                    ) : (
                                      <strong>{lunch.recipe?.name ?? "Recipe"}</strong>
                                    )}
                                    {lunch.slot_type === "leftover" ? (
                                      <span>
                                        Leftover from{" "}
                                        {lunch.leftover_from_item_id && itemById.get(lunch.leftover_from_item_id)
                                          ? formatDisplayDate(itemById.get(lunch.leftover_from_item_id)!.plan_date)
                                          : "earlier cook"}
                                      </span>
                                    ) : null}
                                  </>
                                )}
                                {lunch.slot_type === "cook" ? (
                                  <div className="serving-controls">
                                    <button className="text-btn" onClick={() => adjustServing(lunch, -0.25)} type="button">
                                      -
                                    </button>
                                    <span>x {lunch.serving_multiplier}</span>
                                    <button className="text-btn" onClick={() => adjustServing(lunch, 0.25)} type="button">
                                      +
                                    </button>
                                  </div>
                                ) : null}
                                <button className="text-btn" onClick={() => removeItem(lunch.id)} type="button">
                                  Remove
                                </button>
                              </div>
                            ))}
                            <button className="secondary-btn" onClick={() => openQuickAdd(day, "lunch")} type="button">
                              Add another lunch recipe
                            </button>
                          </>
                        ) : (
                          <button className="secondary-btn" onClick={() => openQuickAdd(day, "lunch")} type="button">
                            Add lunch
                          </button>
                        )}
                      </div>
                      <div className="plan-slot-cell">
                        {activeSlot?.day === day && activeSlot.meal_type === "dinner" ? (
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
                                        upsertPlanSlot(day, "dinner", { slotType: "cook", recipeId: recipe.id, servingMultiplier: 1 })
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
                                      upsertPlanSlot(day, "dinner", {
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
                                  placeholder="Optional note (e.g. date night)"
                                  value={quickNote}
                                  onChange={(event) => setQuickNote(event.target.value)}
                                  onKeyDown={handleQuickAddKeyDown}
                                />
                                <button
                                  className="secondary-btn"
                                  onClick={() =>
                                    upsertPlanSlot(day, "dinner", {
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
                        {dinnerItems.length > 0 ? (
                          <>
                            {dinnerItems.map((dinner) => (
                              <div className="slot-card" key={dinner.id}>
                                {dinner.slot_type === "eat_out" ? (
                                  <strong>{dinner.note?.trim() || "Eating out"}</strong>
                                ) : (
                                  <>
                                    {dinner.recipe?.id ? (
                                      <Link className="recipe-link" href={`/recipes/${dinner.recipe.id}`}>
                                        {dinner.recipe?.name ?? "Recipe"}
                                      </Link>
                                    ) : (
                                      <strong>{dinner.recipe?.name ?? "Recipe"}</strong>
                                    )}
                                    {dinner.slot_type === "leftover" ? (
                                      <span>
                                        Leftover from{" "}
                                        {dinner.leftover_from_item_id && itemById.get(dinner.leftover_from_item_id)
                                          ? formatDisplayDate(itemById.get(dinner.leftover_from_item_id)!.plan_date)
                                          : "earlier cook"}
                                      </span>
                                    ) : null}
                                  </>
                                )}
                                {dinner.slot_type === "cook" ? (
                                  <div className="serving-controls">
                                    <button className="text-btn" onClick={() => adjustServing(dinner, -0.25)} type="button">
                                      -
                                    </button>
                                    <span>x {dinner.serving_multiplier}</span>
                                    <button className="text-btn" onClick={() => adjustServing(dinner, 0.25)} type="button">
                                      +
                                    </button>
                                  </div>
                                ) : null}
                                <button className="text-btn" onClick={() => removeItem(dinner.id)} type="button">
                                  Remove
                                </button>
                              </div>
                            ))}
                            <button className="secondary-btn" onClick={() => openQuickAdd(day, "dinner")} type="button">
                              Add another dinner recipe
                            </button>
                          </>
                        ) : (
                          <button className="secondary-btn" onClick={() => openQuickAdd(day, "dinner")} type="button">
                            Add dinner
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <StatusMessage error={error} message={message} />
        </section>
      </section>
    </AppShell>
  );
}
