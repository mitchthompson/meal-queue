// Generates review-board.html from shots/manifest.json + JPEGs (base64 inline).
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const SHOTS = path.join(DIR, "shots");
const manifest = JSON.parse(fs.readFileSync(path.join(SHOTS, "manifest.json"), "utf8"));

const img64 = (f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(SHOTS, f)).toString("base64")}`;
// round-1 prototype shots (CSS-injected mocks, not shipped code)
manifest.shots.push(
  { id: "C-prop-A", file: "C-prop-A.jpg", title: "Variant A — compact outlined chips", vw: 390, vh: 844, pins: [] },
  { id: "C-prop-B", file: "C-prop-B.jpg", title: "Variant B — one quiet text line", vw: 390, vh: 844, pins: [] },
  // round-1 as-built shots (real branch code on the local stack)
  { id: "AB-today-two", file: "AB-today-two.jpg", title: "Today — “Tonight” hero with the second meal (“Also tonight”)", vw: 390, vh: 844, pins: [] },
  { id: "AB-plan", file: "AB-plan.jpg", title: "Plan — flat day lists, quick-add open (no L/D division)", vw: 390, vh: 844, pins: [] },
  { id: "AB-quickadd", file: "AB-quickadd.jpg", title: "Quick-add — 44px rows, serves count, recents first", vw: 390, vh: 844, pins: [] },
  { id: "AB-cook", file: "AB-cook.jpg", title: "Cook — quiet ingredient line, as built (C1: B)", vw: 390, vh: 844, pins: [] },
  { id: "AB-recipes-editor", file: "AB-recipes-editor.jpg", title: "Recipes — editor is the screen on mobile", vw: 390, vh: 844, pins: [] },
);
const byId = Object.fromEntries(manifest.shots.map((s) => [s.id, s]));

const SHORT = [
  ["4-tab bar", "tabbar"], ["Tonight hero", "hero"], ["Deadline strip", "deadline strip"],
  ["Leftover pill", "leftover pill"], ["Quick-add", "quick-add +"], ["Compact −", "serving controls"],
  ["Pinned order", "order bar"], ["30px checks", "checks"], ["Amber progress", "progress dots"],
  ["Giant Next", "Next / Back"],
];
const shortName = (label) => (SHORT.find(([m]) => label.startsWith(m)) || [null, null])[1];

function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function phone(shotId, opts = {}) {
  const s = byId[shotId];
  if (!s) return `<!-- missing shot ${shotId} -->`;
  const pins = s.pins.filter((p) => !p.missing).map((p) => {
    const l = (p.x / s.vw) * 100, t = (p.y / s.vh) * 100, w = (p.w / s.vw) * 100, h = (p.h / s.vh) * 100;
    if (p.n === "•") {
      const name = shortName(p.label);
      if (!name) return "";
      return `<span class="ring vocab" style="left:${l.toFixed(2)}%;top:${t.toFixed(2)}%;width:${w.toFixed(2)}%;height:${h.toFixed(2)}%"><i>${esc(name)}</i></span>`;
    }
    return `<span class="ring flag" style="left:${l.toFixed(2)}%;top:${t.toFixed(2)}%;width:${w.toFixed(2)}%;height:${h.toFixed(2)}%"><b>${p.n}</b></span>`;
  }).join("");
  const cls = opts.wide ? "frame wide" : "frame";
  return `<figure class="${cls}"><div class="screen"><img src="${img64(s.file)}" alt="${esc(s.title)}" loading="lazy">${pins}</div><figcaption>${esc(s.title)}</figcaption></figure>`;
}

function card(code, title, shipped, ask, extra = "") {
  return `<article class="card" id="${code}">
    <div class="card-head"><span class="pin-badge">${code}</span><h4>${title}</h4></div>
    <p class="shipped">${shipped}</p>
    <p class="ask">${ask}</p>${extra}
  </article>`;
}

const swatches = `<div class="swatches">
  <span class="swatch"><i style="background:#e8a13d"></i>amber #E8A13D — shipped</span>
  <span class="swatch"><i style="background:#12695e"></i>teal #12695E — the alternative</span>
