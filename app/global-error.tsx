"use client";

// Catches errors thrown by the root layout itself. Bare-bones by design:
// globals.css may not have loaded, so styles are inlined.
export default function GlobalError({ reset }: { reset: () => void }) {
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
