// Announced status/error line for form and action feedback. Errors use
// role="alert" (assertive), successes role="status" (polite), so screen
// readers announce them without stealing focus — the milestone 5 feedback
// pattern. Styling stays on the existing token-driven classes.
export function StatusMessage({ error, message }: { error?: string | null; message?: string | null }) {
  if (error) {
    return (
      <p className="error-text" role="alert">
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <p className="success-text" role="status" aria-live="polite">
        {message}
      </p>
    );
  }
  return null;
}
