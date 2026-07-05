// Root not-found boundary (milestone 9). Rendered for unmatched routes and by
// notFound() (e.g. a bad /recipes/[id]). Server component — no "use client",
// no reset. Same panel structure as app/error.tsx; a plain <a> full-reloads.
export default function NotFound() {
  return (
    <main className="shell">
      <section className="hero error-boundary-panel">
        <p className="eyebrow">Meal Queue</p>
        <h1>That page doesn&#39;t exist</h1>
        <p className="muted">Check the address, or head back to your week.</p>
        <div className="error-boundary-actions">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- plain anchor by design (matches error.tsx); a full reload from a 404 is fine */}
          <a className="primary-btn" href="/">
            Go to Today
          </a>
        </div>
      </section>
    </main>
  );
}
