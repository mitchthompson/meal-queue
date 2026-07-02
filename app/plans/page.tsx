"use client";

import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { PlanSlotCell } from "@/components/plan-slot-cell";
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

  const slotCellShared = {
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
  };

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
                      <PlanSlotCell day={day} items={lunchItems} mealType="lunch" {...slotCellShared} />
                      <PlanSlotCell day={day} items={dinnerItems} mealType="dinner" {...slotCellShared} />
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