</div>`;

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
  .legend{display:flex;gap:18px;flex-wrap:wrap;color:var(--muted);font-size:13.5px;align-items:center}
  .legend .pin-badge{position:static;transform:none}
  .legend .vocab-chip{display:inline-block;background:#eceeea;color:#4a5551;border-radius:99px;padding:1px 8px;font-size:11px;font-weight:600}
  section.screen-sec{margin-top:44px;border-top:1px solid var(--line);padding-top:26px}
  section.screen-sec>h2{font-size:22px;margin:2px 0 4px;letter-spacing:-.01em}
  section.screen-sec>.lede{color:var(--muted);margin:0 0 18px;max-width:70ch}
  .shots{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start;margin:0 0 18px}
  .frame{margin:0;width:min(330px,100%)}
  .frame.wide{width:min(720px,100%)}
  .screen{position:relative;border:1px solid var(--line);border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 1px 2px rgb(22 33 30 / .05),0 8px 24px rgb(22 33 30 / .06)}
  .screen img{display:block;width:100%;height:auto}
  figcaption{font-size:13px;color:var(--muted);margin-top:8px;padding-left:2px}
  .ring{position:absolute;border-radius:10px;pointer-events:none}
  .ring.flag{outline:2.5px solid var(--amber);outline-offset:2px;box-shadow:0 0 0 2px rgb(232 161 61 / .25)}
  .ring.flag b{position:absolute;top:-11px;left:-11px;background:var(--amber);color:#231a08;font:700 12px/1 -apple-system,BlinkMacSystemFont,sans-serif;border-radius:8px;padding:4px 7px;box-shadow:0 1px 4px rgb(22 33 30 / .3)}
  .ring.vocab{outline:1.5px dashed #9aa5a1;outline-offset:2px}
  .ring.vocab i{position:absolute;top:-9px;left:-4px;background:#eceeea;color:#4a5551;font:600 10.5px/1 -apple-system,BlinkMacSystemFont,sans-serif;font-style:normal;border-radius:99px;padding:3px 7px;white-space:nowrap}
  .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
  .card-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}
  .card-head h4{margin:0;font-size:15.5px;letter-spacing:-.01em}
  .pin-badge{background:var(--amber);color:#231a08;font:700 12px/1 -apple-system,BlinkMacSystemFont,sans-serif;border-radius:8px;padding:4px 7px;flex-shrink:0}
  .card p{margin:0 0 8px;font-size:14.5px}
  .shipped{color:var(--ink)}
  .shipped::before{content:"Shipped default — ";font-weight:650;color:var(--brand)}
  .ask{color:var(--muted)}
  .ask::before{content:"Your call — ";font-weight:650;color:#a06413}
  .verdict{background:var(--brand-soft);color:#0d4f47;border-radius:8px;padding:7px 10px;font-size:13.5px!important;font-weight:600;margin-top:2px}
  .round{border-top:3px solid var(--amber)!important}
  .swatches{display:flex;gap:14px;flex-wrap:wrap;margin-top:4px}
  .swatch{display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--muted)}
  .swatch i{width:18px;height:18px;border-radius:6px;display:inline-block;border:1px solid rgb(22 33 30 / .12)}
  .index{margin-top:48px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px 20px}
  .index h3{margin:0 0 10px;font-size:16px}
  .index table{border-collapse:collapse;width:100%;font-size:14px}
  .index td{padding:5px 10px 5px 0;vertical-align:top;border-top:1px solid var(--line)}
  .index tr:first-child td{border-top:none}
  .index td:first-child{font:700 12.5px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;color:#a06413;white-space:nowrap}
  .foot{color:var(--muted);font-size:13.5px;margin-top:26px;max-width:72ch}
  @media (max-width:700px){.wrap{padding:24px 14px 60px}.shots{gap:16px}}
</style>
<div class="wrap">
<header class="top">
  <div class="eyebrow">Meal Queue · The Reflow · 2 Jul 2026</div>
  <h1>Reflow review board</h1>
  <p class="sub">Every screenshot below is the real shipped app on the local stack with sample data (your household data was not touched). Amber pins mark the 12 defaults that were chosen while building and need your verdict.</p>
</header>

<div class="howto">
  <p><strong>How to give feedback:</strong> reply in chat using the pin codes. Verdicts can be one word; changes can be a sentence.</p>
  <p class="reply"><code>T1: keep · T3: back to teal · S1: drop it · P4: fine, but make the "+ add another" bigger</code></p>
  <p><strong>Anything without a pin:</strong> just describe it — I know every element by name (day rows, slot chips, order bar, week peek…). Dashed gray tags on the shots give you the vocabulary.</p>
  <p><strong>What happens next:</strong> accepted defaults get resolved in the flag register; requested changes become a queued task list for your approval. No code changes until you say go.</p>
  <div class="legend"><span class="pin-badge">T1</span> needs your verdict &nbsp;·&nbsp; <span class="vocab-chip">element name</span> pointing vocabulary, no decision needed</div>
</div>

<section class="screen-sec round">
  <h2>Round 1 — as built</h2>
  <p class="lede">All four items are implemented, CI-checked, and awaiting your merge word: <strong>PR #17</strong> (quiet cook line + mobile recipe editor) and <strong>PR #18</strong> (flat day lists + mobile quick-add). These are the real branches driven on the local stack — note the flat day cards, the two-meal “Tonight” hero, and the legacy lunch leftover sitting happily in its day's list.</p>
  <div class="shots">${phone("AB-today-two")}${phone("AB-plan")}</div>
  <div class="shots">${phone("AB-quickadd")}${phone("AB-cook")}${phone("AB-recipes-editor")}</div>
</section>

<section class="screen-sec round">
  <h2>Round 1 — your feedback, turned into proposals</h2>
  <p class="lede">2 Jul. Decided and shipped the same day (PR #17 / PR #18, above) — kept for the record: C1 went with variant B.</p>
  <div class="shots">${phone("C-prop-A")}${phone("C-prop-B")}</div>
  <div class="cards">
    ${card("C1", "Chip restyle — pick a direction", "verdict noted: the heuristic stays, the chips shrink. Variant A keeps tappable-looking pills at ~60% the visual weight; variant B collapses to one muted line (least space — the built version would separate ingredients more clearly than this mock).", "reply <code>C1: A</code> or <code>C1: B</code>, or describe your own blend.")}
    ${card("F1", "Drop the lunch/dinner division", "not shipped — this is your requested change. Plan's day cards become one flat meal list per day; quick-add just adds a meal to the day, multiples as today. No DB migration needed: new items quietly store the vestigial column's default, and your existing lunch items simply appear in their day's list.", "ripples to confirm: Today's hero label becomes just “Tonight” and needs a pick rule when a day has several meals — I propose first-added cook meal, with a “+ N more” sub-line. Week peek drops its lunch/dinner sublabels. Within-day order = the order you added them. Good?")}
    ${card("F2", "Quick-add recipe search, mobile-first", "today it's a text input over small text-button rows — cramped targets, no memory, and a “Shift+Enter” hint that means nothing on a phone.", "proposal: 44px tap rows, most-recently-planned recipes shown before you type, serves-count on each row, keyboard hints hidden on touch. Same machinery underneath. <code>F2: go</code> to green-light.")}
    ${card("F3", "Recipe editing without the scroll-hunt", "on mobile the editor stacks below the full recipe list, so “Edit recipe” means scrolling past everything you didn't pick.", "proposal: on mobile, opening the editor makes it the screen (list hides behind “Back to list”); desktop keeps the side-by-side split. <code>F3: go</code> to green-light.")}
  </div>
</section>

<section class="screen-sec">
  <h2>Today — the new home screen</h2>
  <p class="lede">Opens to what today needs: tonight's meal one tap from Cook, the order deadline when it's near, a week peek. The old dashboard is retired.</p>
  <div class="shots">${phone("T-main")}${phone("T-planless")}</div>
  <div class="shots">${phone("T-desktop", { wide: true })}</div>
  <div class="cards">
    ${card("T1", "Settings access", "the mockup's tabbar has four tabs and no settings entry, so Settings moved to a gear icon in the Today header.", "confirm the gear placement, or tell me where settings should live.")}
    ${card("T2", "Plan-less Today", "first run and gap weeks render a teal hero — “Plan your week to get started” → Plan — plus a recipes pointer card.", "is this the right first-run / between-plans behavior?")}
    ${card("T3", "Link hover color", "with terracotta retired, the link-hover token (—brand-2) now resolves to amber #E8A13D app-wide.", "keep amber hover, or point hover back at teal?", swatches)}
    ${card("T4", "Desktop width", "desktop Today constrains the content column to 640px (see the wide shot above).", "comfortable, or should desktop use more of the window?")}
  </div>
</section>

<section class="screen-sec">
  <h2>Plan — day rows, thumb-first</h2>
  <p class="lede">One card per day, quick-add as the primary action, today highlighted, generate as the exit. The nth-child label coupling is gone — L/D labels are real markup.</p>
  <div class="shots">${phone("P-top")}${phone("P-multi")}</div>
  <div class="shots">${phone("P-editsheet")}${phone("P-generate")}</div>
  <div class="cards">
    ${card("P1", "Sheets are inline panels", "the mockup's “edit sheet” is built as an inline collapsible panel toggled from the header (New plan / Edit), not a modal overlay.", "does the inline panel feel right, or do you want a true bottom-sheet/modal?")}
    ${card("P2", "Generate is a link", "“Generate grocery list” navigates to Shop; Shop's staleness-driven regeneration does the actual generating on arrival.", "okay that generation happens on arrival at Shop, or should the button generate before navigating?")}
    ${card("P3", "Filters and picker kept", "the mockup shows a single plan only; the filter pills (Current/Upcoming/Past/All) and compact plan picker were kept above the day rows.", "keep the pills and picker, or hide them behind something quieter?")}
    ${card("P4", "Multi-item slots", "slots with several dishes render as stacked rows plus a small “+ add another” line; eat-out chips show their note inline.", "right treatment for multi-dish nights and eat-out notes?")}
  </div>
</section>

<section class="screen-sec">
  <h2>Shop — scan and check</h2>
  <p class="lede">Pinned order/pickup bar with a live unchecked count, 30px checks, teal fill + strikethrough when checked. State survives replans (milestone 4 underneath).</p>
  <div class="shots">${phone("S-list")}${phone("S-onhand")}</div>
  <div class="cards">
    ${card("S1", "Regenerate button kept", "auto-regeneration already runs on staleness; the small ghost Regenerate stays in the header as the manual escape hatch.", "keep it for now, or trust staleness and drop it?")}
    ${card("S2", "On hand starts collapsed", "the On-hand section now defaults to collapsed — it's post-purchase bookkeeping, not shopping. (The old always-on plan sidebar is now a compact picker that only appears with more than one active plan.)", "right default, or should On hand stay open?")}
  </div>
</section>

<section class="screen-sec">
  <h2>Cook — the dark takeover</h2>
  <p class="lede">Full-screen from Tonight's hero: one step at a time in large type, that step's ingredients as chips, wake-lock held while cooking.</p>
  <div class="shots">${phone("C-step")}${phone("C-done")}</div>
  <div class="cards">
    ${card("C1", "Ingredient chips are a guess", "the schema has no step↔ingredient link, so chips come from matching ingredient names against the step text (case-insensitive, tolerates plurals). It will miss renames like “the bird” and can over-match short names.", "judge it on your real recipes: keep the heuristic, tune it, or add a real step↔ingredient link (that's a schema change on the usual rails).", `<p class="verdict">Verdict, 2 Jul: heuristic stays; chips shrink — pick variant A or B in Round 1 above.</p>`)}
    ${card("C2", "“Done — mark cooked” writes nothing", "no cooked state exists in the schema, so the last-step button just exits the takeover.", "want a real cooked state (could power Today's “tonight” logic and leftover suggestions)? That's a schema change + migration; or keep it as a plain exit.")}
  </div>
</section>

<div class="index">
  <h3>Code index — for quick replies</h3>
  <table>
    <tr><td>T1</td><td>Settings gear in the Today header</td></tr>
    <tr><td>T2</td><td>Plan-less “Plan your week” hero</td></tr>
    <tr><td>T3</td><td>Amber link hover (vs teal)</td></tr>
    <tr><td>T4</td><td>640px desktop column</td></tr>
    <tr><td>P1</td><td>Inline sheets, not modals</td></tr>
    <tr><td>P2</td><td>Generate = link to Shop</td></tr>
    <tr><td>P3</td><td>Filter pills + plan picker kept</td></tr>
    <tr><td>P4</td><td>Stacked multi-item slots + inline eat-out notes</td></tr>
    <tr><td>S1</td><td>Manual Regenerate kept</td></tr>
    <tr><td>S2</td><td>On-hand section collapsed by default</td></tr>
    <tr><td>C1</td><td>Ingredient-chip name-match heuristic → verdict in; pick variant A/B</td></tr>
    <tr><td>C2</td><td>Mark-cooked is a no-op</td></tr>
    <tr><td>F1</td><td>Drop the lunch/dinner division (flat day lists)</td></tr>
    <tr><td>F2</td><td>Mobile-first quick-add recipe search</td></tr>
    <tr><td>F3</td><td>Editor-as-screen for mobile recipe editing</td></tr>
  </table>
</div>

<p class="foot">Sources: docs/design-flags.md (the flag register) and docs/redesign-brief.md. Screens captured ${manifest.shots.length} shots on the local Supabase stack, zero console errors. For the real thumb feel, run <code>npm run dev:phone</code> and open the QR on your iPhone — this page is for pointing, the phone is for feeling.</p>
</div>
`;

fs.writeFileSync(path.join(DIR, "review-board.html"), html);
console.log("review-board.html:", (fs.statSync(path.join(DIR, "review-board.html")).size / 1024 / 1024).toFixed(2), "MB");
