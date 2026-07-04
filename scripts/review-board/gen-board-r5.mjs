// Round-5 review board: in-app Recipe Import direction mocks (IM1–IM7).
// Mocks are CSS/DOM injections on the live local /recipes screen (no app code
// yet — that is Phase C). Visual system inherited from gen-board-r2..r4;
// deploys in place at the same artifact URL. All items are open proposals.
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const SHOTS = path.join(DIR, "shots-import");
const img64 = (f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(SHOTS, f)).toString("base64")}`;

function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function phone(file, title) {
  return `<figure class="frame"><div class="screen"><img src="${img64(file)}" alt="${esc(title)}" loading="lazy"></div><figcaption>${esc(title)}</figcaption></figure>`;
}

function card(code, title, proposal, ask, extra = "") {
  return `<article class="card proposal" id="${code}">
    <div class="card-head"><span class="pin-badge">${code}</span><h4>${title}</h4></div>
    <p class="shipped">${proposal}</p>
    <p class="ask">${ask}</p>${extra}
  </article>`;
}

const html = `<title>Meal Queue — Recipe Import Review Board</title>
<style>
  :root{--bg:#fafaf8;--surface:#fff;--ink:#16211e;--muted:#5e6b67;--line:#e4e6e1;--brand:#12695e;--brand-soft:#e3eeeb;--amber:#e8a13d;--amber-soft:#fdf3e3}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  .wrap{max-width:1060px;margin:0 auto;padding:40px 20px 80px}
  header.top{margin-bottom:14px}
  .eyebrow{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--brand)}
  h1{font-size:clamp(26px,4vw,34px);line-height:1.15;margin:6px 0 8px;letter-spacing:-.02em;text-wrap:balance}
  .sub{color:var(--muted);max-width:64ch;margin:0}
  .howto{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:22px 0 8px;display:grid;gap:10px}
  .howto p{margin:0;max-width:none}
  .howto .reply{background:var(--brand-soft);border-radius:10px;padding:10px 14px;font-weight:600;color:#0d4f47}
  .howto .reply code{font:600 14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:transparent}
  section.screen-sec{margin-top:44px;border-top:1px solid var(--line);padding-top:26px}
  section.screen-sec>h2{font-size:22px;margin:2px 0 4px;letter-spacing:-.01em}
  section.screen-sec>.lede{color:var(--muted);margin:0 0 18px;max-width:72ch}
  .shots{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start;margin:0 0 18px}
  .frame{margin:0;width:min(300px,100%)}
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
  .proposal .shipped::before{content:"Proposal — ";font-weight:650;color:#a06413}
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
  .foot{color:var(--muted);font-size:13.5px;margin-top:26px;max-width:74ch}
  @media (max-width:700px){.wrap{padding:24px 14px 60px}.shots{gap:16px}.frame{width:min(46%,320px)}}
</style>
<div class="wrap">
<header class="top">
  <div class="eyebrow">Meal Queue · Recipe Import · 3 Jul 2026</div>
  <h1>Review board — round 5: in-app Recipe Import</h1>
  <p class="sub">Paste a recipe (or an open URL) → an LLM parses it → you review and save. iPhone-first. These are direction mocks (CSS/DOM injected on the live app at 390px), not built UI — they gate the import screen before any of it is coded. Everything below is an open question with a pin code (IM1–IM7); the server route that does the parsing is being built in parallel and does not wait on these.</p>
</header>

<div class="howto">
  <p><strong>How to give feedback:</strong> reply in chat using the pin codes below. Where a mock shows A vs B, just name the letter; where it asks "OK?", a "yes" or a change is enough.</p>
  <p class="reply"><code>e.g. "IM1: A, paste-first confirmed" / "IM3: amber" / "IM4: B" / "IM7: A"</code></p>
  <p><strong>Note:</strong> the amber callout, teal progress bar, and full-width save all reuse existing tokens; nothing here needs a new colour. NYT Cooking is used as the running example because it is paywalled, which is exactly why paste leads and a blocked URL has to fail soft.</p>
</div>

<section class="screen-sec round">
  <h2>IM1 — the entry surface</h2>
  <p class="lede">How you start an import. Both lead with paste (NYT is paywalled and can't be fetched); the difference is whether the URL field is always visible (A) or one tap away behind a pill (B).</p>
  <div class="shots">${phone("IM1-A.jpg", "A — stacked: paste box, 'or', URL, one Import button")}${phone("IM1-B.jpg", "B — Paste / Link pills, one input at a time")}</div>
  <div class="cards">
    ${card("IM1", "Entry surface: stacked or mode pills",
      "<strong>A</strong> stacks both inputs — a big paste box, an 'or' divider, then a URL field — under a single full-width teal Import button. <strong>B</strong> uses Paste / Link pills and shows one input at a time. Both lead with paste.",
      "<code>IM1: A</code> · <code>IM1: B</code>. And confirm paste-first ordering.")}
  </div>
</section>

<section class="screen-sec round">
  <h2>IM2 — the wait, and IM3 — a blocked site</h2>
  <p class="lede">Parsing takes ~10–15s server-side. IM2 is the waiting treatment. IM3 is what happens when a site (NYT) blocks us: fail soft into paste, as an amber redirect or a plain red error.</p>
  <div class="shots">${phone("IM2.jpg", "IM2 — inputs locked, 'Reading recipe…', indeterminate bar, Cancel")}${phone("IM3-amber.jpg", "IM3 A — amber redirect, focus to paste, URL kept")}${phone("IM3-red.jpg", "IM3 B — plain red error")}</div>
  <div class="cards">
    ${card("IM2", "The wait treatment",
      "While the parser reads: the inputs lock, the button becomes 'Reading recipe…', a thin teal indeterminate bar appears, a Cancel link is offered, and an aria-live line reads 'Reading the recipe. This can take about 15 seconds.'",
      "Right treatment? <code>IM2: yes</code>, or say what to change.")}
    ${card("IM3", "Paywalled URL: amber redirect or red error",
      "A blocked or paywalled site fails soft into paste. <strong>Amber</strong> reads as a helpful redirect ('That site blocked us. Paste the recipe text instead.'), keeps the URL, and moves focus to the paste box. <strong>Red</strong> reads as a hard error to recover from.",
      "<code>IM3: amber</code> · <code>IM3: red</code>.")}
  </div>
</section>

<section class="screen-sec round">
  <h2>IM4 / IM5 / IM6 — the review screen</h2>
  <p class="lede">A dedicated review screen (not the existing editor prefilled) edits the parsed draft in the exact recipe-editor idiom — ingredient rows, unit selects, removable tag chips. IM4 is how the original text rides along; IM5 is the save cluster; IM6 is what gets stored as the original.</p>
  <div class="shots">${phone("IM4-A.jpg", "IM4 A — collapsible 'Original text' panel above the form")}${phone("IM4-B.jpg", "IM4 B — Parsed / Original toggle pills")}${phone("IM5.jpg", "IM5 — provenance line + note + full-width teal Save")}</div>
  <div class="cards">
    ${card("IM4", "Original text: collapsible panel or toggle",
      "<strong>A</strong> keeps the parsed form always visible and tucks the original into a collapsible 'Original text' panel above it. <strong>B</strong> uses Parsed / Original toggle pills, so the original replaces the form when tapped.",
      "<code>IM4: A</code> · <code>IM4: B</code> on the phone.")}
    ${card("IM5", "The save cluster",
      "The bottom of the review screen: a muted provenance line ('Imported from cooking.nytimes.com'), a note ('The original text is saved with the recipe.'), and a full-width teal 'Save recipe' button — the same save path as the editor.",
      "OK as shown? <code>IM5: yes</code>, or flag a change.")}
    ${card("IM6", "What gets saved as the original (text pin)",
      "The original text is stored verbatim in <code>instructions_raw</code>, with a 'Source: &lt;url&gt;' first line for URL imports (visible in IM4's Original-text panel). It is the provenance record, not editable at review — the structured steps are separate.",
      "<code>IM6: OK</code>, or flag.")}
  </div>
</section>

<section class="screen-sec round">
  <h2>IM7 — where Import lives</h2>
  <p class="lede">The entry point into the flow, on the real Recipes screen. A quiet secondary button either way — the question is placement.</p>
  <div class="shots">${phone("IM7-A.jpg", "A — 'Import' beside 'New recipe' in the library panel")}${phone("IM7-B.jpg", "B — 'Import' up in the page head, by the title")}</div>
  <div class="cards">
    ${card("IM7", "Import button placement",
      "<strong>A</strong> puts an 'Import' secondary button beside 'New recipe' inside the library panel (the two ways to add a recipe, together). <strong>B</strong> lifts it into the page head next to the 'Recipes' title.",
      "<code>IM7: A</code> · <code>IM7: B</code>.")}
  </div>
</section>

<div class="index">
  <h3>Code index — for quick replies</h3>
  <table>
    <tr class="dim"><td>IM1</td><td>Entry surface — A stacked (paste + or + URL) vs B Paste/Link pills; confirm paste-first</td></tr>
    <tr class="dim"><td>IM2</td><td>Parsing wait — locked inputs, "Reading recipe…", indeterminate bar, Cancel, aria-live 15s</td></tr>
    <tr class="dim"><td>IM3</td><td>Blocked/paywalled URL — amber redirect (keeps URL, focus to paste) vs plain red error</td></tr>
    <tr class="dim"><td>IM4</td><td>Review original text — A collapsible panel vs B Parsed/Original toggle</td></tr>
    <tr class="dim"><td>IM5</td><td>Save cluster — provenance line + "saved with the recipe" note + full-width teal Save</td></tr>
    <tr class="dim"><td>IM6</td><td>instructions_raw = original text + "Source:" line, not editable at review (text pin)</td></tr>
    <tr class="dim"><td>IM7</td><td>Import button — A beside "New recipe" vs B in the page head</td></tr>
  </table>
</div>

<p class="foot">Mocks captured on the local Supabase stack at 390px (reviewer account, seeded sample data — your household data was not touched). The parsing itself is Claude Haiku 4.5, server-side; that route (PR 1) is built and green in parallel and does not depend on these verdicts. Verdicts here gate only the import-screen build (PR 2). For the real thumb feel once it ships: <code>npm run dev:phone</code> on your iPhone.</p>
</div>
`;

fs.writeFileSync(path.join(DIR, "review-board-r5.html"), html);
console.log("review-board-r5.html:", (fs.statSync(path.join(DIR, "review-board-r5.html")).size / 1024 / 1024).toFixed(2), "MB");
