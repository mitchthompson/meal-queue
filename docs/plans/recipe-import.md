# Recipe Import — build spec for handoff

**Audience:** this plan will be executed by a lower-capability builder model. Everything is spelled out. Builder: follow it literally; where it says STOP, stop and ask. Where a value or behavior is not specified here, do NOT invent it — flag it in `docs/design-flags.md` and ask. A senior-model review (Phase D) happens before anything merges.

---

## 1. Context (why)

Recipes are added today via the MCP server in a Claude Code session (Claude parses; the `save-recipe` tool writes). Mitchell wants in-app import, iPhone-first: **(a)** paste recipe text (primary — NYT Cooking is paywalled; fetching it fails even server-side) and **(b)** fetch an open-site URL. Flow: parse → review/edit on a dedicated screen → save.

**Owner decisions (locked, do not revisit):**
| Decision | Choice |
|---|---|
| Parser | LLM: Claude Haiku 4.5, pinned id `claude-haiku-4-5-20251001`, server-side call |
| Scope v1 | Both paste + URL, one surface, paste-first |
| Device | iPhone-first (390px), works desktop/iPad |
| Provenance | NO schema change; `Source: <url>` prefix inside `instructions_raw` |
| Review UX | Dedicated review screen (NOT prefill of existing editor), original text accessible |
| Design rhythm | Mocks first on the review board (round 5, existing artifact URL) — gates the UI PR only |
| Tags | LLM picks 0–3 from the user's existing tag list only; editable at review |
| API key | Owner has none yet — owner sets it up (Phase B gate) |

**Two architectural firsts** (need an ADR in `docs/decisions.md`): the app's first server-side code (today it is 100% client components — zero API routes, see `docs/routes.md`) and its first paid external dependency (Anthropic API). The route NEVER writes to the database; saving stays client-side through the existing `save_recipe` RPC (auth.uid RLS path).

---

## 2. Builder ground rules (non-negotiable)

1. **Repo root is `/Users/mitchell/Dev/meal-queue/meal-queue`** — one level BELOW the shell cwd. `cd` there explicitly in every command.
2. **Never**: commit, push, merge, install/upgrade any npm dependency, change `supabase/schema.sql` or `supabase/migrations/`, or touch live Supabase data. This feature is deliberately designed to need **zero new npm dependencies and zero schema changes**. If you believe you need either, STOP and ask.
3. **Copy, don't import, from `mcp/`** — it is a walled-off separate package (`docs/architecture.md` §MCP boundary). Ported files get a header comment: `// Ported from mcp/src/lib/<name>.ts (2026-07). mcp/ stays a separate consumer.`
4. **No hardcoded hex/font/spacing** in components — CSS tokens in `app/globals.css` only. A needed-but-missing value goes to `docs/design-flags.md`, never invented.
5. **Conventional Commits**, no `Co-Authored-By`, commits only after owner approval.
6. **Before any multi-file edit sweep, batch-Read every target file first.**
7. Read before building: `lib/hooks/use-recipes.ts`, `app/recipes/page.tsx`, `components/status-message.tsx`, `components/cook-mode.tsx`, `lib/errors.ts`, `lib/constants.ts`, `mcp/src/lib/html-extract.ts`, `mcp/src/lib/recipe-schema.ts`, `mcp/src/lib/pantry-staples.ts`, `mcp/src/tools/fetch-recipe-url.ts`, `scripts/review-board/README.md`, `docs/design-system.md`.
8. Baseline check before starting AND before declaring any phase done: `npm run typecheck && npm run test && npm run lint` (all must pass; vitest currently 16/16).
9. `rtk` proxies shell commands; if output looks truncated, rerun as `rtk proxy <cmd>`.

**STOP points (wait for the owner):** ① after Phase A mocks are deployed (owner pins verdicts); ② before Phase B can be smoke-tested (owner must provision `ANTHROPIC_API_KEY`); ③ before ANY commit; ④ Phase D senior review before any merge.

---

## 3. Phase 0 — persist this plan

**Done (2026-07-03 planning wrap)** — this file IS `docs/plans/recipe-import.md`. Builder starts at Phase A (and Phase B in parallel), after reading the ground-rule files in §2.

---

## 4. Phase A — review-board round 5 (mocks; no PR; parallel with Phase B)

