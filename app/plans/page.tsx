"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { PlanDayItems } from "@/components/plan-day-items";
import { createDefaultsFromStart, dateRange, formatDayAbbrev, formatDisplayDate, toYmd } from "@/lib/date-utils";
import { StatusMessage } from "@/components/status-message";
import { usePlan } from "@/lib/hooks/use-plan";
import type { PlanListFilter } from "@/lib/hooks/use-plan";

const FILTER_LABELS: Array<{ value: PlanListFilter; label: string }> = [
  { value: "current", label: "Current" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
];

export default function PlansPage() {
  return (
    <AuthGate>
      {(session) => <PlanScreen userId={session.user.id} />}
    </AuthGate>
  );
}

function PlanScreen({ userId }: { userId: string }) {
  const {
    visiblePlans,
    selectedPlan,
    selectedPlanId,
    selectPlan,
    items,
    itemById,
    createForm,
    setCreateForm,
    selectedForm,
    setSelectedForm,
    settingsDefaults,
    planFilter,
    setPlanFilter,
    activeDay,
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
    addMeal,
    removeItem,
    adjustServing,
    openQuickAdd,
    handleQuickAddKeyDown,
  } = usePlan(userId);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const today = toYmd(new Date());

  // Close the sheets whenever the working plan changes — creating a plan
  // selects it, so this also dismisses the create sheet on success.
  useEffect(() => {
    setShowCreate(false);
    setShowEdit(false);
  }, [selectedPlanId]);

  const dayItemsShared = {
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
  };

  return (
    <AppShell>
      <div className="page-col">
        <section className="plan-head">
          <h1>Plan</h1>
          <div className="plan-head-meta">
            {selectedPlan ? (
              <span className="plan-range">
                {formatDisplayDate(selectedPlan.start_date, { year: false })} – {formatDisplayDate(selectedPlan.end_date, { year: false })}
              </span>
            ) : null}
            {selectedPlan ? (
              <button
                className="ghost-btn"
                onClick={() => {
                  setShowEdit((current) => !current);
                  setShowCreate(false);
                }}
                type="button"
              >
                {showEdit ? "Close" : "Edit"}
              </button>
            ) : null}
            <button
              className="ghost-btn"
              onClick={() => {
                setShowCreate((current) => !current);
                setShowEdit(false);
              }}
              type="button"
            >
              {showCreate ? "Close" : "New plan"}
            </button>
          </div>
        </section>

        <div className="plan-filter-row">
          {FILTER_LABELS.map((filter) => (
            <button
              className={clsx("pill", planFilter === filter.value && "active")}
              key={filter.value}
              onClick={() => setPlanFilter(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>

        {visiblePlans.length > 1 ? (
          <div className="plan-picker-row">
            <select onChange={(event) => selectPlan(event.target.value)} value={selectedPlanId ?? ""}>
              {visiblePlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {formatDisplayDate(plan.start_date)} to {formatDisplayDate(plan.end_date)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <StatusMessage error={error} message={message} />
        {loading ? <p className="muted">Loading...</p> : null}
        {!loading && visiblePlans.length === 0 && !showCreate ? (
          <p className="muted">No plans in this view yet — create one to start the week.</p>
        ) : null}

        {showCreate ? (
          <section className="panel plan-sheet">
            <h2>New plan</h2>
            <form className="stack" onSubmit={createPlan}>
              <div className="plan-sheet-grid">
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
              </div>
              <button className="primary-btn" disabled={saving} type="submit">
                {saving ? "Saving..." : "Create meal plan"}
              </button>
            </form>
          </section>
        ) : null}

        {showEdit && selectedPlan ? (
          <section className="panel plan-sheet">
            <h2>Edit plan</h2>
            <div className="stack">
              <div className="plan-sheet-grid">
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
              <div className="section-actions">
                <button className="secondary-btn" disabled={saving} onClick={savePlanMeta} type="button">
                  Save dates
                </button>
                <button className="danger-btn" disabled={saving} onClick={deleteSelectedPlan} type="button">
                  Delete plan
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {selectedPlan
          ? dateRange(selectedForm.start_date, selectedForm.end_date).map((day) => {
              const isToday = day === today;
              return (
                <div className={clsx("plan-dayrow", isToday && "today")} key={day}>
                  <div className="plan-dhead">
                    <span>
                      {formatDayAbbrev(day)}
                      {isToday ? " · today" : ""}
                    </span>
                    <span>{formatDisplayDate(day, { year: false })}</span>
                  </div>
                  <PlanDayItems day={day} {...dayItemsShared} />
                </div>
              );
            })
          : null}

        {selectedPlan ? (
          <Link className="plan-generate" href="/grocery">
            Generate grocery list
          </Link>
        ) : null}
      </div>
    </AppShell>
  );
}
