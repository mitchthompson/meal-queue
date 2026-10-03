// Milestone 17 review board (round WS): four style calls for weekday suggestions
// and "Add the usuals", as a self-contained artifact page. Inlines the variant
// shots from shots-ws/ (mocks on the real app) as base64, plus an "As built"
// section from shots-ws-verify/ once the verification harness has written it.
// Clone of gen-board-sb1.mjs (same page style and pin language). The first M17
// board is a NEW artifact; later M17 rounds redeploy to that same URL.
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const SHOTS = path.join(DIR, "shots-ws");
const BUILT_DIR = path.join(DIR, "shots-ws-verify"); // written by verify-weekday-suggestions.mjs
const OUT = path.join(DIR, "review-board-m17.html");

const shotPath = (name) => path.join(SHOTS, `${name}.jpg`);
const b64From = (dir, name) => `data:image/jpeg;base64,${fs.readFileSync(path.join(dir, `${name}.jpg`)).toString("base64")}`;
const b64 = (name) => b64From(SHOTS, name);

// The capture date is the newest shot's modified date (local calendar day).
const capturedAt = new Date(
  Math.max(
    ...["WS1-A-thu", "WS1-B-thu", "WS1-A-fri", "WS1-B-fri", "WS2-A", "WS2-B", "WS2-C", "WS3-A-card", "WS3-B", "WS3-B-card", "WS4-A", "WS4-B"].map(
      (name) => fs.statSync(shotPath(name)).mtimeMs,
    ),
  ),
);
const captured = `${capturedAt.getFullYear()}-${String(capturedAt.getMonth() + 1).padStart(2, "0")}-${String(capturedAt.getDate()).padStart(2, "0")}`;

const shot = (name, alt) => `<div class="shot"><img alt="${alt}" src="${b64(name)}"></div>`;

const variant = ({ key, title, recommended, sub, shots }) => `
      <div class="variant">
        <div class="vhead"><span class="vkey">${key}: ${title}${recommended ? '<span class="rec">recommended</span>' : ""}</span></div>
        ${sub ? `<p class="vsub">${sub}</p>` : ""}
        <div class="shots">
          ${shots.join("\n          ")}
        </div>
      </div>`;

const pinCard = ({ pin, question, context, variants, three = false }) => `
  <div class="card">
    <div class="pinrow">
      <span class="pin">${pin}</span>
      <p class="q">${question}</p>
    </div>
    <p class="ctx">${context}</p>

    <div class="variants${three ? " three" : ""}">${variants.join("")}
    </div>
  </div>
`;

const ws1 = pinCard({
  pin: "WS1",
  question: "How should the usuals look in the add screen?",
  context:
    "Shown for Thursday (one usual) and Friday (two that take turns). The usuals sit between the search box and the regular list, and the list below drops them so nothing shows twice. Typing in the search box hides the group.",
  variants: [
    variant({
      key: "A",
      title: "Labeled list",
      recommended: true,
      sub: "Same rows as the search results, under a small day-style label.",
      shots: [
        shot("WS1-A-thu", "Add-meal screen for Thursday with a labeled list holding one usual recipe"),
        shot("WS1-A-fri", "Add-meal screen for Friday with a labeled list holding two usual recipes"),
      ],
    }),
    variant({
      key: "B",
      title: "Soft teal panel",
      sub: "The same rows inside a tinted panel, so the group reads as one unit.",
      shots: [
        shot("WS1-B-thu", "Add-meal screen for Thursday with one usual recipe inside a soft teal panel"),
        shot("WS1-B-fri", "Add-meal screen for Friday with two usual recipes inside a soft teal panel"),
      ],
    }),
  ],
});

