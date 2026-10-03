// Milestone 18 review board (pins AS1 and AS2): the steps note and Today's cook
// button label, as a self-contained artifact page. Inlines the shots in
// shots-amounts/ as base64. W1 (wake lock) is answered, so it has no card.
// Once the as-built shots exist, an "As built" card is added (Phase 7); they
// live in two directories, see AS_BUILT below.
// Output: review-board-m18.html (gitignored by the review-board*.html rule).
// Redeploy a same-review round in place; a distinct review gets its own artifact.
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const SHOTS = path.join(DIR, "shots-amounts");
// verify-detail-pass.mjs writes its AB-detail-*.jpg as-built shots here, not to shots-amounts/.
const SHOTS_V2 = path.join(DIR, "shots-v2");
const OUT = path.join(DIR, "review-board-m18.html");

const dataUri = (file) => `data:image/jpeg;base64,${fs.readFileSync(file).toString("base64")}`;
const b64 = (f) => {
  const file = path.join(SHOTS, f);
  if (!fs.existsSync(file)) throw new Error(`missing ${file}: run capture-amounts-variants.mjs first`);
  return dataUri(file);
};
const as1Base = b64("AS1-base.jpg");
const as1A = b64("AS1-A.jpg");
const as1B = b64("AS1-B.jpg");
const as2A = b64("AS2-A.jpg");
const as2B = b64("AS2-B.jpg");

// As built (Phase 7). The card renders only when all three shots exist, so the
// same generator makes the pre-build board and the post-build board. Two shots
// come from verify-detail-pass.mjs (shots-v2/), one from verify-amounts-pass.mjs
// (shots-amounts/).
const AS_BUILT = [
  {
    dir: SHOTS_V2,
    file: "AB-detail-steps.jpg",
    key: "Steps at base servings",
    sub: "Preview servings at the recipe's own 2, so no note shows above the steps.",
    alt: "Recipe page scrolled to the steps at base servings, with no note",
  },
  {
    dir: SHOTS_V2,
    file: "AB-detail-scaled.jpg",
    key: "Preview servings changed",
    sub: "Preview servings nudged up from 2: the quiet note shows above the steps.",
    alt: "Recipe page with the quiet steps note shown after the servings changed",
  },
  {
    dir: SHOTS,
    file: "AB-today.jpg",
    key: "Today's cook hero",
    sub: "The button still says Start cooking and now opens the plain recipe page.",
    alt: "Today with tonight's hero and the Start cooking button",
  },
].map((s) => ({ ...s, abs: path.join(s.dir, s.file) }));
const asBuiltMissing = AS_BUILT.filter((s) => !fs.existsSync(s.abs));
if (asBuiltMissing.length > 0) {
  const names = asBuiltMissing.map((s) => `${path.basename(s.dir)}/${s.file}`).join(", ");
  console.log(`as-built card skipped, missing: ${names}`);
}
// One script makes the pre-build and the post-build board, so the chip follows
// the state: it changes exactly when the as-built card renders.
const statusChip =
  asBuiltMissing.length > 0 ? "Pre-decided: AS1 A, AS2 A, building now" : "Built to AS1: A, AS2: A";
const lede = asBuiltMissing.length
  ? "Cook mode is retired and each step now carries the amounts it uses. Two small style calls are left, one on the recipe page and one on Today. Both already have an answer, so the build is under way. Reply with a pin code only if you want to change one."
  : "Cook mode is retired and each step now carries the amounts it uses. Both style calls were answered A, and the as-built shots below come from the real screens. Reply with a pin code only if you want to change one.";
const answeredLine = asBuiltMissing.length
  ? "<li><b>Both calls above are answered</b>, so the build started before this board went out. A reply only changes a style or a label, which is a small edit.</li>"
  : "<li><b>Both calls above are answered and built.</b> A reply only changes a style or a label, which is a small edit.</li>";
const asBuiltHtml =
  asBuiltMissing.length > 0
    ? ""
    : `
  <div class="card" id="as-built">
    <div class="pinrow">
      <p class="q">As built</p>
    </div>
    <p class="ctx">Captured from the built app on the local stack, using the seeded Lemon Chicken Thighs. Its steps are still the plain seed text here, because the amounts arrive with the backfill.</p>

    <div class="variants" style="--n:3">
${AS_BUILT.map(
  (s) => `      <div class="variant">
        <div class="vhead"><span class="vkey">${s.key}</span></div>
        <p class="vsub">${s.sub}</p>
        <div class="shot"><img alt="${s.alt}" src="${dataUri(s.abs)}"></div>
      </div>`,
).join("\n")}
    </div>
  </div>
`;

