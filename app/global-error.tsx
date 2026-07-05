"use client";

import { useEffect } from "react";

// Catches errors thrown by the root layout itself. Bare-bones by design:
// globals.css may not have loaded, so styles are inlined. Still logs the error
// (like app/error.tsx) so a root-layout crash leaves a breadcrumb.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem 1.5rem" }}>
        <h1>Something went wrong</h1>
        <p>The app hit an unexpected error. Your data is safe.</p>
        <button onClick={reset} type="button">Try again</button>
      </body>
    </html>
  );
}
