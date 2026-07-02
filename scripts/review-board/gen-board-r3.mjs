// Round-3 review board (v2 sweep, part 2 cont.): Recipes library + editor
// direction mocks. Visual system inherited from gen-board-r2.mjs; deployed
// in place at the same artifact URL as rounds 1–2.
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const SHOTS = path.join(DIR, "shots-v2");
const img64 = (f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(SHOTS, f)).toString("base64")}`;

function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function phone(file, title, opts = {}) {
  const cls = opts.wide ? "frame wide" : "frame";
  return `<figure class="${cls}"><div class="screen"><img src="${img64(file)}" alt="${esc(title)}" loading="lazy"></div><figcaption>${esc(title)}</figcaption></figure>`;
}

function card(code, title, shipped, ask, extra = "") {
  return `<article class="card proposal" id="${code}">
    <div class="card-head"><span class="pin-badge">${code}</span><h4>${title}</h4></div>
    <p class="shipped">${shipped}</p>
    <p class="ask">${ask}</p>${extra}
  </article>`;
}

const html = `<title>Meal Queue — Reflow Review Board</title>
<style>
  :root{--bg:#fafaf8;--surface:#fff;--ink:#16211e;--muted:#5e6b67;--line:#e4e6e1;--brand:#12695e;--brand-soft:#e3eeeb;--amber:#e8a13d;--amber-soft:#fdf3e3}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1060px;margin:0 auto;padding:40px 20px 80px}
  header.top{margin-bottom:14px}
  .eyebrow{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--brand)}
  h1{font-size:clamp(26px,4vw,34px);line-height:1.15;margin:6px 0 8px;letter-spacing:-.02em;text-wrap:balance}
  .sub{color:var(--muted);max-width:62ch;margin:0}
  .howto{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:22px 0 8px;display:grid;gap:10px}
  .howto p{margin:0;max-width:none}
  .howto .reply{background:var(--brand-soft);border-radius:10px;padding:10px 14px;font-weight:600;color:#0d4f47}
  .howto .reply code{font:600 14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:transparent}
  section.screen-sec{margin-top:44px;border-top:1px solid var(--line);padding-top:26px}
  section.screen-sec>h2{font-size:22px;margin:2px 0 4px;letter-spacing:-.01em}
  section.screen-sec>.lede{color:var(--muted);margin:0 0 18px;max-width:70ch}
  .shots{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start;margin:0 0 18px}
  .frame{margin:0;width:min(330px,100%)}
  .frame.wide{width:min(720px,100%)}
  .verdict{background:var(--brand-soft);color:#0d4f47;border-radius:8px;padding:7px 10px;font-size:13.5px!important;font-weight:600;margin-top:2px}
  .screen{position:relative;border:1px solid var(--line);border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 1px 2px rgb(22 33 30 / .05),0 8px 24px rgb(22 33 30 / .06)}
  .screen img{display:block;width:100%;height:auto}
  figcaption{font-size:13px;color:var(--muted);margin-top:8px;padding-left:2px}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
  .card-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .card-head h4{margin:0;font-size:15.5px;letter-spacing:-.01em}
  .pin-badge{background:var(--amber);color:#231a08;font:700 12px/1 -apple-system,BlinkMacSystemFont,sans-serif;border-radius:8px;padding:4px 7px;flex-shrink:0}
  .card p{margin:0 0 8px;font-size:14.5px}
  .shipped{color:var(--ink)}
  .shipped::before{content:"Shipped default — ";font-weight:650;color:var(--brand)}
  .proposal .shipped::before{content:"Proposal — ";color:#a06413}
  .ask{color:var(--muted)}
  .ask::before{content:"Your call — ";font-weight:650;color:#a06413}
  .round{border-top:3px solid var(--amber)!important}
  .index{margin-top:48px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px 20px}
  .index h3{margin:0 0 10px;font-size:16px}
  .index table{border-collapse:collapse;width:100%;font-size:14px}
  .index td{padding:5px 10px 5px 0;vertical-align:top;border-top:1px solid var(--line)}
  .index tr:first-child td{border-top:none}
  .index td:first-child{font:700 12.5px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;color:#a06413;white-space:nowrap}
  .dim td{color:var(--muted)}
  .foot{color:var(--muted);font-size:13.5px;margin-top:26px;max-width:72ch}
  @media (max-width:700px){.wrap{padding:24px 14px 60px}.shots{gap:16px}}
</style>
<div class="wrap">
<header class="top">
  <div class="eyebrow">Meal Queue · V2 Sweep · 2 Jul 2026</div>
  <h1>Review board — round 3: Recipes library + editor</h1>
  <p class="sub">All round-3 verdicts are in (2 Jul: RC1 A without the serves line, RC3 remove outright, RC4 A; RC2/RC5 rode along with the A mocks). <strong>The pass is built per those verdicts and sitting on <code>codex/v2-recipes</code> with the as-built shots below — awaiting your merge word.</strong> The mocks it was built from are preserved underneath.</p>
</header>

<div class="howto">
  <p><strong>How to give feedback:</strong> reply in chat using the pin codes — anything here can still be overturned before (or after) merge.</p>
  <p class="reply"><code>RC: merge it · or e.g. “cards: tighter” / “save: back to fit-content”</code></p>
  <p><strong>What happens next:</strong> your merge word ships the Recipes pass; then recipe detail opens the same way (mocks → verdicts → build) and closes out milestone 7.</p>
</div>

<section class="screen-sec round">
  <h2>Recipes — as built (codex/v2-recipes, CI pending, awaiting merge)</h2>
  <p class="lede">The real branch on the local stack — verdicts RC1: A (serves line dropped), RC2: yes, RC3: removed, RC4: A, RC5: full-width, implemented behavior-neutral. Verified 22/22 layout assertions plus a live save round-trip (servings 2→3, persisted through reload, reverted), zero console errors. One real bug found and fixed on the way: the “Recipe saved.” confirmation was being wiped before it could ever paint (the editor reload cleared it) — it now shows after every save.</p>
  <div class="shots">${phone("AB-recipes-list.jpg", "Library as built — 390px")}${phone("AB-recipes-editor.jpg", "Editor as built — 390px")}${phone("AB-recipes-editor-save.jpg", "Editor as built — full-width save")}${phone("AB-recipes-desktop.jpg", "Desktop split view as built — 1280px", { wide: true })}</div>
</section>

<section class="screen-sec round">
  <h2>The library — pick a list direction</h2>
  <p class="lede">Left is today. Both mocks adopt the cycle screens' language — a “Recipes” page title, an uppercase card label, 44px search/sort/thumb targets, and teal “View recipe” links (today they render browser-default blue, the last unstyled links in the app). They differ in what a recipe row <em>is</em>.</p>
  <div class="shots">${phone("RC-list-before.jpg", "Today — cards, blue links, no page title")}${phone("RC-list-A.jpg", "Variant A — cards, dressed in v2 (mock)")}${phone("RC-list-B.jpg", "Variant B — flat library rows, hairline dividers (mock)")}</div>
  <div class="cards">
    ${card("RC1", "List language: A or B",
      "<strong>A</strong> keeps each recipe as a bordered card — the list stays visually chunky and unmissable. <strong>B</strong> flattens the library into hairline-divided rows (name + serves left, actions right) — the Plan quick-add / iOS-list reading; all four sample recipes fit one screen without scrolling.",
      "<code>RC1: A</code> · <code>RC1: B</code> · <code>RC1: keep</code> — or a blend.",
      `<p class="verdict">Verdict, 2 Jul: A, with the serves line dropped as unnecessary here. Built — see “as built” above.</p>`)}
    ${card("RC2", "Header language + teal links",
      "both mocks add the “Recipes” page title, the uppercase YOUR RECIPES card label, 44px search/sort controls, and restyle “View recipe” from default blue underline to the app's teal link language (same weight as Edit).",
      "adopt across the pass? <code>RC2: yes</code> / call out anything to drop.",
      `<p class="verdict">Verdict, 2 Jul: yes (rode along with the A picks). Built.</p>`)}
    ${card("RC3", "“Load sample data” placement",
      "not mocked — a question. The demo-seeding button sits first in the header, ahead of “New recipe”, on a screen you use daily. Proposal: show it only when the library is empty (first run), so “New recipe” leads. Technically a behavior tweak, so it's your call whether it rides along with this pass or stays put.",
      "<code>RC3: empty-only</code> · <code>RC3: keep</code>.",
      `<p class="verdict">Verdict, 2 Jul: remove it outright — a leftover from before Recipes existed. Built: button and seeding code retired.</p>`)}
  </div>
</section>

<section class="screen-sec round">
  <h2>The editor — pick a form language</h2>
  <p class="lede">The mobile editor takeover (“‹ Back to recipes”, PR #17) stays. Both mocks add uppercase INGREDIENTS / STEPS / TAGS section labels and 44px inputs. They differ in the top fields — and note the trade-off in B: long recipe names truncate in a right-hand control (“Lemon Chicken Thi…”), so building B would widen that column or keep Name stacked.</p>
  <div class="shots">${phone("RC-editor-before.jpg", "Today — stacked fields, sentence-case sections")}${phone("RC-editor-A.jpg", "Variant A — stacked, dressed in v2 (mock)")}${phone("RC-editor-B.jpg", "Variant B — Name/Servings as iOS rows, à la Settings (mock)")}</div>
  <div class="cards">
    ${card("RC4", "Top fields: A or B",
      "<strong>A</strong> keeps labels stacked above full-width inputs — roomiest for long recipe names, and the ingredient/step grids below already read this way. <strong>B</strong> restructures Name and Base servings into Settings-style rows (label left, control right, hairline dividers) — consistent with Settings, but recipe names are longer than settings values (see the truncation above).",
      "<code>RC4: A</code> · <code>RC4: B</code> — if B, name-column width is my call.",
      `<p class="verdict">Verdict, 2 Jul: A. Built.</p>`)}
    ${card("RC5", "Save treatment",
      "full-width chunky teal “Save recipe”, same as Settings' save and Plan's generate exit (today it's a small fit-content button hiding under the tag chips — compare below).",
      "<code>RC5: full-width</code> · <code>RC5: keep</code>.",
      `<p class="verdict">Verdict, 2 Jul: full-width (rode along with the A picks). Built.</p>`)}
  </div>
  <div class="shots" style="margin-top:18px">${phone("RC-editor-save-before.jpg", "Today — fit-content save under the chips")}${phone("RC-editor-save-A.jpg", "Mock — full-width teal save, uppercase TAGS")}</div>
</section>

<div class="index">
  <h3>Code index — for quick replies</h3>
  <table>
    <tr class="dim"><td>RC1</td><td>Library list — verdict: A cards, serves line dropped (built)</td></tr>
    <tr class="dim"><td>RC2</td><td>Header language + teal View links — verdict: yes (built)</td></tr>
    <tr class="dim"><td>RC3</td><td>“Load sample data” — verdict: removed outright (built)</td></tr>
    <tr class="dim"><td>RC4</td><td>Editor top fields — verdict: A stacked (built)</td></tr>
    <tr class="dim"><td>RC5</td><td>Full-width teal Save — verdict: yes (built)</td></tr>
    <tr class="dim"><td>ST1–ST3</td><td>Round 2, resolved: Settings iOS rows · full-width save · header language (shipped, PR #20)</td></tr>
    <tr class="dim"><td>V1–V2</td><td>Round 2, resolved: amber pantry badge · opaque mobile panels (shipped, PR #19)</td></tr>
    <tr class="dim"><td>T1–T4</td><td>Still open from round 1: settings gear · plan-less Today · amber link hover · 640px desktop column</td></tr>
    <tr class="dim"><td>P1–P3</td><td>Still open from round 1: inline sheets · generate-is-a-link · filter pills kept</td></tr>
    <tr class="dim"><td>S1–S2</td><td>Still open from round 1: Regenerate button kept · On-hand collapsed</td></tr>
    <tr class="dim"><td>C2</td><td>Still open from round 1: “Done — mark cooked” writes nothing</td></tr>
  </table>
</div>

<p class="foot">After this pass: recipe detail (same rhythm — it also fixes the pantry-badge text-color quirk from V1). Shots captured on the local Supabase stack with sample data — your household data was not touched. For the real thumb feel: <code>npm run dev:phone</code> on your iPhone. Nothing merges until you say go.</p>
</div>
`;

fs.writeFileSync(path.join(DIR, "review-board-r3.html"), html);
console.log("review-board-r3.html:", (fs.statSync(path.join(DIR, "review-board-r3.html")).size / 1024 / 1024).toFixed(2), "MB");
