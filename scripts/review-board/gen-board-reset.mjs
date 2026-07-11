// Milestone 11 review board (round AR): password reset. AR1 is a link-placement
// A/B (the as-built sign-in screen collides the two text links); AR2 is a
// sign-off on the reset page. Self-contained artifact page, shots inlined as
// base64. Redeploy in place to the existing board artifact URL.
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const SHOTS = path.join(DIR, "shots-reset");
const OUT = path.join(DIR, "review-board-m11.html");

const b64 = (f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(SHOTS, f)).toString("base64")}`;
const aStacked = b64("AR1-A-stacked.jpg");
const bSpaced = b64("AR1-B-spaced-row.jpg");
const resetForm = b64("AR2a-reset-form.jpg");
const expired = b64("AR2b-expired.jpg");

const html = `<title>Meal Queue — Milestone 11 review</title>
<style>
  :root{
    --bg:#fafaf8; --surface:#ffffff; --ink:#16211e; --muted:#5e6b67;
    --brand:#12695e; --brand-soft:#e3eeeb; --line:#e4e6e1;
    --accent:#e8a13d; --accent-soft:#f6e8cf; --accent-deep:#7a5a17;
    --slate:#131a18;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    line-height:1.55;-webkit-font-smoothing:antialiased;}
  .wrap{max-width:780px;margin:0 auto;padding:2.6rem 1.25rem 4rem;}
  .eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--brand);margin:0 0 .55rem;}
  h1{font-size:1.9rem;font-weight:800;letter-spacing:-.02em;line-height:1.15;margin:0 0 .5rem;text-wrap:balance;}
  .lede{color:var(--muted);font-size:1.02rem;margin:0 0 1.4rem;max-width:62ch;}
  .meta{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-bottom:2.2rem;}
  .tag{font-size:.72rem;font-weight:700;letter-spacing:.02em;padding:.28rem .6rem;border-radius:999px;
    background:var(--brand-soft);color:var(--brand);}
  .tag.built{background:#e6f2ea;color:#1f6b3f;}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:16px;
    padding:1.5rem 1.5rem 1.7rem;box-shadow:0 1px 2px rgba(22,33,30,.04);margin-bottom:1.5rem;}
  .pinrow{display:flex;align-items:center;gap:.7rem;margin-bottom:.55rem;flex-wrap:wrap;}
  .pin{flex:none;font-size:.82rem;font-weight:800;letter-spacing:.02em;color:var(--accent-deep);
    background:var(--accent-soft);border:1px solid var(--accent);border-radius:8px;padding:.2rem .5rem;}
  .q{font-size:1.2rem;font-weight:800;letter-spacing:-.01em;margin:0;}
  .ctx{color:var(--muted);font-size:.96rem;margin:.2rem 0 1.4rem;max-width:64ch;}
  .variants{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;}
  @media(max-width:600px){.variants{grid-template-columns:1fr;}}
  .variant{display:flex;flex-direction:column;gap:.7rem;}
  .vhead{display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap;}
  .vkey{font-weight:800;font-size:1rem;letter-spacing:-.01em;}
  .vkey .rec{font-size:.68rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
    color:var(--accent-deep);background:var(--accent-soft);border-radius:6px;padding:.1rem .4rem;margin-left:.15rem;}
  .vsub{color:var(--muted);font-size:.9rem;margin:0;min-height:2.5em;}
  .shot{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--bg);}
  .shot img{display:block;width:100%;height:auto;}
  .reply{margin-top:1.4rem;padding:1rem 1.2rem;border-radius:12px;background:var(--slate);color:#f3f6f4;
    font-size:.95rem;}
  .reply b{color:#fff;}
  .reply code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:rgba(255,255,255,.12);
    padding:.08rem .4rem;border-radius:5px;font-size:.88em;}
  .foot{margin-top:2rem;border-top:1px solid var(--line);padding-top:1.4rem;color:var(--muted);font-size:.9rem;}
  .foot h2{font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);margin:0 0 .6rem;}
  .foot ul{margin:0;padding-left:1.1rem;}
  .foot li{margin:.35rem 0;}
  .foot b{color:var(--ink);}
