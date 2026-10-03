// Milestone 18: one-time backfill that writes ingredient amounts into existing
// recipe steps (insert-only, owner-reviewed). Spec: docs/plans/amounts-in-steps.md.
//
//   export   --target local|prod --out <dir>   read recipes into <dir>/snapshot.json (read-only)
//   propose  --out <dir> [--responses <file>] [--limit <n>]
//            ask the model (or replay canned responses) for insert-only rewrites;
//            writes <dir>/proposals.json and <dir>/review.html
//   sql      --out <dir> [--exclude <codes>]   write apply.sql, rehearsal.sql, revert.sql,
//            check.sql and applied-steps.json for every accepted, non-excluded step
//
// This script never writes to a database. `export` runs one read-only SELECT
// through psql; the generated SQL files are run by a person, by hand, with psql.
// --out must be outside the repo: snapshots and proposals hold household data.
// Run with: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/backfill-step-amounts.mjs ...
// (Node >= 23.6 loads the two imported .ts files with built-in type stripping.)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatIngredientAmount } from "../lib/grocery.ts";
import {
  BACKFILL_JSON_SCHEMA,
  BACKFILL_MODEL,
  BACKFILL_SYSTEM_PROMPT,
  auditInsertions,
  buildApplySql,
  buildBackfillUserContent,
  buildCheckSql,
  checkInsertOnly,
  parseBackfillResponse,
} from "../lib/step-amounts.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PSQL = "/opt/homebrew/opt/libpq/bin/psql";
const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
// Claude Haiku 4.5 list price per million tokens (checked 2026-10-02).
const USD_PER_MTOK_IN = 1;
const USD_PER_MTOK_OUT = 5;

const EXPORT_SQL = `
select coalesce(json_agg(r order by r.name, r.id), '[]'::json)
from (
  select rec.id, rec.name, rec.base_servings::float8 as base_servings,
    (select coalesce(json_agg(json_build_object(
              'name', i.name, 'amount', i.amount::float8, 'unit_code', i.unit_code, 'unit_label', u.label)
            order by i.created_at, i.id), '[]'::json)
       from public.ingredients i join public.units u on u.code = i.unit_code
      where i.recipe_id = rec.id) as ingredients,
    (select json_agg(json_build_object('id', s.id, 'step_number', s.step_number, 'body', s.body)
            order by s.step_number)
       from public.recipe_steps s
      where s.recipe_id = rec.id) as steps
  from public.recipes rec
  where exists (select 1 from public.recipe_steps s2 where s2.recipe_id = rec.id)
) r`;

function die(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    if (!rest[i].startsWith("--")) die(`Unexpected argument ${rest[i]}`);
    options[rest[i].slice(2)] = rest[i + 1];
    i += 1;
  }
  return { command, options };
}

function resolveOut(dir) {
  if (!dir) die("--out <dir> is required.");
  const abs = path.resolve(dir.replace(/^~(?=$|\/)/, os.homedir()));
  if (abs === REPO_ROOT || abs.startsWith(REPO_ROOT + path.sep)) {
    die("--out must be outside the repo (snapshots and proposals hold household data).");
  }
  fs.mkdirSync(abs, { recursive: true });
  return abs;
}

