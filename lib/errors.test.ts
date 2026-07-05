import { describe, expect, it } from "vitest";
import { toAuthErrorMessage, toErrorMessage } from "./errors";

const AUTH_FALLBACK = "Sign-in failed. Check your email and password, then try again.";

describe("toAuthErrorMessage", () => {
  it("maps invalid credentials to a friendly line", () => {
    expect(toAuthErrorMessage({ message: "Invalid login credentials" })).toBe("Wrong email or password.");
  });

  it("maps an unconfirmed email", () => {
    expect(toAuthErrorMessage({ message: "Email not confirmed" })).toBe(
      "This email hasn't been confirmed yet. Check your inbox.",
    );
  });

  it("maps an already-registered email", () => {
    expect(toAuthErrorMessage({ message: "User already registered" })).toBe(
      "An account with this email already exists. Sign in instead.",
    );
  });

  it("falls back generically for an unmapped message", () => {
    expect(toAuthErrorMessage({ message: "Network request failed" })).toBe(AUTH_FALLBACK);
  });

  it("falls back generically for a non-object throw", () => {
    expect(toAuthErrorMessage("boom")).toBe(AUTH_FALLBACK);
  });

  it("falls back generically for null", () => {
    expect(toAuthErrorMessage(null)).toBe(AUTH_FALLBACK);
  });
});

describe("toErrorMessage", () => {
  it("passes through our own P0001 trigger messages verbatim", () => {
    expect(
      toErrorMessage({ code: "P0001", message: "This day is outside the plan's saved dates." }, "fallback"),
    ).toBe("This day is outside the plan's saved dates.");
  });

  it("maps a known permission code to its friendly line", () => {
    expect(toErrorMessage({ code: "42501", message: "permission denied for table" }, "fallback")).toBe(
      "You don't have permission to do that.",
    );
  });

  it("surfaces an unmapped message rather than hiding it", () => {
    expect(toErrorMessage({ message: "raw supabase detail" }, "fallback")).toBe("raw supabase detail");
  });

  it("uses the caller's fallback when there is no code or message", () => {
    expect(toErrorMessage(null, "Failed to load.")).toBe("Failed to load.");
  });
});