</style>

<div class="wrap">
  <p class="eyebrow">Meal Queue · Review board</p>
  <h1>Milestone 11 — Password reset</h1>
  <p class="lede">A "Forgot password?" link on the sign-in screen sends a reset email; the link opens a new page where you pick a new password. Built and verified end to end. Two things to sign off before it merges.</p>
  <div class="meta">
    <span class="tag">Round AR</span>
    <span class="tag">2026-07-06</span>
    <span class="tag built">Code built &amp; verified · 25/25 harness</span>
  </div>

  <div class="card">
    <div class="pinrow">
      <span class="pin">AR1</span>
      <p class="q">Where do the two sign-in links sit?</p>
    </div>
    <p class="ctx">The sign-in screen now has two text links under the button: the account toggle and the new "Forgot password?". As first built they collide on one line, so this needs a call. Same links, same colour, only the arrangement differs.</p>
    <div class="variants">
      <div class="variant">
        <div class="vhead"><span class="vkey">A — Stacked<span class="rec">recommended</span></span></div>
        <p class="vsub">Each link on its own line, left-aligned with the rest of the panel.</p>
        <div class="shot"><img alt="Sign-in screen with the two links stacked vertically, left-aligned" src="${aStacked}"></div>
      </div>
      <div class="variant">
        <div class="vhead"><span class="vkey">B — Spaced row</span></div>
        <p class="vsub">Both on one line: account toggle left, "Forgot password?" pushed right.</p>
        <div class="shot"><img alt="Sign-in screen with the two links on one row, spaced to opposite edges" src="${bSpaced}"></div>
      </div>
    </div>
    <div class="reply">
      <b>To decide:</b> reply <code>AR1: A</code> or <code>AR1: B</code> (any tweak on the same line).
    </div>
  </div>

  <div class="card">
    <div class="pinrow">
      <span class="pin">AR2</span>
      <p class="q">The reset page — good to ship?</p>
    </div>
    <p class="ctx">Where the email link lands. Left: the new-password form (shown when the recovery link is valid). Right: what a stale or already-used link shows instead. Copy and controls reuse the existing auth panel — nothing new invented.</p>
    <div class="variants">
      <div class="variant">
        <div class="vhead"><span class="vkey">Set a new password</span></div>
        <p class="vsub">New + confirm fields, full-width teal save. Mismatched entries block with "Passwords don't match."</p>
        <div class="shot"><img alt="Reset page showing the choose-a-new-password form" src="${resetForm}"></div>
      </div>
      <div class="variant">
        <div class="vhead"><span class="vkey">Expired / invalid link</span></div>
        <p class="vsub">A used or bad link explains itself and routes back, rather than a raw error.</p>
        <div class="shot"><img alt="Reset page showing the expired-link state" src="${expired}"></div>
      </div>
    </div>
    <div class="reply">
      <b>To decide:</b> reply <code>AR2: ok</code> to ship as-is, or name a tweak (heading, copy, spacing).
    </div>
  </div>

  <div class="foot">
    <h2>For context</h2>
    <ul>
      <li><b>Already locked</b> (not up for review): scope is password reset only (no sign-up confirmation, no magic links), and the flow itself — "Forgot password?" &rarr; email &rarr; reset page &rarr; sign in. Your decisions from the plan.</li>
      <li><b>This gates the merge, not the build.</b> Code passes the full local gate (typecheck, 138 unit tests, lint, 13-route build) plus a 25-assertion reset harness — including a real recovery email landing in the local mailbox, wrong-password rejection, and old-vs-new password checks.</li>
      <li><b>Still needs you (separate from these pins):</b> add the two <b>/reset-password redirect URLs</b> in the Supabase dashboard (prod + localhost) before live testing, then one real reset on your iPhone in Safari after deploy.</li>
      <li><b>Known + accepted:</b> on the phone the email link opens in the default browser, not the installed app — you reset there, then sign in inside the app.</li>
    </ul>
  </div>
</div>
`;

fs.writeFileSync(OUT, html);
console.log("wrote", OUT, `(${Math.round(html.length / 1024)} KB)`);