const ws2 = pinCard({
  pin: "WS2",
  question: "Where should Add the usuals live on the Plan page?",
  context: "It only appears when it would add at least one meal, and it disappears once the empty days are filled.",
  three: true,
  variants: [
    variant({
      key: "A",
      title: "Card above the first day",
      recommended: true,
      shots: [shot("WS2-A", "Plan page with the Add the usuals card above the first day")],
    }),
    variant({
      key: "B",
      title: "Button in the header",
      sub: "Next to Edit and New plan. No room to show what it will add.",
      shots: [shot("WS2-B", "Plan page with an Add the usuals button in the header next to Edit and New plan")],
    }),
    variant({
      key: "C",
      title: "Card at the bottom",
      sub: "Just above Shop this plan, after you scroll the week.",
      shots: [shot("WS2-C", "Bottom of the Plan page with the Add the usuals card just above Shop this plan")],
    }),
  ],
});

const ws3 = pinCard({
  pin: "WS3",
  question: "How should the card look?",
  context: "The line counts the empty days it will fill and names each meal, so nothing lands unseen.",
  variants: [
    variant({
      key: "A",
      title: "Card with a soft teal button",
      recommended: true,
      sub: "The same language as the next-step card on Today.",
      shots: [
        shot("WS3-A-card", "Close-up of the usuals card with a soft teal Add the usuals button"),
        shot("WS2-A", "Plan page with the soft teal usuals card above the first day"),
      ],
    }),
    variant({
      key: "B",
      title: "Full-width teal button",
      sub: "Louder, and it competes with Shop this plan.",
      shots: [
        shot("WS3-B-card", "Close-up of the usuals line with a full-width teal Add the usuals button"),
        shot("WS3-B", "Plan page with the full-width teal Add the usuals button above the first day"),
      ],
    }),
  ],
});

const ws4 = pinCard({
  pin: "WS4",
  question: "What should you see after tapping it?",
  context: "Shown after it filled three empty days.",
  variants: [
    variant({
      key: "A",
      title: "Green status line at the top",
      recommended: true,
      sub: "The same confirmation every other plan action uses.",
      shots: [shot("WS4-A", "Plan page with a green Added 3 usual meals line near the top")],
    }),
    variant({
      key: "B",
      title: "Confirmation in place of the card",
      sub: "Where your thumb already is. Needs a little extra code.",
      shots: [shot("WS4-B", "Plan page with the Added 3 usual meals confirmation where the card was")],
    }),
  ],
});

// "As built" (no pins): the real screens, written by the verification harness.
// Shown only when shots-ws-verify/ exists; once it does, every shot must be there.
const BUILT_SHOTS = [
  ["H1-thu-group", "Thursday: the usual sits under the search box and the list below drops it.", "Add-meal screen for Thursday as built, with the usual above the list"],
  ["H2-fri-group", "Friday: two usuals that take turns, salmon first because cod was cooked last.", "Add-meal screen for Friday as built, with two usuals above the list"],
  ["H3-card", "Plan page: the card counts the empty days and names each meal before you tap.", "Plan page as built, with the Add the usuals card above the first day"],
  ["H4-after-usuals", "After the tap: the meals are on the plan and the green line counts them.", "Plan page as built after Add the usuals, with the green status line"],
  ["H5-shop-update", "Shop: the plan changed, so it offers Update list and nothing regenerates by itself.", "Shop page as built, with the Update list banner"],
];

