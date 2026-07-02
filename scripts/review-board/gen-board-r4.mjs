// Round-4 review board (v2 sweep finale): recipe-detail direction mocks,
// with round 3 (Recipes pass, merged) preserved below. Visual system
// inherited from gen-board-r2/r3; deployed in place at the same artifact URL.
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
  <h1>Review board — round 4: recipe detail, the sweep finale</h1>
  <p class="sub">Round-4 verdict is in (2 Jul: “variant B for both”). <strong>The pass is built and sitting on <code>codex/v2-recipe-detail</code> with the as-built shots below — awaiting your merge word.</strong> One pin stayed open: <strong>RD5</strong> (the tighter title row) wasn't mocked and wasn't called, so the title row is untouched — say <code>RD5: yes</code> and it rides along before merge. Merging closes milestone 7.</p>
</header>

<div class="howto">
  <p><strong>How to give feedback:</strong> reply in chat using the pin codes — anything here can still be overturned before (or after) merge.</p>
  <p class="reply"><code>RD: merge it · optionally RD5: yes · or e.g. “rows: more padding”</code></p>
  <p><strong>What happens next:</strong> your merge word ships the pass and closes milestone 7; behind it sit the ten open round-1 pins and the standing follow-ups.</p>
</div>

<section class="screen-sec round">
  <h2>Recipe detail — as built (codex/v2-recipe-detail, awaiting merge)</h2>
  <p class="lede">The real branch on the local stack — RD1: B flat rows for ingredients and steps, RD2 chunky Start cooking, RD3 header language + 44px stepper, RD4 badge un-quirked (the amount styling moved to its own class, so the badge's amber finally applies). Verified 13/13 assertions plus behavior checks: the stepper still rescales amounts, Start cooking still opens the Cook takeover, and Today's <code>?cook=1</code> deep link still auto-opens — zero console errors.</p>
  <div class="shots">${phone("AB-detail.jpg", "Detail as built — 390px")}${phone("AB-detail-steps.jpg", "Steps + Start cooking as built")}${phone("AB-detail-cook.jpg", "Cook takeover — unchanged, still fed by this screen")}${phone("AB-detail-desktop.jpg", "Desktop two-column as built — 1280px", { wide: true })}</div>
</section>

<section class="screen-sec round">
  <h2>Recipe detail — pick the rows language</h2>
  <p class="lede">Left is today. Both mocks adopt the v2 language everywhere else (RD2–RD4 below). The A/B is the same question you answered for the library, but the material differs: these are dense data rows, not four fat cards — <strong>B</strong> buys back a lot of scrolling on long recipes. A blend (e.g. flat ingredients, carded steps) is fair game.</p>
  <div class="shots">${phone("RD-before.jpg", "Today — carded ingredients, tan-on-gray badge")}${phone("RD-A.jpg", "Variant A — cards, dressed in v2 (mock)")}${phone("RD-B.jpg", "Variant B — flat hairline rows (mock)")}</div>
  <div class="shots">${phone("RD-before-steps.jpg", "Today — steps, small header Start cooking")}${phone("RD-A-steps.jpg", "Variant A — steps + chunky Start cooking (mock)")}${phone("RD-B-steps.jpg", "Variant B — flat steps + chunky Start cooking (mock)")}</div>
  <div class="cards">
    ${card("RD1", "Ingredient + step rows: A or B",
      "<strong>A</strong> keeps each ingredient and step as a bordered card, dressed in v2 — consistent with your library pick. <strong>B</strong> flattens both lists into hairline rows — denser, roughly a screen less scrolling on this 5-ingredient recipe alone.",
      "<code>RD1: A</code> · <code>RD1: B</code> · or a blend (e.g. “flat ingredients, carded steps”).",
      `<p class="verdict">Verdict, 2 Jul: B for both. Built — see “as built” above.</p>`)}
    ${card("RD2", "Start cooking treatment",
      "both mocks make “Start cooking” a full-width chunky teal bar at the top of the Steps card (today it's a small button in the card header) — this is the screen's whole job, and it feeds the Cook takeover. Behavior unchanged, incl. Today's ?cook=1 deep link.",
      "<code>RD2: full-width</code> · <code>RD2: keep</code>.",
      `<p class="verdict">Verdict, 2 Jul: full-width (rode along with the B pick). Built.</p>`)}
    ${card("RD3", "Header language ride-alongs",
      "both mocks tighten the title to the page-head language and add uppercase OVERVIEW / INGREDIENTS / STEPS card labels + a 44px servings stepper (the +/− buttons are 40px today).",
      "adopt? <code>RD3: yes</code> / call out anything to drop.",
      `<p class="verdict">Verdict, 2 Jul: yes (rode along with the B pick). Built.</p>`)}
    ${card("RD4", "Pantry badge: the V1 quirk, fixed",
      "both mocks show the badge with its intended amber text (today a CSS-specificity accident renders it muted gray — the quirk flagged when you approved V1). The real fix scopes the amount styling to its own class so the badge's colors finally apply.",
      "<code>RD4: yes</code> — flag if you'd rather keep it quiet gray.",
      `<p class="verdict">Verdict, 2 Jul: yes (rode along with the B pick). Built — closes the V1 quirk.</p>`)}
    ${card("RD5", "Title-row actions (not mocked — a question)",
      "today Back / Edit recipe / More stack as three full-width bars eating the top third of the screen. Proposal: “‹ Recipes” becomes a quiet text link (the tabbar already gets you back) and Edit + More share one row — same actions, half the height.",
      "<code>RD5: yes</code> · <code>RD5: keep</code>.",
      `<p class="verdict" style="background:var(--amber-soft);color:#7a5a17">Still open — not answered in round 4; the title row is untouched. Say RD5: yes and it rides before merge.</p>`)}
  </div>
</section>

<section class="screen-sec">
  <h2>Round 3 — Recipes library + editor: merged &amp; deployed (PR #21)</h2>
  <p class="lede">Built per your verdicts (RC1: A without the serves line, RC2: yes, RC3: sample data removed outright, RC4: A, RC5: full-width), verified 22/22 with a live save round-trip, merged 2 Jul. Bonus fix: the “Recipe saved.” confirmation now actually displays (it was being wiped by the post-save reload since before the reflow).</p>
  <div class="shots">${phone("AB-recipes-list.jpg", "Library as built — 390px")}${phone("AB-recipes-editor.jpg", "Editor as built — 390px")}${phone("AB-recipes-editor-save.jpg", "Editor as built — full-width save")}${phone("AB-recipes-desktop.jpg", "Desktop split view as built — 1280px", { wide: true })}</div>
</section>

<div class="index">
  <h3>Code index — for quick replies</h3>
  <table>
    <tr class="dim"><td>RD1</td><td>Detail rows — verdict: B flat rows, both lists (built)</td></tr>
    <tr class="dim"><td>RD2</td><td>Full-width teal Start cooking — verdict: yes (built)</td></tr>
    <tr class="dim"><td>RD3</td><td>Header language + 44px stepper — verdict: yes (built)</td></tr>
    <tr class="dim"><td>RD4</td><td>Pantry badge amber text — verdict: yes (built, closes V1 quirk)</td></tr>
    <tr><td>RD5</td><td>Tighter title-row actions — STILL OPEN, unanswered</td></tr>
    <tr class="dim"><td>RC1–RC5</td><td>Round 3, resolved: A cards no serves line · header language · sample data removed · A editor · full-width save (merged, PR #21)</td></tr>
    <tr class="dim"><td>ST1–ST3 · V1–V2</td><td>Round 2, resolved (shipped, PRs #19–#20)</td></tr>
    <tr class="dim"><td>T1–T4</td><td>Still open from round 1: settings gear · plan-less Today · amber link hover · 640px desktop column</td></tr>
    <tr class="dim"><td>P1–P3</td><td>Still open from round 1: inline sheets · generate-is-a-link · filter pills kept</td></tr>
    <tr class="dim"><td>S1–S2</td><td>Still open from round 1: Regenerate button kept · On-hand collapsed</td></tr>
    <tr class="dim"><td>C2</td><td>Still open from round 1: “Done — mark cooked” writes nothing</td></tr>
  </table>
</div>

<p class="foot">After this pass, milestone 7 is done; next in line are the ten open round-1 pins above, then the standing follow-ups (settings-defaults source of truth, ESLint + CI lint, npm-audit triage, Actions Node-20 bump). Shots captured on the local Supabase stack with sample data — your household data was not touched. For the real thumb feel: <code>npm run dev:phone</code> on your iPhone. No code changes until you reply.</p>
</div>
`;

fs.writeFileSync(path.join(DIR, "review-board-r4.html"), html);
console.log("review-board-r4.html:", (fs.statSync(path.join(DIR, "review-board-r4.html")).size / 1024 / 1024).toFixed(2), "MB");
