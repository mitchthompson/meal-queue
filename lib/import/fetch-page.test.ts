import { describe, expect, it } from "vitest";
import { assertSafeUrl, detectPaywall } from "./fetch-page";

describe("assertSafeUrl", () => {
  const allowed = [
    "https://cooking.nytimes.com/recipes/1",
    "http://budgetbytes.com/x",
    "https://example.co.uk/r",
    "https://8.8.8.8/r", // public IP is fine
  ];
  it.each(allowed)("allows %s", (url) => {
    expect(() => assertSafeUrl(url)).not.toThrow();
  });

  const blocked = [
    "ftp://example.com/x",
    "https://localhost/x",
    "http://localhost:3000/x",
    "https://foo.local/x",
    "https://svc.internal/x",
    "https://intranet/x", // no-dot bare name
    "http://127.0.0.1/x",
    "http://10.0.0.5/x",
    "http://172.16.0.1/x",
    "http://192.168.1.1/x",
    "http://169.254.1.1/x",
    "http://0.0.0.0/x",
    "http://[::1]/x",
    "http://[fe80::1]/x",
    "http://[fea0::1]/x", // fe80::/10 spans fe80–febf
    "http://[fc00::1]/x",
    "http://[::ffff:127.0.0.1]/x", // IPv4-mapped IPv6 loopback
    "http://[::ffff:169.254.169.254]/x", // IPv4-mapped IPv6 metadata
    "http://localhost./x", // FQDN root
    "http://127.0.0.1./x", // FQDN root, IP literal
    "not a url",
  ];
  it.each(blocked)("blocks %s", (url) => {
    expect(() => assertSafeUrl(url)).toThrow();
  });
});

describe("detectPaywall", () => {
  it("flags short extracted text on a large page (branch 1)", () => {
    expect(detectPaywall("x".repeat(60_000), "tiny")).toBe(true);
  });

  it("flags paywall phrasing in the extracted text (branch 2)", () => {
    expect(
      detectPaywall(
        "<html></html>",
        "Please subscribe to continue reading this recipe.",
      ),
    ).toBe(true);
  });

  it("does not flag ordinary recipe content (branch 3)", () => {
    expect(
      detectPaywall(
        "<html></html>",
        "Preheat the oven to 400F and roast the vegetables. ".repeat(20),
      ),
    ).toBe(false);
  });
});
