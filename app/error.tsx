"use client";

import { useEffect } from "react";

// Route-level error boundary (milestone 9). Renders INSTEAD of the page tree,
// so it must not depend on AppShell/AuthGate (the crash may be inside them).
// A plain <a> (not next/link) makes "Go to Today" a full reload, which also
// resets whatever client state caused the crash.
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error boundary:", error);
  }, [error]);

  return (
    <main className="shell">
      <section className="hero error-boundary-panel">
        <p className="eyebrow">Meal Queue</p>
        <h1>Something went wrong</h1>
        <p className="muted">The app hit an unexpected error. Your data is safe.</p>
        <div className="error-boundary-actions">
          <button className="primary-btn" onClick={reset} type="button">
            Try again
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional full reload: resets the client state that tripped the boundary */}
          <a className="secondary-btn" href="/">
            Go to Today
          </a>
        </div>
      </section>
    </main>
  );
}
