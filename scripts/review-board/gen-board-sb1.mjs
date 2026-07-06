// Milestone 10 review board (round SB1): the Shop staleness banner, amber vs
// quiet-neutral, as a self-contained artifact page. Inlines the in-situ variant
// shots as base64. Redeploy in place to the existing board artifact URL.
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const SHOTS = path.join(DIR, "shots-shop");
const OUT = path.join(DIR, "review-board-m10.html");

const b64 = (f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(SHOTS, f)).toString("base64")}`;
const amber = b64("SB1-A-amber-context.jpg");
const neutral = b64("SB1-B-neutral-context.jpg");

const html = `<title>Meal Queue — Milestone 10 review</title>
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
  .wrap{max-width:760px;margin:0 auto;padding:2.6rem 1.25rem 4rem;}
  .eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--brand);margin:0 0 .55rem;}
  h1{font-size:1.9rem;font-weight:800;letter-spacing:-.02em;line-height:1.15;margin:0 0 .5rem;text-wrap:balance;}
  .lede{color:var(--muted);font-size:1.02rem;margin:0 0 1.4rem;max-width:60ch;}
  .meta{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-bottom:2.2rem;}
  .tag{font-size:.72rem;font-weight:700;letter-spacing:.02em;padding:.28rem .6rem;border-radius:999px;
    background:var(--brand-soft);color:var(--brand);}
  .tag.built{background:#e6f2ea;color:#1f6b3f;}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:16px;
    padding:1.5rem 1.5rem 1.7rem;box-shadow:0 1px 2px rgba(22,33,30,.04);}
  .pinrow{display:flex;align-items:center;gap:.7rem;margin-bottom:.9rem;}
  .pin{flex:none;font-size:.82rem;font-weight:800;letter-spacing:.02em;color:var(--accent-deep);
    background:var(--accent-soft);border:1px solid var(--accent);border-radius:8px;padding:.2rem .5rem;}
  .q{font-size:1.2rem;font-weight:800;letter-spacing:-.01em;margin:0;}
  .ctx{color:var(--muted);font-size:.96rem;margin:.2rem 0 1.4rem;max-width:62ch;}
  .variants{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;}
  @media(max-width:600px){.variants{grid-template-columns:1fr;}}
  .variant{display:flex;flex-direction:column;gap:.7rem;}
  .vhead{display:flex;align-items:baseline;gap:.5rem;}
  .vkey{font-weight:800;font-size:1rem;letter-spacing:-.01em;}
  .vkey .rec{font-size:.68rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
    color:var(--accent-deep);background:var(--accent-soft);border-radius:6px;padding:.1rem .4rem;margin-left:.15rem;}
  .vsub{color:var(--muted);font-size:.9rem;margin:0;}
  .shot{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--bg);}
  .shot img{display:block;width:100%;height:auto;}
  .reply{margin-top:1.7rem;padding:1rem 1.2rem;border-radius:12px;background:var(--slate);color:#f3f6f4;
    font-size:.95rem;}
  .reply b{color:#fff;}
  .reply code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:rgba(255,255,255,.12);
    padding:.08rem .4rem;border-radius:5px;font-size:.88em;}
  .foot{margin-top:2.4rem;border-top:1px solid var(--line);padding-top:1.4rem;color:var(--muted);font-size:.9rem;}
  .foot h2{font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);margin:0 0 .6rem;}
  .foot ul{margin:0;padding-left:1.1rem;}
  .foot li{margin:.3rem 0;}
  .foot b{color:var(--ink);}
</style>

<div class="wrap">
  <p class="eyebrow">Meal Queue · Review board</p>
  <h1>Milestone 10 — Shop staleness banner</h1>
  <p class="lede">The Shop page no longer regenerates your grocery list behind your back. When the meal plan has changed since the list was made, it now shows a banner you resolve yourself. One style call before this merges.</p>
  <div class="meta">
    <span class="tag">Round SB1</span>
    <span class="tag">2026-07-05</span>
    <span class="tag built">Code built &amp; verified · 22/22 harness</span>
  </div>

  <div class="card">
    <div class="pinrow">
      <span class="pin">SB1</span>
      <p class="q">Amber urgency, or quiet neutral?</p>
    </div>
    <p class="ctx">Same banner, same copy and button — only the color treatment differs. Amber makes the "your list is out of date" state announce itself; neutral lets it sit quietly in the page chrome. The list stays fully usable either way; nothing regenerates until you tap the button.</p>

    <div class="variants">
      <div class="variant">
        <div class="vhead"><span class="vkey">A — Amber<span class="rec">as built</span></span></div>
        <p class="vsub">Accent-soft fill, amber border, deep-amber action. Reads as a call to attention.</p>
        <div class="shot"><img alt="Shop page with an amber staleness banner above the grocery list" src="${amber}"></div>
      </div>
      <div class="variant">
        <div class="vhead"><span class="vkey">B — Quiet neutral</span></div>
        <p class="vsub">Muted-grey fill, hairline border, ink action. Blends into the surrounding chrome.</p>
        <div class="shot"><img alt="Shop page with a neutral grey staleness banner above the grocery list" src="${neutral}"></div>
      </div>
    </div>

    <div class="reply">
      <b>To decide:</b> reply with the pin code and your pick — e.g. <code>SB1: A</code> or <code>SB1: B</code>. Any tweak (border weight, button color) goes in the same line.
    </div>
  </div>

  <div class="foot">
    <h2>For context</h2>
    <ul>
      <li><b>Already locked</b> (not up for review): banner + explicit button, list stays usable, never auto-regenerates on load — your own decision from the plan.</li>
      <li><b>This gates the merge, not the build.</b> The code is written and passes the full local gate (typecheck, 138 tests, lint, build) plus a 22-assertion Shop harness proving no silent regeneration and that your checked items survive a plan-triggered update.</li>
      <li><b>Next after this:</b> PR 2 — optimistic writes (taps land instantly), no visual surface, no pins.</li>
    </ul>
  </div>
</div>
`;

fs.writeFileSync(OUT, html);
console.log("wrote", OUT, `(${Math.round(html.length / 1024)} KB)`);