Follow `scripts/review-board/README.md` exactly (local app at 390px, reviewer account `reviewer@local.test`, seeded data, `*.supabase.co` blocked, screenshots pinned on a board artifact). Clone `capture-recipes-variants.mjs` → `capture-import-variants.mjs` and the latest `gen-board-r*.mjs` → `gen-board-r5.mjs`. **Redeploy to the EXISTING artifact URL (🍳 favicon) — never mint a new link.** Mocks are DOM/CSS injections on the live local app, not code changes to the app itself.

Mock set + pin questions:
| Pin | Mock | Question for owner |
|---|---|---|
| IM1 | A: stacked surface (big paste textarea → "— or —" → URL field → full-width teal "Import recipe"). B: Paste/Link mode pills, one input at a time | A or B? Paste-first order confirmed? |
| IM2 | Parsing state: inputs locked, button "Reading recipe…", thin teal indeterminate bar, Cancel text-btn, aria-live "This can take about 15 seconds." | Right wait treatment? |
| IM3 | Paywall response as amber callout ("That site blocked us — paste the recipe text instead", focus to textarea, URL kept) vs plain red error | Amber redirect over red error? |
| IM4 | Review screen. A: collapsible "Original text" `<details>` above the editable form. B: Parsed/Original toggle pills | A or B on the phone? |
| IM5 | Review bottom: full-width teal "Save recipe" + muted note "The original text is saved with the recipe." + provenance line "Imported from cooking.nytimes.com" | OK? |
| IM6 | (text pin) `instructions_raw` = original text (+ `Source: <url>` first line), not editable at review | OK? |
| IM7 | Entry button: "Import" `.secondary-btn` next to "New recipe" vs in the page head | Placement? |

STOP ① — owner pins verdicts. Verdicts gate Phase C only; Phase B proceeds meanwhile.

---

## 5. Phase B — PR 1: `codex/import-api` (server route, merges inert)

Branch `codex/import-api`. New directory `lib/import/` + the route. Build in this order (each file compiles + its tests pass before the next):

### B1. `lib/import/schema.ts` — the draft contract
Port from `mcp/src/lib/recipe-schema.ts` (zod is already a dep):
- `VALID_UNIT_CODES = ["tsp","tbsp","cup","fl_oz","ml","l","oz","lb","g","kg","item","clove","slice"] as const` — must equal `DEFAULT_UNITS` codes in `lib/constants.ts`; add a test asserting that.
- `ingredientSchema = z.object({ name: z.string().min(1), amount: z.number().min(0), unit_code: z.enum(VALID_UNIT_CODES), is_pantry_staple: z.boolean() })`
- `recipeDraftSchema = z.object({ name: z.string().min(1), base_servings: z.number().positive(), instructions_raw: z.string(), tags: z.array(z.string()), ingredients: z.array(ingredientSchema).min(1), steps: z.array(z.string()) })`; export `type RecipeDraft = z.infer<...>`.
- `importRequestSchema`: `{ text?: string (≤25000 chars), url?: string (≤2000, must start http:// or https://), tags: z.array(z.string().max(40)).max(50).default([]) }` + `.refine`: exactly one of text|url present.
- `DRAFT_JSON_SCHEMA`: a plain-object JSON Schema used for the LLM structured output. Top level: `{ anyOf: [ <draft object schema>, { type:"object", properties:{ no_recipe:{ const:true } }, required:["no_recipe"], additionalProperties:false } ] }`. Rules: `additionalProperties:false` on every object, NO numeric min/max constraints, `enum` for `unit_code`. Do NOT include `instructions_raw` in the LLM schema — the server composes it (see B6); the LLM draft object is `{name, base_servings, tags, ingredients, steps}` only.
- Response types: `ImportSuccess = { draft: RecipeDraft, original_text: string, meta: { source:"url"|"paste", extraction:"json-ld"|"text"|null, model:string, input_tokens:number, output_tokens:number } }`; `ImportFailure = { error: { code: string, message: string } }`.