// Dark-mode token values, written once and used by both dark selectors.
const DARK_TOKENS = `
    --bg:#131a18; --surface:#1d2724; --ink:#f3f6f4; --muted:#9fb0aa;
    --brand:#6cc3b4; --brand-soft:#1d332f; --line:#2a3733;
    --accent:#e8a13d; --accent-soft:#3b2e14; --accent-deep:#f2c97d;
    --ok-bg:#1c3326; --ok-ink:#86d6a4;
    --reply-bg:#0c1110; --reply-ink:#f3f6f4; --reply-chip:rgba(255,255,255,.14);
`;

const html = `<title>Meal Queue M18 review</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root{
    --bg:#fafaf8; --surface:#ffffff; --ink:#16211e; --muted:#5e6b67;
    --brand:#12695e; --brand-soft:#e3eeeb; --line:#e4e6e1;
    --accent:#e8a13d; --accent-soft:#f6e8cf; --accent-deep:#7a5a17;
    --ok-bg:#e6f2ea; --ok-ink:#1f6b3f;
    --reply-bg:#131a18; --reply-ink:#f3f6f4; --reply-chip:rgba(255,255,255,.12);
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){${DARK_TOKENS}}
  }
  :root[data-theme="dark"]{${DARK_TOKENS}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    line-height:1.55;-webkit-font-smoothing:antialiased;}
  .wrap{max-width:1040px;margin:0 auto;padding:2.6rem 1.25rem 4rem;}
  .eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--brand);margin:0 0 .55rem;}
  h1{font-size:1.9rem;font-weight:800;letter-spacing:-.02em;line-height:1.15;margin:0 0 .5rem;text-wrap:balance;}
  .lede{color:var(--muted);font-size:1.02rem;margin:0 0 1.4rem;max-width:62ch;}
  .meta{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-bottom:2.2rem;}
  .tag{font-size:.72rem;font-weight:700;letter-spacing:.02em;padding:.28rem .6rem;border-radius:999px;
    background:var(--brand-soft);color:var(--brand);}
  .tag.decided{background:var(--ok-bg);color:var(--ok-ink);}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:16px;
    padding:1.5rem 1.5rem 1.7rem;}
  .card + .card{margin-top:1.6rem;}
  .pinrow{display:flex;align-items:flex-start;gap:.7rem;margin-bottom:.9rem;}
  .pin{flex:none;font-size:.82rem;font-weight:800;letter-spacing:.02em;color:var(--accent-deep);
    background:var(--accent-soft);border:1px solid var(--accent);border-radius:8px;padding:.2rem .5rem;}
  .q{font-size:1.2rem;font-weight:800;letter-spacing:-.01em;margin:0;}
  .ctx{color:var(--muted);font-size:.96rem;margin:.2rem 0 1.4rem;max-width:68ch;}
  .variants{display:grid;grid-template-columns:repeat(var(--n,2),minmax(0,1fr));gap:1.25rem;}
  @media(max-width:700px){.variants{grid-template-columns:1fr;}}
  .variant{display:flex;flex-direction:column;gap:.7rem;min-width:0;}
  .vhead{display:flex;align-items:baseline;gap:.5rem;}
  .vkey{font-weight:800;font-size:1rem;letter-spacing:-.01em;}
  .vkey .rec{font-size:.68rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
    color:var(--accent-deep);background:var(--accent-soft);border-radius:6px;padding:.1rem .4rem;margin-left:.4rem;}
  .vsub{color:var(--muted);font-size:.9rem;margin:0;}
  .shot{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--bg);}
  .shot img{display:block;width:100%;height:auto;}
  .reply{margin-top:1.7rem;padding:1rem 1.2rem;border-radius:12px;background:var(--reply-bg);color:var(--reply-ink);
    font-size:.95rem;}
  .reply b{color:var(--reply-ink);}
  .reply code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--reply-chip);
    padding:.08rem .4rem;border-radius:5px;font-size:.88em;}
  .foot{margin-top:2.4rem;border-top:1px solid var(--line);padding-top:1.4rem;color:var(--muted);font-size:.9rem;}
  .foot h2{font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);margin:0 0 .6rem;}
  .foot ul{margin:0;padding-left:1.1rem;}
  .foot li{margin:.3rem 0;}
  .foot b{color:var(--ink);}
  @media(max-width:600px){
    .wrap{padding:1.6rem 16px 3rem;}
    .card{padding:1.1rem 1rem 1.3rem;}
    h1{font-size:1.55rem;}
  }
</style>

<div class="wrap">
  <p class="eyebrow">Meal Queue · Review board</p>
  <h1>Milestone 18: amounts in the steps</h1>
  <p class="lede">${lede}</p>
  <div class="meta">
    <span class="tag">Milestone 18</span>
    <span class="tag">2026-10-03</span>
    <span class="tag decided">${statusChip}</span>
  </div>

  <div class="card" id="AS1">
    <div class="pinrow">
      <span class="pin">AS1</span>
      <p class="q">When you preview a different number of servings, how should the Steps card say the step amounts stay at the recipe's base servings?</p>
    </div>
    <p class="ctx">Amounts written into the steps are plain text, so they do not scale when you change Preview servings. Only the ingredient list does. The note appears at the top of the Steps card only while Preview servings differs from the base, and reads "Amounts in the steps are for 2 servings." These shots use Lemon Chicken Thighs with its steps as they will read after the backfill, and Preview servings set to 4.</p>

    <div class="variants" style="--n:3">
      <div class="variant">
        <div class="vhead"><span class="vkey">At base servings</span></div>
        <p class="vsub">Preview servings stays at 2, so there is no note to show.</p>
        <div class="shot"><img alt="Recipe page at base servings, steps with amounts and no note" src="${as1Base}"></div>
      </div>
      <div class="variant">
        <div class="vhead"><span class="vkey">A: Quiet muted line<span class="rec">recommended</span></span></div>
        <p class="vsub">A muted line under the Steps label, in the same quiet type as the helper text elsewhere. An FYI that only matters once servings change.</p>
        <div class="shot"><img alt="Recipe page at 4 servings with a quiet muted note above the steps" src="${as1A}"></div>
      </div>
      <div class="variant">
        <div class="vhead"><span class="vkey">B: Amber callout</span></div>
        <p class="vsub">An amber callout in the palette of the Shop stale banner and the import paywall. It reads as a warning, which is louder than an FYI needs to be.</p>
        <div class="shot"><img alt="Recipe page at 4 servings with an amber callout above the steps" src="${as1B}"></div>
      </div>
    </div>

    <div class="reply">
      <b>Pre-decided: A.</b> To switch, reply with <code>AS1: B</code>. Any tweak to the copy goes in the same line.
    </div>
  </div>

  <div class="card" id="AS2">
    <div class="pinrow">
      <span class="pin">AS2</span>
      <p class="q">Today's cook button now opens the recipe page. Keep its label?</p>
    </div>
    <p class="ctx">Tonight's cook hero used to open the step-by-step cook screen. With cook mode retired, the button opens the recipe page, where every step carries its amounts. Only the label differs between the two shots.</p>

    <div class="variants" style="--n:2">
      <div class="variant">
        <div class="vhead"><span class="vkey">A: Start cooking →<span class="rec">recommended</span></span></div>
        <p class="vsub">Keeps the label you already tap. The recipe page is where cooking happens now.</p>
        <div class="shot"><img alt="Today with tonight's hero and a Start cooking button" src="${as2A}"></div>
      </div>
      <div class="variant">
        <div class="vhead"><span class="vkey">B: View recipe</span></div>
        <p class="vsub">Matches the leftovers hero, which already says View recipe.</p>
        <div class="shot"><img alt="Today with tonight's hero and a View recipe button" src="${as2B}"></div>
      </div>
    </div>

    <div class="reply">
      <b>Pre-decided: A.</b> To switch, reply with <code>AS2: B</code>.
    </div>
  </div>
${asBuiltHtml}
  <div class="foot">
    <h2>For context</h2>
    <ul>
      <li><b>Already locked</b> (not up for review): amounts live in the step text, not in a structured link, and they do not scale with the stepper. Cook mode is retired, and its screen and styles are deleted.</li>
      ${answeredLine}
      <li><b>Next after this:</b> a one-time backfill that writes amounts into your existing recipes. You review every proposal before anything is written.</li>
    </ul>
  </div>
</div>
`;

fs.writeFileSync(OUT, html);
console.log("wrote", OUT, `(${Math.round(html.length / 1024)} KB)`);
