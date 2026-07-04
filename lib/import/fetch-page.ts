// Server-side fetch of an open recipe URL. Request headers are ported from
// mcp/src/tools/fetch-recipe-url.ts (2026-07); mcp/ stays a separate consumer.
import { importError } from "./errors";

function isIpLiteral(host: string): boolean {
  let h = host;
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;
  return h.includes(":"); // IPv6 literal
}

function isPrivateIp(host: string): boolean {
  let h = host;
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);

  if (h.includes(":")) {
    const lower = h.toLowerCase();
    if (lower === "::1" || lower === "::") return true; // loopback / unspecified
    if (lower.startsWith("fe80:")) return true; // link-local fe80::/10
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7
    return false;
  }

  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = Number(m[3]);
  const d = Number(m[4]);
  if (a === 127) return true; // 127/8 loopback
  if (a === 10) return true; // 10/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 169 && b === 254) return true; // 169.254/16 link-local
  if (a === 0 && b === 0 && c === 0 && d === 0) return true; // 0.0.0.0
  return false;
}

// SSRF guard for the URL branch. DNS-rebinding defense is deliberately out of
// scope: this is an auth-gated, single-household app with no privileged
// Vercel-internal network to reach. Throws fetch_failed on any rejection so the
// user just sees "check the URL, or paste the text instead".
export function assertSafeUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw importError("fetch_failed");
  }
  const proto = parsed.protocol.toLowerCase();
  if (proto !== "http:" && proto !== "https:") throw importError("fetch_failed");

  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    throw importError("fetch_failed");
  }
  // Reject no-dot bare names ("intranet") that aren't IP literals.
  if (!host.includes(".") && !isIpLiteral(host)) throw importError("fetch_failed");
  if (isPrivateIp(host)) throw importError("fetch_failed");
}

const PAYWALL_RE =
  /subscri(be|ption)|log in to continue|create a free account|already a subscriber/i;

// Heuristic paywall detection on the text-fallback path (never on JSON-LD).
// Takes the extracted text (not just its length) so it can scan the first 1500
// chars for paywall phrasing, per §B7. (Plan listed the param as
// `extractedTextLen: number`, which cannot satisfy the phrase-scan clause —
// widened to the text itself; flagged in docs/design-flags.md.)
export function detectPaywall(
  html: string,
  extractedText: string,
  hasJsonLd: boolean,
): boolean {
  if (hasJsonLd) return false;
  if (extractedText.length < 400 && html.length > 50_000) return true;
  return PAYWALL_RE.test(extractedText.slice(0, 1500));
}

const CHROME_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

const MAX_BYTES = 3 * 1024 * 1024; // 3MB cap

async function readCapped(response: Response, cap: number): Promise<string> {
  const body = response.body;
  if (!body) {
    const text = await response.text();
    return text.length > cap ? text.slice(0, cap) : text;
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let html = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (received >= cap) break;
    }
    html += decoder.decode();
  } finally {
    try {
      await reader.cancel();
    } catch {
      // best effort
    }
  }
  return html;
}

export async function fetchRecipePage(
  url: string,
): Promise<{ html: string; finalUrl: string }> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: CHROME_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw importError("fetch_failed"); // network error or timeout
  }

  if (response.status === 401 || response.status === 403) {
    throw importError("paywall_or_blocked");
  }
  if (!response.ok) {
    throw importError("fetch_failed");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
    throw importError("no_recipe_found");
  }

  let html: string;
  try {
    html = await readCapped(response, MAX_BYTES);
  } catch {
    throw importError("fetch_failed");
  }

  // Cloudflare interstitials return a challenge body rather than the page.
  if (
    /cf-browser-verification|Checking your browser before|Just a moment\.\.\./i.test(
      html.slice(0, 4000),
    )
  ) {
    throw importError("paywall_or_blocked");
  }

  return { html, finalUrl: response.url || url };
}