### B2. `lib/import/errors.ts`
```ts
export class ImportError extends Error { constructor(public code: ImportErrorCode, public status: number, message: string) { super(message); } }
```
Exact taxonomy (message strings verbatim — the client shows them via `toErrorMessage()` passthrough; do not edit `lib/errors.ts`):
| code | status | message |
|---|---|---|
| `invalid_request` | 400 | Provide a recipe URL or pasted recipe text (not both). |
| `text_too_long` | 400 | That's a lot of text — paste just the recipe portion. |
| `unauthorized` | 401 | Your session has expired — sign in again. |
| `fetch_failed` | 422 | Couldn't fetch that page. Check the URL, or paste the recipe text instead. |
| `paywall_or_blocked` | 422 | That site blocked the request (likely a paywall). Copy the recipe text from the page and paste it instead. |
| `no_recipe_found` | 422 | Couldn't find a recipe in that content. Try pasting just the recipe text. |
| `llm_failure` | 502 | The recipe parser is unavailable right now — try again in a minute. |
| `llm_output_invalid` | 502 | The parser returned something unusable — try again, or paste cleaner text. |
| `not_configured` | 500 | Recipe import isn't set up yet (missing ANTHROPIC_API_KEY). |

### B3. `lib/import/html-extract.ts` — cheerio-free port of `mcp/src/lib/html-extract.ts`
NO new dependency. Exports:
- `extractJsonLdBlocks(html: string): unknown[]` — regex `/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi`, `JSON.parse` each match body, skip parse failures.
- `findRecipeInJsonLd(data: unknown): object | null` — port UNCHANGED from mcp (pure JSON walking: direct `@type:"Recipe"`, `@type` arrays containing `"Recipe"`, `@graph` arrays, top-level arrays, recursive).
- `htmlToText(html: string): string` — remove `<script>/<style>/<nav>/<header>/<footer>/<aside>...</...>` blocks (regex, non-greedy, gi); if a `<main>`/`<article>`/`role="main"` slice matches, prefer its content; strip remaining tags; decode `&amp; &lt; &gt; &quot; &#39; &nbsp;`; collapse whitespace; truncate 8000 chars.
- `extractTitle(html: string): string | null` — `<title>` regex, entity-decoded, trimmed.
- `extractRecipeContent(html): { kind: "json-ld", content: string } | { kind: "text", content: string, title: string | null }` — JSON-LD recipe found → `JSON.stringify(recipe)` capped at **15000 chars**; else text fallback.

### B4. `lib/import/pantry-staples.ts` — verbatim copy of `mcp/src/lib/pantry-staples.ts` (with the provenance header).

### B5. `lib/import/prompt.ts`
- `buildSystemPrompt(existingTags: string[]): string`. Content, in this order:
  1. Role: "You extract exactly one recipe from messy web or pasted content into strict JSON. Output only what the schema allows."
  2. Units: list all 13 codes with meanings; "any other unit (can, package, bunch, pinch, head, stalk, sprig…) → `unit_code:\"item\"` and fold the qualifier into the name, e.g. `black beans (15-oz can)`."
  3. Amounts: decimals only; fractions convert (`1 1/2` → 1.5, `¾` → 0.75); **ranges take the upper bound** (`2-3 tbsp` → 3); `to taste` / `pinch` / `as needed` → `amount: 0` (and usually `is_pantry_staple: true`).
  4. Pantry: the `COMMON_PANTRY_STAPLES` list, "set `is_pantry_staple:true` if the ingredient is or closely matches one of these."
  5. Tags: "Choose 0–3 tags ONLY from this list, verbatim: [list]. If none fit, use []. Never invent a tag." (empty list → "use []").
  6. `base_servings`: stated yield; "serves 4–6" → 4 (lower bound); absent → 4.
  7. Steps: one imperative string per step, no leading numbers, close to source wording.
  8. Ignore ads, comments, navigation, story preamble. If there is no actual recipe, return `{"no_recipe": true}`.
- `buildUserContent(kind: "json-ld" | "text" | "paste", content: string, title?: string | null): string` — labels the payload (e.g. `SOURCE (schema.org JSON-LD):\n...`).