const asBuilt = (() => {
  if (!fs.existsSync(BUILT_DIR)) return "";
  const missing = BUILT_SHOTS.filter(([name]) => !fs.existsSync(path.join(BUILT_DIR, `${name}.jpg`)));
  if (missing.length) {
    throw new Error(`shots-ws-verify is missing ${missing.map(([name]) => `${name}.jpg`).join(", ")}; run verify-weekday-suggestions.mjs first`);
  }
  const figures = BUILT_SHOTS.map(
    ([name, caption, alt]) =>
      `<figure class="built-shot"><div class="shot"><img alt="${alt}" src="${b64From(BUILT_DIR, name)}"></div><figcaption>${caption}</figcaption></figure>`,
  );
  return `
  <div class="card built">
    <h2>As built</h2>
    <div class="built-grid">${figures.join("\n      ")}
    </div>
  </div>
`;
})();

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Meal Queue M17 review</title>
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
  .wrap{max-width:920px;margin:0 auto;padding:2.6rem 1.25rem 4rem;}
  .eyebrow{font-size:.72rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--brand);margin:0 0 .55rem;}
  h1{font-size:1.9rem;font-weight:800;letter-spacing:-.02em;line-height:1.15;margin:0 0 .5rem;text-wrap:balance;}
  .lede{color:var(--muted);font-size:1.02rem;margin:0 0 1.4rem;max-width:60ch;}
  .meta{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-bottom:2.2rem;}
  .tag{font-size:.72rem;font-weight:700;letter-spacing:.02em;padding:.28rem .6rem;border-radius:999px;
    background:var(--brand-soft);color:var(--brand);}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:16px;
    padding:1.5rem 1.5rem 1.7rem;box-shadow:0 1px 2px rgba(22,33,30,.04);}
  .card + .card{margin-top:1.6rem;}
  .pinrow{display:flex;align-items:center;gap:.7rem;margin-bottom:.9rem;}
  .pin{flex:none;font-size:.82rem;font-weight:800;letter-spacing:.02em;color:var(--accent-deep);
    background:var(--accent-soft);border:1px solid var(--accent);border-radius:8px;padding:.2rem .5rem;}
  .q{font-size:1.2rem;font-weight:800;letter-spacing:-.01em;margin:0;}
  .ctx{color:var(--muted);font-size:.96rem;margin:.2rem 0 1.4rem;max-width:62ch;}
  .variants{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem;}
  .variants.three{grid-template-columns:1fr 1fr 1fr;}
  .built h2{font-size:1.2rem;font-weight:800;letter-spacing:-.01em;margin:0 0 1rem;}
  .built-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.25rem;align-items:start;}
  .built-shot{margin:0;display:flex;flex-direction:column;gap:.5rem;min-width:0;}
  .built-shot figcaption{color:var(--muted);font-size:.88rem;}
  @media(max-width:600px){.variants,.variants.three,.built-grid{grid-template-columns:1fr;}}
  .variant{display:flex;flex-direction:column;gap:.7rem;min-width:0;}
  .vhead{display:flex;align-items:baseline;gap:.5rem;}
  .vkey{font-weight:800;font-size:1rem;letter-spacing:-.01em;}
  .vkey .rec{font-size:.68rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
    color:var(--accent-deep);background:var(--accent-soft);border-radius:6px;padding:.1rem .4rem;margin-left:.45rem;}
  .vsub{color:var(--muted);font-size:.9rem;margin:0;}
  .shots{margin-top:auto;display:flex;flex-direction:column;gap:.7rem;}
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
  <h1>Milestone 17: weekday suggestions</h1>
  <p class="lede">Adding a meal now suggests what you usually cook on that weekday, and the Plan page has a one-tap Add the usuals. All four style calls were set to A before the build, and the as-built shots come first. The variant mocks stay below in case you want to switch a pin. Every shot uses a seeded test history: chicken every Thursday, beans most Sundays, and two fish taking turns on Fridays.</p>
  <div class="meta">
    <span class="tag">Round WS</span>
    <span class="tag">${captured}</span>
    <span class="tag">Built to WS1-WS4: A</span>
  </div>
${asBuilt}${ws1}${ws2}${ws3}${ws4}
  <div class="reply">
    <b>To switch a pin:</b> reply with its code and letter, for example <code>WS1: B</code>. Wording changes go on the same line.
  </div>

  <div class="foot">
    <h2>For context</h2>
    <ul>
      <li><b>Already locked:</b> the habit rule (cooked on that weekday in at least 3 of the last 8 times that weekday was planned), both features, no database changes.</li>
      <li>Habits look back 16 weeks and skip weeks with nothing planned, so a vacation does not erase Thursday chicken.</li>
      <li><b>Verified:</b> the as-built shots come from the real screens, and the milestone 17 harness passed 45 of 45 checks.</li>
    </ul>
  </div>
</div>
`;

fs.writeFileSync(OUT, html);
console.log("wrote", OUT, `(${Math.round(html.length / 1024)} KB)`);