// Reads one key from .env.local without printing it.
function readEnvLocal(key) {
  const file = path.join(REPO_ROOT, ".env.local");
  if (!fs.existsSync(file)) return undefined;
  const line = fs.readFileSync(file, "utf8").split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  if (!line) return undefined;
  return line.slice(key.length + 1).trim().replace(/^(["'])(.*)\1$/, "$2") || undefined;
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------- export

function runExport(options) {
  const out = resolveOut(options.out);
  const target = options.target;
  if (target !== "local" && target !== "prod") die("--target must be local or prod.");
  const url = target === "local" ? LOCAL_DB : readEnvLocal("DATABASE_URL");
  if (!url) die("DATABASE_URL is missing from .env.local.");
  console.log(`Exporting from ${target === "local" ? "the LOCAL stack (127.0.0.1:54322)" : "PROD (DATABASE_URL from .env.local)"} ...`);
  const raw = execFileSync(PSQL, [url, "-X", "-v", "ON_ERROR_STOP=1", "-At", "-c", EXPORT_SQL], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const recipes = JSON.parse(raw);
  writeJson(path.join(out, "snapshot.json"), { exported_at: new Date().toISOString(), target, recipes });
  const steps = recipes.reduce((sum, r) => sum + r.steps.length, 0);
  console.log(`Wrote snapshot.json: ${recipes.length} recipes with steps, ${steps} steps.`);
}

// ---------------------------------------------------------------- propose

async function callModel(apiKey, userContent) {
  const body = JSON.stringify({
    model: BACKFILL_MODEL,
    max_tokens: 8192,
    temperature: 0,
    system: BACKFILL_SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: BACKFILL_JSON_SCHEMA } },
    messages: [{ role: "user", content: userContent }],
  });
  const post = () =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(60_000),
    });
  let res = await post();
  if (res.status === 429 || res.status === 529) {
    await sleep(2000);
    res = await post();
  }
  if (!res.ok) throw new Error(`API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const payload = await res.json();
  if (payload.stop_reason === "max_tokens") throw new Error("The response was cut off (max_tokens).");
  if (payload.stop_reason === "refusal") throw new Error("The model declined this recipe.");
  const text = payload.content?.find((block) => block?.type === "text")?.text;
  if (typeof text !== "string") throw new Error("The response had no text block.");
  return {
    json: JSON.parse(text),
    usage: { input: payload.usage?.input_tokens ?? 0, output: payload.usage?.output_tokens ?? 0 },
  };
}

async function runPropose(options) {
  const out = resolveOut(options.out);
  const snapshotFile = path.join(out, "snapshot.json");
  if (!fs.existsSync(snapshotFile)) die(`No snapshot.json in ${out}. Run export first.`);
  const snapshot = readJson(snapshotFile);
  const canned = options.responses ? readJson(path.resolve(options.responses)) : null;
  const apiKey = canned ? null : process.env.ANTHROPIC_API_KEY || readEnvLocal("ANTHROPIC_API_KEY");
  if (!canned && !apiKey) die("ANTHROPIC_API_KEY is not set (env or .env.local).");
  const limit = options.limit ? Number(options.limit) : snapshot.recipes.length;
  const recipes = snapshot.recipes.slice(0, limit);
  const width = Math.max(2, String(recipes.length).length);
  const usage = { input: 0, output: 0 };
  const results = [];

  for (const [index, recipe] of recipes.entries()) {
    const code = `R${String(index + 1).padStart(width, "0")}`;
    const ingredients = recipe.ingredients.map((ing) => ({
      name: ing.name,
      amount: ing.amount,
      amountText: formatIngredientAmount(ing.amount, ing.unit_label),
    }));
    const entry = {
      code,
      id: recipe.id,
      name: recipe.name,
      base_servings: recipe.base_servings,
      ingredients: ingredients.map(({ name, amountText }) => ({ name, amountText })),
      status: "ok",
      reason: null,
      steps: [],
    };
    const keep = (step, status, reason, proposal) => ({
      code: `${code}.${step.step_number}`,
      step_id: step.id,
      step_number: step.step_number,
      original: step.body,
      proposal,
      status,
      reason,
      final: step.body,
      segments: [{ text: step.body, inserted: false }],
      insertions: [],
      flags: [],
    });

    let json = null;
    try {
      if (canned) {
        json = canned[recipe.name];
        if (json === undefined) {
          entry.status = "skipped";
          entry.reason = "No canned response for this recipe.";
        }
      } else {
        const userContent = buildBackfillUserContent({
          name: recipe.name,
          base_servings: recipe.base_servings,
          ingredients: entry.ingredients,
          steps: recipe.steps.map((s) => ({ step_number: s.step_number, body: s.body })),
        });
        const result = await callModel(apiKey, userContent);
        json = result.json;
        usage.input += result.usage.input;
        usage.output += result.usage.output;
      }
    } catch (error) {
      entry.status = "rejected";
      entry.reason = String(error.message ?? error);
    }

    if (entry.status === "ok") {
      const parsed = parseBackfillResponse(json, recipe.steps.map((s) => s.step_number));
      if (!parsed.ok) {
        entry.status = "rejected";
        entry.reason = parsed.reason;
      } else {
        for (const step of recipe.steps) {
          const proposal = parsed.bodies.get(step.step_number);
          const guard = checkInsertOnly(step.body, proposal);
          if (!guard.ok) {
            entry.steps.push(keep(step, "rejected", guard.reason, proposal));
          } else if (!guard.changed) {
            entry.steps.push(keep(step, "unchanged", null, proposal));
          } else {
            entry.steps.push({
              ...keep(step, "accepted", null, proposal),
              final: guard.final,
              segments: guard.segments,
              insertions: guard.insertions,
              flags: auditInsertions(guard.insertions, ingredients),
            });
          }
        }
      }
    }
    if (entry.status !== "ok") {
      entry.steps = recipe.steps.map((step) => keep(step, "kept", null, null));
    }
    results.push(entry);
    console.log(`${code} ${recipe.name}: ${entry.status === "ok" ? summarizeSteps(entry.steps) : `${entry.status} (${entry.reason})`}`);
  }

  const estimatedUsd = (usage.input * USD_PER_MTOK_IN + usage.output * USD_PER_MTOK_OUT) / 1_000_000;
  const proposals = {
    generated_at: new Date().toISOString(),
    source: snapshot.target,
    model: canned ? "canned responses" : BACKFILL_MODEL,
    usage: { ...usage, estimated_usd: Number(estimatedUsd.toFixed(4)) },
    recipes: results,
  };
  writeJson(path.join(out, "proposals.json"), proposals);
  fs.writeFileSync(path.join(out, "review.html"), renderReview(proposals));
  const all = results.flatMap((r) => r.steps);
  console.log(
    `\n${results.length} recipes: ${count(all, "accepted")} steps get amounts, ${count(all, "unchanged")} unchanged, ` +
      `${count(all, "rejected") + count(all, "kept")} kept as is, ${all.filter((s) => s.flags.length > 0).length} flagged.`,
  );
  console.log(`Tokens: ${usage.input} in / ${usage.output} out, about $${estimatedUsd.toFixed(4)}.`);
  console.log(`Wrote proposals.json and review.html in ${out}`);
}

const count = (steps, status) => steps.filter((s) => s.status === status).length;
const summarizeSteps = (steps) =>
  `${count(steps, "accepted")} accepted, ${count(steps, "unchanged")} unchanged, ${count(steps, "rejected")} rejected`;

// ---------------------------------------------------------------- review page

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const STATUS_LABEL = {
  accepted: ["ok", "amounts added"],
  unchanged: ["", "no change"],
  rejected: ["bad", "kept as is"],
  kept: ["bad", "kept as is"],
};

function renderStep(step) {
  const [tone, label] = STATUS_LABEL[step.status];
  const text = step.segments
    .map((segment) => (segment.inserted ? `<ins>${escapeHtml(segment.text)}</ins>` : escapeHtml(segment.text)))
    .join("");
  const flags = step.flags.length
    ? `<ul class="flags">${step.flags.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`
    : "";
  const reason = step.reason ? `<p class="reason">Why: ${escapeHtml(step.reason)}</p>` : "";
  const rejected =
    step.status === "rejected" && typeof step.proposal === "string"
      ? `<details><summary>The rejected proposal</summary><p class="proposal">${escapeHtml(step.proposal)}</p></details>`
      : "";
  return `<li class="step" id="${step.code}"><div class="step-head"><span class="code">${step.code}</span><span class="chip ${tone}">${label}</span>${step.flags.length ? '<span class="chip flag">check</span>' : ""}</div><p class="body">${text}</p>${flags}${reason}${rejected}</li>`;
}

function renderRecipe(recipe) {
  const accepted = count(recipe.steps, "accepted");
  const headline =
    recipe.status === "ok"
      ? `<span class="chip ${accepted ? "ok" : ""}">${accepted} of ${recipe.steps.length} steps get amounts</span>`
      : `<span class="chip bad">kept as is</span>`;
  const reason = recipe.status === "ok" ? "" : `<p class="reason">Why: ${escapeHtml(recipe.reason)}</p>`;
  const ingredients = recipe.ingredients
    .map((ing) => `<li>${escapeHtml(ing.name)}: ${escapeHtml(ing.amountText)}</li>`)
    .join("");
  return `<article class="recipe" id="${recipe.code}"><header><span class="code">${recipe.code}</span><h2>${escapeHtml(recipe.name)}</h2>${headline}</header>${reason}<details class="ings"><summary>Ingredients (${recipe.ingredients.length}) at ${escapeHtml(recipe.base_servings)} servings</summary><ul>${ingredients}</ul></details><ol class="steps">${recipe.steps.map(renderStep).join("")}</ol></article>`;
}

function renderReview(proposals) {
  const steps = proposals.recipes.flatMap((r) => r.steps);
  const look = steps.filter((s) => s.flags.length > 0 || s.status === "rejected");
  const lookList = look.length
    ? `<p class="look">Worth a look first: ${look.map((s) => `<a href="#${s.code}">${s.code}</a>`).join(", ")}</p>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Step amounts review</title>
<style>
:root {
  --bg: #fafaf8; --surface: #ffffff; --ink: #16211e; --muted: #5e6b67; --line: #e4e6e1;
  --brand: #12695e; --ok-bg: #e3eeeb; --ins-bg: #f6e8cf; --ins-ink: #7a5a17;
  --bad-bg: #f3e3e3; --bad-ink: #a13c3c;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #131a18; --surface: #1d2724; --ink: #f3f6f4; --muted: #9fb0aa; --line: #2a3733;
    --brand: #8fd1c4; --ok-bg: #24413b; --ins-bg: #4d3b12; --ins-ink: #f6e8cf;
    --bad-bg: #4a2626; --bad-ink: #f0b9b9;
  }
}
:root[data-theme="dark"] {
  --bg: #131a18; --surface: #1d2724; --ink: #f3f6f4; --muted: #9fb0aa; --line: #2a3733;
  --brand: #8fd1c4; --ok-bg: #24413b; --ins-bg: #4d3b12; --ins-ink: #f6e8cf;
  --bad-bg: #4a2626; --bad-ink: #f0b9b9;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow-wrap: anywhere; }
main { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
.summary, .look, .reason { color: var(--muted); }
.howto { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; margin: 12px 0 20px; }
.recipe { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; margin: 0 0 16px; }
.recipe header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.recipe h2 { font-size: 1.1rem; margin: 0; flex: 1 1 auto; }
.code { font-weight: 800; font-variant-numeric: tabular-nums; color: var(--brand); }
.chip { font-size: 0.78rem; font-weight: 700; border-radius: 999px; padding: 2px 8px; background: var(--line); color: var(--muted); }
.chip.ok { background: var(--ok-bg); color: var(--brand); }
.chip.bad { background: var(--bad-bg); color: var(--bad-ink); }
.chip.flag { background: var(--ins-bg); color: var(--ins-ink); }
.ings { margin: 8px 0; color: var(--muted); }
.steps { list-style: none; margin: 8px 0 0; padding: 0; border-top: 1px solid var(--line); }
.step { padding: 10px 0; border-bottom: 1px solid var(--line); }
.step-head { display: flex; gap: 8px; align-items: center; }
.body { margin: 6px 0 0; }
ins { background: var(--ins-bg); color: var(--ins-ink); text-decoration: none; font-weight: 700; border-radius: 4px; padding: 0 3px; }
.flags { margin: 6px 0 0; padding-left: 18px; color: var(--ins-ink); }
.proposal { color: var(--muted); }
a { color: var(--brand); }
</style>
</head>
<body>
<main>
<h1>Step amounts review</h1>
<p class="summary">Recipes: ${proposals.recipes.length}. Steps with amounts added: ${count(steps, "accepted")}. No change needed: ${count(steps, "unchanged")}. Left as they are: ${count(steps, "rejected") + count(steps, "kept")}. Source: ${escapeHtml(proposals.source)}, ${escapeHtml(proposals.model)}.</p>
<div class="howto">Highlighted text is the only thing that would be added. Reply in chat with <b>apply</b> to write every highlighted step, or with codes to leave things out, for example <b>apply, exclude R03.2, R11</b> (one step, then a whole recipe). Nothing is written until you say apply.</div>
${lookList}
${proposals.recipes.map(renderRecipe).join("\n")}
</main>
</body>
</html>
`;
}

// ---------------------------------------------------------------- sql

function runSql(options) {
  const out = resolveOut(options.out);
  const proposalsFile = path.join(out, "proposals.json");
  if (!fs.existsSync(proposalsFile)) die(`No proposals.json in ${out}. Run propose first.`);
  const proposals = readJson(proposalsFile);
  const known = new Set(proposals.recipes.flatMap((r) => [r.code, ...r.steps.map((s) => s.code)]));
  const excluded = (options.exclude ?? "")
    .split(/[\s,]+/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  for (const code of excluded) if (!known.has(code)) die(`Unknown code ${code}. Nothing written.`);
  const skip = new Set(excluded);

  const applied = [];
  for (const recipe of proposals.recipes) {
    if (recipe.status !== "ok" || skip.has(recipe.code)) continue;
    for (const step of recipe.steps) {
      if (step.status !== "accepted" || skip.has(step.code)) continue;
      applied.push({ code: step.code, recipe: recipe.name, step_id: step.step_id, old_body: step.original, new_body: step.final });
    }
  }
  if (applied.length === 0) {
    console.log("Nothing to apply. No files written.");
    return;
  }
  const rows = applied.map(({ step_id, old_body, new_body }) => ({ step_id, old_body, new_body }));
  const reverse = rows.map(({ step_id, old_body, new_body }) => ({ step_id, old_body: new_body, new_body: old_body }));
  fs.writeFileSync(path.join(out, "apply.sql"), buildApplySql(rows, "COMMIT", "apply"));
  fs.writeFileSync(path.join(out, "rehearsal.sql"), buildApplySql(rows, "ROLLBACK", "rehearsal (rolls back)"));
  fs.writeFileSync(path.join(out, "revert.sql"), buildApplySql(reverse, "COMMIT", "revert (restores the reviewed originals)"));
  fs.writeFileSync(path.join(out, "check.sql"), buildCheckSql(rows));
  writeJson(path.join(out, "applied-steps.json"), { generated_at: new Date().toISOString(), excluded, steps: applied });
  const recipeCount = new Set(applied.map((a) => a.recipe)).size;
  console.log(`${applied.length} steps across ${recipeCount} recipes. Excluded: ${excluded.length ? excluded.join(", ") : "none"}.`);
  console.log(`Wrote apply.sql, rehearsal.sql, revert.sql, check.sql, applied-steps.json in ${out}`);
}

// ---------------------------------------------------------------- main

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "export") runExport(options);
  else if (command === "propose") await runPropose(options);
  else if (command === "sql") runSql(options);
  else die("Usage: backfill-step-amounts.mjs <export|propose|sql> --out <dir> [options]");
}

main().catch((error) => {
  console.error("FAILED:", error);
  process.exitCode = 1;
});