### B6. `lib/import/normalize.ts` — pure, heavily tested
- `clampUnitCode(u: string): UnitCode` — lowercase/trim; alias map at minimum: tablespoon(s)→tbsp, teaspoon(s)→tsp, pound(s)→lb, gram(s)→g, kilogram(s)→kg, ounce(s)→oz, fluid ounce/fl oz→fl_oz, liter/litre→l, milliliter/millilitre→ml, cups→cup, cloves→clove, slices→slice, each/piece/whole→item; unresolvable → `"item"` (NEVER reject an import over a unit).
- `normalizeAmount(n: unknown): number` — non-finite/negative → 0; round to 3 decimals.
- `normalizeServings(n: unknown): number` — invalid → 4; clamp 1–24; round to nearest 0.5.
- `sanitizeTags(raw: string[], allowed: string[]): string[]` — case-insensitive intersect with `allowed`, return canonical casing from `allowed`, dedupe, cap 5.
- `dedupeIngredients(rows)` — key `(name.toLowerCase(), unit_code)`, keep first.
- `normalizeDraft(raw: unknown, allowedTags: string[], sourceUrl: string | null, originalText: string): RecipeDraft` — lenient zod intake (`z.coerce.number()` on numerics, `.catch()` for tags→[]), apply all helpers, trim names/steps, drop empty-name ingredients + empty steps, strip leading `"1. "`/`"Step 1:"` numbering from steps, set `instructions_raw = (sourceUrl ? `Source: ${sourceUrl}\n\n` : "") + originalText`. Abort conditions ONLY: name empty after trim, or zero ingredients after cleanup → throw `ImportError("no_recipe_found",422,…)`. Finish with strict `recipeDraftSchema.parse()`; if THAT throws → `ImportError("llm_output_invalid",502,…)`.

### B7. `lib/import/fetch-page.ts`
- `assertSafeUrl(url: string): void` (pure) — protocol http/https only; reject hostnames: `localhost`, `*.local`, `*.internal`, no-dot bare names; reject IP-literal hosts in `127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, 0.0.0.0, ::1, fc00::/7, fe80::/10`. Comment: DNS-rebinding defense deliberately out of scope (auth-gated single-household; no privileged Vercel-internal network).
- `detectPaywall(html: string, extractedTextLen: number, hasJsonLd: boolean): boolean` (pure) — true if: no JSON-LD AND `extractedTextLen < 400` AND `html.length > 50_000`; OR no JSON-LD AND `/subscri(be|ption)|log in to continue|create a free account|already a subscriber/i` matches within the first 1500 chars of the extracted text.
- `fetchRecipePage(url: string): Promise<{ html: string, finalUrl: string }>` — headers ported from `mcp/src/tools/fetch-recipe-url.ts` (Chrome UA, Accept, Accept-Language), `redirect:"follow"`, `AbortSignal.timeout(10_000)`, reject non-HTML content-type → `no_recipe_found`, stream-read with a 3MB cap. Status 401/403 (or Cloudflare challenge markers) → `paywall_or_blocked`; other non-OK/network/timeout → `fetch_failed`.

### B8. `lib/import/auth.ts`
```ts
export async function verifyUser(req: Request): Promise<string> // user id
```
Bearer token from `Authorization` header (missing → `unauthorized`). `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession:false, autoRefreshToken:false } })` then `supabase.auth.getUser(token)`; error or no user → `unauthorized`. (NEXT_PUBLIC vars are readable server-side; no new Supabase env. Do not import `lib/supabase/client.ts` — it is browser-oriented.)

### B9. `lib/import/anthropic.ts`
Plain `fetch` — NO SDK. `callClaude(system: string, userContent: string): Promise<{ json: unknown, usage: { input_tokens:number, output_tokens:number } }>`:
- Missing `process.env.ANTHROPIC_API_KEY` → `ImportError("not_configured",500,…)`.
- POST `https://api.anthropic.com/v1/messages`, headers `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`.
- Body: `{ model:"claude-haiku-4-5-20251001", max_tokens:4096, temperature:0, system, output_config:{ format:{ type:"json_schema", schema: DRAFT_JSON_SCHEMA } }, messages:[{ role:"user", content:userContent }] }`. (No `effort` param — unsupported on Haiku.)
- `AbortSignal.timeout(45_000)`. One automatic retry after 2s ONLY on HTTP 429/529. Any other non-2xx or abort → `llm_failure`.
- Parse: first `content` block of `type:"text"` → `JSON.parse`. `stop_reason === "max_tokens"` or parse failure → `llm_output_invalid`.

