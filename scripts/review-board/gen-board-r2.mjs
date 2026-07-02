// Round-2 review board (v2 sweep): part-1 before/after + Settings direction mocks.
// Reuses the round-1 board's visual system (scripts/review-board/gen-board.mjs).
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
  return `<article class="card" id="${code}">
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
  .legend{display:flex;gap:18px;flex-wrap:wrap;color:var(--muted);font-size:13.5px;align-items:center}
  .legend .pin-badge{position:static;transform:none}
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
  <h1>Review board — round 2: the v2 sweep</h1>
  <p class="sub">All round-2 verdicts are in (2 Jul: “they all look good”, direction delegated). <strong>Part 1 is merged and deployed</strong> (PR #19). The Settings pass is <strong>built per the verdicts and sitting on PR #20 with the as-built shots below — awaiting your merge word</strong>. Next up in part 2: Recipes library + editor.</p>
</header>

<div class="howto">
  <p><strong>How to give feedback:</strong> reply in chat using the pin codes — anything here can still be overturned before (or after) merge.</p>
  <p class="reply"><code>AB: merge it · or e.g. “rows: tighter dividers” / “save: back to fit-content”</code></p>
  <p><strong>What happens next:</strong> your merge word ships Settings; then the Recipes library/editor pass opens the same way (mocks → verdicts → build).</p>
</div>

<section class="screen-sec round">
  <h2>Settings — as built (PR #20, CI-checked, awaiting merge)</h2>
  <p class="lede">The real branch on the local stack — verdicts ST1: B, ST2: full-width, ST3: yes, implemented behavior-neutral (same form logic; a live save round-trip was verified). Compare against the mocks below.</p>
  <div class="shots">${phone("AB-settings.jpg", "Settings as built — 390px")}${phone("AB-settings-desktop.jpg", "Settings as built — desktop, 640px column", { wide: true })}</div>
</section>

<section class="screen-sec round">
  <h2>Part 1 — the token fix, as built</h2>
  <p class="lede">Every hardcoded old-palette value in <code>globals.css</code> is now a v2 token (PR #19; 22/22 computed-style assertions on the local stack, zero console errors). Left of each pair is a reconstruction of the old values for comparison — right is the real branch. Two judgment calls need your eyes:</p>
  <div class="shots">${phone("SET-before.jpg", "Settings before — cream panels (reconstruction)")}${phone("settings.jpg", "Settings after — real branch, v2 surfaces")}</div>
  <div class="shots">${phone("DET-before.jpg", "Recipe detail before — cream borders, tan badge (reconstruction)")}${phone("recipe-detail-top.jpg", "Recipe detail after — real branch, amber badge")}</div>
  <div class="cards">
    ${card("V1", "Pantry badge went amber", "the old tan one-off palette maps to the v2 amber set (the leftover pill's colors) with a visible <strong>amber outline</strong>, mirroring how active chips get a strong border on a soft tint. Note: its text renders muted gray for now — a pre-existing CSS quirk the part-2 recipe-detail pass will resolve.", "keep the amber outline, or prefer it quieter (outline matching the fill)?", `<p class="verdict">Verdict, 2 Jul: keep. Shipped in PR #19.</p>`)}
    ${card("V2", "Mobile panels: opaque white", "the translucent cream mobile panels (92% alpha) are now opaque white — the same surface as desktop. Nothing sits behind panels, so translucency changed nothing visible; the soft shadow stays.", "any objection?", `<p class="verdict">Verdict, 2 Jul: fine. Shipped in PR #19.</p>`)}
  </div>
</section>

<section class="screen-sec">
  <h2>Settings — part 2 opens here. Pick a direction.</h2>
  <p class="lede">These are CSS-injected mocks on the live app (the data and form behavior are real; no app code has changed). Both adopt the cycle screens' language: a "Settings" page title, uppercase card labels, 44px thumb targets, and a full-width save. They differ in how the form reads.</p>
  <div class="shots">${phone("settings.jpg", "Today, after part 1 — for reference")}${phone("SET-A.jpg", "Variant A — stacked labels (mock)")}${phone("SET-B.jpg", "Variant B — iOS-style rows (mock)")}</div>
  <div class="cards">
    <article class="card proposal" id="ST1">
      <div class="card-head"><span class="pin-badge">ST1</span><h4>Form language: A or B</h4></div>
      <p class="shipped"><strong>A</strong> keeps today's stacked structure and just dresses it in v2 (labels above full-width controls). <strong>B</strong> restructures each setting into an iOS-style row — label left, control right, hairline dividers — the most "installed app" reading, and the whole form fits one thumb-reach.</p>
      <p class="ask"><code>ST1: A</code> · <code>ST1: B</code> · <code>ST1: keep</code> — or describe a blend.</p>
      <p class="verdict">Verdict, 2 Jul: B (recommendation accepted). Built in PR #20 — see “as built” above.</p>
    </article>
    ${card("ST2", "Save button treatment", "both mocks show Save as a full-width chunky teal bar, like Plan's “Generate grocery list” exit.", "full-width or fit-content?", `<p class="verdict">Verdict, 2 Jul: full-width. Built in PR #20.</p>`)}
    ${card("ST3", "Page title + card labels", "both mocks add the “Settings” page title and uppercase ACCOUNT / PLANNING DEFAULTS card labels — the same header language as Today/Plan/Shop.", "adopt the header language?", `<p class="verdict">Verdict, 2 Jul: yes. Built in PR #20.</p>`)}
  </div>
</section>

<div class="index">
  <h3>Code index — for quick replies</h3>
  <table>
    <tr class="dim"><td>V1</td><td>Pantry badge amber outline — verdict: keep (shipped, PR #19)</td></tr>
    <tr class="dim"><td>V2</td><td>Opaque white mobile panels — verdict: fine (shipped, PR #19)</td></tr>
    <tr class="dim"><td>ST1</td><td>Settings form language — verdict: B, iOS rows (built, PR #20)</td></tr>
    <tr class="dim"><td>ST2</td><td>Full-width teal Save — verdict: yes (built, PR #20)</td></tr>
    <tr class="dim"><td>ST3</td><td>Page title + card labels — verdict: yes (built, PR #20)</td></tr>
    <tr class="dim"><td>T1–T4</td><td>Still open from round 1: settings gear · plan-less Today · amber link hover · 640px desktop column</td></tr>
    <tr class="dim"><td>P1–P3</td><td>Still open from round 1: inline sheets · generate-is-a-link · filter pills kept</td></tr>
    <tr class="dim"><td>S1–S2</td><td>Still open from round 1: Regenerate button kept · On-hand collapsed</td></tr>
    <tr class="dim"><td>C2</td><td>Still open from round 1: “Done — mark cooked” writes nothing</td></tr>
  </table>
</div>

<p class="foot">Round-1 details live in docs/design-flags.md; the round-1 board's content is preserved there and in docs/progress-log.md. Shots captured on the local Supabase stack with sample data — your household data was not touched. For the real thumb feel: <code>npm run dev:phone</code> on your iPhone. No code changes until you say go.</p>
</div>
`;

fs.writeFileSync(path.join(DIR, "review-board-r2.html"), html);
console.log("review-board-r2.html:", (fs.statSync(path.join(DIR, "review-board-r2.html")).size / 1024 / 1024).toFixed(2), "MB");
