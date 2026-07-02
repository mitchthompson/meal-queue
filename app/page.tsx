"use client";

import Link from "next/link";
import { AppShell, NavIcon } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";
import { formatDayAbbrev, formatDisplayDate, formatLongDate, formatRelativeDay } from "@/lib/date-utils";
import { formatAmount } from "@/lib/grocery";
import { StatusMessage } from "@/components/status-message";
import { useToday } from "@/lib/hooks/use-today";
import type { TodayItem } from "@/lib/hooks/use-today";

export default function TodayPage() {
  return (
    <AuthGate>
      {(session) => <TodayScreen userEmail={session.user.email} />}
    </AuthGate>
  );
}

function itemLabel(item: TodayItem) {
  if (item.slot_type === "eat_out") return item.note ? `Eating out — ${item.note}` : "Eating out";
  const name = item.recipe?.name ?? "Recipe";
  return item.slot_type === "leftover" ? `Leftovers: ${name}` : name;
}

function TodayScreen({ userEmail }: { userEmail?: string }) {
  const {
    currentPlan,
    nextPlan,
    heroItem,
    alsoTonight,
    tonightMoreCount,
    heroStepCount,
    weekRows,
    uncheckedCount,
    today,
    loading,
    error,
  } = useToday();

  const heroServes =
    heroItem?.slot_type === "cook" && heroItem.recipe
      ? formatAmount(Number(heroItem.recipe.base_servings) * Number(heroItem.serving_multiplier))
      : null;

  const orderRelevant =
    currentPlan?.order_date && currentPlan.order_date >= today ? currentPlan.order_date : null;
  const pickupRelevant =
    currentPlan?.pickup_date && currentPlan.pickup_date >= today ? currentPlan.pickup_date : null;

  const relativeDay = (ymd: string) => formatRelativeDay(ymd, today);

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-col">
      <section className="today-head">
        <h1>Today</h1>
        <div className="today-head-meta">
          <span className="today-date">{formatLongDate(today)}</span>
          <Link aria-label="Settings" className="today-settings" href="/settings" title="Settings">
            <NavIcon name="settings" />
          </Link>
        </div>
      </section>

      <StatusMessage error={error} />
      {loading ? <p className="muted">Loading...</p> : null}

      {!loading && currentPlan ? (
        <>
          {heroItem ? (
            <article className="tonight-card">
              <span className="tonight-label">Tonight</span>
              <h2>{itemLabel(heroItem)}</h2>
              <span className="tonight-meta">
                {heroServes ? `Serves ${heroServes}` : null}
                {heroServes && heroStepCount ? " · " : null}
                {heroStepCount ? `${heroStepCount} step${heroStepCount === 1 ? "" : "s"}` : null}
                {(heroServes || heroStepCount) && currentPlan ? " · " : null}
                {`planned ${formatDisplayDate(currentPlan.start_date, { year: false })} – ${formatDisplayDate(currentPlan.end_date, { year: false })}`}
              </span>
              {alsoTonight ? (
                <span className="tonight-meta">
                  Also tonight: {itemLabel(alsoTonight)}
                  {tonightMoreCount > 0 ? ` · +${tonightMoreCount} more` : ""}
                </span>
              ) : null}
              {heroItem.slot_type === "cook" && heroItem.recipe ? (
                <Link className="tonight-btn" href={`/recipes/${heroItem.recipe.id}?cook=1`}>
                  Start cooking →
                </Link>
              ) : null}
              {heroItem.slot_type === "leftover" && heroItem.recipe ? (
                <Link className="tonight-btn" href={`/recipes/${heroItem.recipe.id}`}>
                  View recipe
                </Link>
              ) : null}
            </article>
          ) : (
            <article className="tonight-card tonight-card-empty">
              <span className="tonight-label">Tonight</span>
              <h2>Nothing planned tonight</h2>
              <Link className="tonight-btn" href="/plans">
                Open the plan
              </Link>
            </article>
          )}

          {orderRelevant || pickupRelevant ? (
            <Link className="today-strip" href="/grocery">
              <span className="today-strip-dot" />
              <span>
                {orderRelevant ? `Grocery order due ${relativeDay(orderRelevant)}` : `Pickup ${relativeDay(pickupRelevant ?? "")}`}
                <small>
                  {uncheckedCount != null
                    ? `${uncheckedCount} item${uncheckedCount === 1 ? "" : "s"} still unchecked`
                    : "Open the list"}
                  {orderRelevant && pickupRelevant ? ` · pickup ${relativeDay(pickupRelevant)}` : ""}
                </small>
              </span>
            </Link>
          ) : null}

          <article className="card today-week">
            <span className="today-card-label">This week</span>
            {weekRows.length === 0 ? <p className="muted">The plan has ended.</p> : null}
            {weekRows.map((row) => (
              <div className="today-week-row" key={row.day}>
                <span className="today-week-day">{formatDayAbbrev(row.day)}</span>
                {row.items.length === 0 ? (
                  <>
                    <span className="today-week-meal today-week-empty">Nothing planned</span>
                    <Link className="today-pill" href="/plans">
                      plan →
                    </Link>
                  </>
                ) : (
                  <span className="today-week-meal">
                    {row.items.map((item) => (
                      <span className="today-week-item" key={item.id}>
                        {itemLabel(item)}
                        {item.slot_type === "leftover" ? <span className="today-pill today-pill-warm">leftover</span> : null}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            ))}
          </article>

          <article className="card today-next">
            <div>
              <span className="today-card-label">Next week</span>
              <div className="today-next-line">
                {nextPlan
                  ? `Plan starts ${formatLongDate(nextPlan.start_date)}`
                  : "Nothing planned yet"}
              </div>
            </div>
            <Link className="today-next-btn" href="/plans">
              {nextPlan ? "Open plan" : "Plan it"}
            </Link>
          </article>
        </>
      ) : null}

      {!loading && !currentPlan ? (
        <>
          <article className="tonight-card tonight-card-empty">
            <span className="tonight-label">No meal plan</span>
            <h2>Plan your week to get started</h2>
            <span className="tonight-meta">
              Pick recipes for the week, then generate the grocery list from the plan.
            </span>
            <Link className="tonight-btn" href="/plans">
              Plan the week
            </Link>
          </article>
          <article className="card today-next">
            <div>
              <span className="today-card-label">Recipes</span>
              <div className="today-next-line">Browse or add recipes first</div>
            </div>
            <Link className="today-next-btn" href="/recipes">
              Open recipes
            </Link>
          </article>
        </>
      ) : null}
      </div>
    </AppShell>
  );
}