### B10. `app/api/import-recipe/route.ts`
```ts
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request): Promise<Response>
```
Flow: parse+validate body (`importRequestSchema`; failure → `invalid_request` / `text_too_long`) → `verifyUser(req)` → acquire content: **url branch** `assertSafeUrl` → `fetchRecipePage` → `extractRecipeContent` → `detectPaywall` check → `original_text` = extracted content (json-ld: the stringified recipe; text: the fallback text); **paste branch** `original_text = text` (≤25k) → `callClaude(buildSystemPrompt(tags), buildUserContent(...))` → `{"no_recipe":true}` → `no_recipe_found` → `normalizeDraft(json, tags, url ?? null, original_text)` → 200 `ImportSuccess`. Single try/catch: `ImportError` → its status/JSON; anything else → 500 `{error:{code:"llm_failure",message:<llm_failure message>}}`. No DB access anywhere in the route. No module-top-level env reads (build must stay green without the key).

### B11. Tests (`lib/import/*.test.ts`, vitest, colocated like `lib/grocery.test.ts`)
Minimum fixture list:
- html-extract: JSON-LD direct / `@graph` / top-level array / `@type` array / malformed-JSON-skipped; nav-heavy HTML text fallback; entity decoding; 8k truncation; title extraction.
- normalize: every alias in the unit map; unknown unit → item; fraction/range/to-taste amounts (as *already-numeric* inputs — fraction parsing is the LLM's job; test the clamps); tag intersection casing + cap 5; ingredient dedupe; step-numbering strip; source-URL prepend; empty-ingredients → throws no_recipe_found.
- fetch-page pure parts: assertSafeUrl matrix (v4/v6 privates, localhost, ftp:, bare host); detectPaywall three branches.
- schema: valid draft passes zod; `DRAFT_JSON_SCHEMA` structurally mirrors it (spot-assert unit enum + additionalProperties:false + required arrays); VALID_UNIT_CODES === DEFAULT_UNITS codes.
- prompt: output contains all 13 codes, the pantry list marker, the injected tags, the range/upper-bound rule.

### B12. Docs + env (same PR)
- `.env.example`: add `ANTHROPIC_API_KEY=` line.
- `docs/decisions.md` ADR: "First API route + LLM dependency" — records: broken no-server invariant; why (NYT paste + parsing needs LLM); model + pinned id; cost posture (~$0.006–0.01/import, Console spend cap as backstop); auth-gating; relationship to `mcp/` (separate lifecycle, logic copied not shared, not merged now).
- `docs/routes.md`: new "API routes" section with `POST /api/import-recipe`.
- `docs/architecture.md`: server-surface paragraph + Anthropic boundary.
- `docs/roadmap.md`: update the Recipe Import milestone entry (already promoted out of Deferred Ideas at the 2026-07-03 planning wrap) with PR 1 status.

### B13. Verification gate for Phase B
`npm run lint && npm run typecheck && npm run test` all green; `npm run build` green (no key present — proves no build-time env read). Then **STOP ② — owner provisions the key** (steps in §8), then curl smoke on `npm run dev`:
1. Get a token: browser DevTools → Local Storage → `sb-<ref>-auth-token` → `.access_token` (or the sign-in one-liner in §8).
2. Paste path: `curl -s http://localhost:3000/api/import-recipe -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" -d '{"text":"Pancakes. Serves 4. 2 cups flour, 1 1/2 cups milk, 2 eggs, salt to taste. Mix everything. Fry in butter.","tags":["breakfast","under-30-min"]}' | jq` → expect draft with flour amount 2 cup, milk 1.5 cup, salt amount 0 pantry true, tags ⊆ given list.
3. URL path with an open site (e.g. a budgetbytes.com recipe) → draft + `meta.extraction:"json-ld"`.
4. Negatives: no auth header → 401; `{"text":"the weather is nice today"}` → 422 no_recipe_found; both text+url → 400.
Record every transcript for the Phase D review. Then STOP ③ (commit approval).

---

## 6. Phase C — PR 2: `codex/import-ui` (after board verdicts + PR 1 merged)

Branch `codex/import-ui`. Board verdicts (IM1–IM7) override any default below.

### C1. Refactor seam in `lib/hooks/use-recipes.ts` (behavior-neutral — verified clean)
Extract the body of `saveRecipe` **lines 218–245 exactly** (name-trim validation → `supabase.rpc("save_recipe", {...})` → id resolution) into:
```ts
export async function saveRecipeForm(form: RecipeFormState): Promise<string> // saved id; throws on failure
```
in the same file. `saveRecipe` becomes: preventDefault / setSaving / try `const recipeId = await saveRecipeForm(form)` then the UNCHANGED `loadData → setShowEditor(true) → selectRecipe(recipeId) → setMessage("Recipe saved.")` sequence / catch `toErrorMessage` / finally setSaving(false). The editor's observable behavior must be byte-identical.

### C2. `lib/hooks/use-import.ts`
- State: `phase: "closed"|"entry"|"parsing"|"review"`, `sourceText`, `sourceUrl`, `draftForm: RecipeFormState | null`, `originalText`, `sourceHost`, `error`, `errorCode`, `saving`.
- `startParse()`: `supabase.auth.getSession()` → POST `/api/import-recipe` with Bearer token, body `{text?|url?, tags: knownTags}`, AbortController wired to Cancel; on failure read `{error:{code,message}}` — `paywall_or_blocked` sets the amber-callout state (NOT the red error) and keeps the URL; other codes set `error` (message shown via `StatusMessage`).
- Pure export `draftToFormState(draft: RecipeDraft, units: UnitRow[]): RecipeFormState` — `id:null`; numbers → strings; rows built by spreading existing `blankIngredient()` / `blankStep()` and overriding; `unit_code` defensively checked against loaded `units`, fallback `"item"`; `instructions_raw` passed through from the draft (server already composed it). Vitest this mapper.
- `saveDraft()`: `saveRecipeForm(draftForm)` → `router.push('/recipes/' + id)`.

### C3. `components/recipe-import.tsx`
One `ImportFlow` component switching on phase; props from the page: `{ units, knownTags, onClose }` (units/knownTags come from `useRecipes` — no duplicate fetch).
- **Entry** (per IM1 verdict; default A stacked): `.panel` > `.section-head` with `h2.recipes-editor-title` "Import recipe" + back `.text-btn`; paste `label` + `textarea` (placeholder: "Copy the recipe in NYT Cooking, then paste it here."); muted "— or —"; URL `label` + `input type="url"`; full-width teal submit `.recipes-save`-group class "Import recipe", disabled until one field non-empty; hint: pasted text wins if both filled.
- **Parsing** (IM2): fields+submit disabled, button label "Reading recipe…", `.import-progress` indeterminate bar, Cancel `.text-btn`, `StatusMessage message` "Reading the recipe — this can take about 15 seconds."
- **Review** (IM4/IM5/IM6): provenance line (muted) → `<details>` "Original text" (`.recipes-card-label` summary, body `max-height:40vh; overflow-y:auto`, muted) → editable form in the EXACT editor idiom copied from `app/recipes/page.tsx` markup: name input, servings number input, `.ingredient-row`s (name/amount/unit `<select>` from `units`/`.inline-check` Pantry/Remove + "Add ingredient" `.secondary-btn`), `.step-row`s, tag chips (`.chip.active` removable for parsed tags + editor's add-tag `.inline-form` + suggestion chips = knownTags minus applied) → muted note "The original text is saved with the recipe." → full-width teal "Save recipe" (`disabled`→"Saving…") → `StatusMessage`.
- Dirty guard: `window.confirm("Discard this import?")` on back/Start-over once the review form has been edited (track a `dirty` flag set on first field change).
- a11y: all interactive targets ≥44px (2.75rem min-height for text-btns, matching existing bumps); focus moves to the textarea on paywall redirect; `StatusMessage` handles aria-live.

### C4. `app/recipes/page.tsx` wiring
"Import" `.secondary-btn` per IM7 verdict (default: beside "New recipe"). Opening import closes the editor and vice versa. `?import=1` query param opens the flow (mirror the existing `?edit=`/`?cook=1` handling). Container class `import-open` alongside the existing `editor-open` logic.

### C5. `app/globals.css` additions (tokens only)
- `.recipes-screen.import-open …` / `.recipes-layout.import-open aside.panel` — mirror the `editor-open` takeover rules (~L1788–1794) so ≤700px shows only the import panel.
- Add the import submit class to the `.settings-save, .recipes-save, .recipe-cook-btn` full-width teal group (~L1395).
- `.import-callout` amber: background `--color-accent-soft`, border `--color-accent`, text `--color-accent-deep` (the pantry-badge palette — confirm exact var names in globals.css; if any is missing, design-flags it).
- `.import-progress`: 4px height, `999px` radius, brand-teal indeterminate animation. Animation duration is a NEW value → record it in `docs/design-system.md` and `docs/design-flags.md` if not pinned on the board.
- Textarea min-height for the paste box (value per IM1 mock; design-flag if unpinned).

### C6. Scripts + docs (same PR)
- `scripts/review-board/verify-import-pass.mjs` (clone `verify-recipes-pass.mjs`): Playwright 390px — **route-intercept `/api/import-recipe`** with a fixture response (NO live LLM spend) → open `?import=1` → entry renders → submit → parsing state asserts → review renders (ingredient rows, chips, details panel) → live `save_recipe` round-trip on the local stack → lands on `/recipes/<id>`. Also error paths: paywall fixture → amber callout + focus; 422 → red status.
- Re-run `verify-recipes-pass.mjs` unchanged — proves C1 neutrality.
- Commit `capture-import-variants.mjs` + `gen-board-r5.mjs` here.
- Docs: `docs/pages/recipes.md` import sections (entry, states, review, error copy table); `docs/design-system.md` (callout + progress patterns); `docs/design-flags.md` (any unpinned values); `docs/decisions.md` round-5 verdict record.

### C7. Verification gate for Phase C
`lint`/`typecheck`/`test` green (new vitest: draftToFormState, plus B suites still green); `npm run build` green; `verify-recipes-pass.mjs` green (refactor-neutral); `verify-import-pass.mjs` green; then STOP ③ (commit approval).

---

## 7. Phase D — senior review + owner sign-off (built into this plan at the owner's request)

After each PR's phase gate passes, the work **returns to the senior model (Opus/Fable) for review before merge**:
1. Builder prepares a review packet: branch name, diff stat, `git diff main...HEAD` availability, all test outputs, the curl transcripts (Phase B) / Playwright outputs + screenshots (Phase C), and a list of every place it deviated from this spec or guessed.
2. Senior model runs `/code-review` on the branch plus a spec-compliance pass against this document (contracts B1–B10 exact, guardrails §2 honored, no deps/schema drift, CSS token discipline).
3. Findings fixed by the builder; re-review if non-trivial.
4. Owner approvals then proceed per house rules: PR creation, merge (deploys to Vercel), and for PR 2 the **Needs-Mitchell real-device digest**: on `npm run dev:phone`, real iPhone standalone — actual NYT Cooking copy→paste import end-to-end, one URL import, the paywall redirect path, keyboard-over-textarea behavior, safe-area under the teal save bar. (Playwright WebKit ≠ real Safari.)
5. Session ends with `/wrap` (current-state, progress-log, roadmap updates).

---

## 8. Owner setup — Anthropic key (gate for B13; owner does this, not the builder)

1. console.anthropic.com (NOT claude.ai) → create account.
2. Billing: add payment method, buy ~$5 credits, set **monthly spend limit ~$10** (Billing → Limits) — this is the abuse backstop.
3. API Keys → Create Key `meal-queue-vercel` → copy once.
4. Vercel → meal-queue project → Settings → Environment Variables → `ANTHROPIC_API_KEY` for Production + Preview, NOT exposed to browser → redeploy after PR 1 merges.
5. Locally: append `ANTHROPIC_API_KEY=sk-ant-…` to `.env.local`.
Token helper for curl tests: `node -e 'const {createClient}=require("@supabase/supabase-js");const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);s.auth.signInWithPassword({email:"<owner email>",password:"<pw>"}).then(r=>console.log(r.data.session.access_token))'` (run with env loaded; never store the password).

## 9. Cost & guards summary

Haiku 4.5 $1/$5 per MTok → typical import $0.006–0.009; hard ceiling ~$0.03 (25k-char paste cap, 15k JSON-LD cap, 8k text-fallback cap, max_tokens 4096). Perimeter = auth gate + Console spend limit; no rate limiter (no KV in stack, single household — documented in the ADR). Key is server-only (no `NEXT_PUBLIC_` prefix).
