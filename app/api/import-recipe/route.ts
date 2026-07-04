// POST /api/import-recipe — the app's first server-side route.
// Parses a recipe from pasted text or an open URL via Claude Haiku 4.5 and
// returns a draft for the client to review and save. It NEVER writes the
// database: saving stays client-side through the existing save_recipe RPC.
// No module-top-level env reads, so `next build` stays green without the key.
import {
  importRequestSchema,
  type ImportFailure,
  type ImportSuccess,
} from "@/lib/import/schema";
import { ImportError, IMPORT_ERRORS, importError } from "@/lib/import/errors";
import { verifyUser } from "@/lib/import/auth";
import {
  assertSafeUrl,
  detectPaywall,
  fetchRecipePage,
} from "@/lib/import/fetch-page";
import { extractRecipeContent } from "@/lib/import/html-extract";
import { buildSystemPrompt, buildUserContent } from "@/lib/import/prompt";
import { callClaude, IMPORT_MODEL } from "@/lib/import/anthropic";
import { normalizeDraft } from "@/lib/import/normalize";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw importError("invalid_request");
    }

    const parsed = importRequestSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const tooLong = issues.some(
        (issue) => issue.path[0] === "text" && issue.code === "too_big",
      );
      // The exactly-one refine is a form-level issue (custom, empty path).
      // Everything else (a bad field, malformed shape) is a generic 400 — only
      // the refine failure should read as the "not both" case.
      const conflictingSource = issues.some(
        (issue) => issue.code === "custom" && issue.path.length === 0,
      );
      throw importError(
        tooLong ? "text_too_long" : conflictingSource ? "conflicting_source" : "invalid_request",
      );
    }
    const { text, url, tags } = parsed.data;

    // Auth gate only — the route reads no app data and writes nothing.
    await verifyUser(req);

    const hasUrl = typeof url === "string" && url.trim().length > 0;

    let kind: "json-ld" | "text" | "paste";
    let content: string;
    let title: string | null = null;
    let originalText: string;
    let source: "url" | "paste";
    let extraction: "json-ld" | "text" | null;

    if (hasUrl) {
      source = "url";
      assertSafeUrl(url!);
      const { html } = await fetchRecipePage(url!);
      const extracted = extractRecipeContent(html);
      if (extracted.kind === "json-ld") {
        kind = "json-ld";
        content = extracted.content;
        extraction = "json-ld";
      } else {
        if (detectPaywall(html, extracted.content)) {
          throw importError("paywall_or_blocked");
        }
        kind = "text";
        content = extracted.content;
        title = extracted.title;
        extraction = "text";
      }
      originalText = content;
    } else {
      source = "paste";
      kind = "paste";
      content = text ?? ""; // schema already enforces presence + the 25k cap
      originalText = content;
      extraction = null;
    }

    const system = buildSystemPrompt(tags);
    const userContent = buildUserContent(kind, content, title);
    const { json, usage } = await callClaude(system, userContent);

    if (
      json &&
      typeof json === "object" &&
      (json as { no_recipe?: unknown }).no_recipe === true
    ) {
      throw importError("no_recipe_found");
    }

    const draft = normalizeDraft(json, tags, hasUrl ? url! : null, originalText);

    const payload: ImportSuccess = {
      draft,
      original_text: originalText,
      meta: {
        source,
        extraction,
        model: IMPORT_MODEL,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
      },
    };
    return Response.json(payload, { status: 200 });
  } catch (err) {
    if (err instanceof ImportError) {
      const failure: ImportFailure = {
        error: { code: err.code, message: err.message },
      };
      return Response.json(failure, { status: err.status });
    }
    const failure: ImportFailure = {
      error: { code: "llm_failure", message: IMPORT_ERRORS.llm_failure.message },
    };
    return Response.json(failure, { status: 500 });
  }
}
