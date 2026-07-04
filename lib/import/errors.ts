// Typed error taxonomy for recipe import. The client surfaces these messages
// verbatim through toErrorMessage() (lib/errors.ts is intentionally untouched).
//
// NOTE (deviation from plan §B2): the spec table used em-dashes in four
// messages (text_too_long, unauthorized, llm_failure, llm_output_invalid).
// Em-dashes are barred from client-facing copy by the owner's standing
// cross-project rule, so they are replaced with periods here. Meaning is
// unchanged; wording is easily reverted if the exact spec phrasing was
// intentional. Flagged in docs/design-flags.md.

export type ImportErrorCode =
  | "invalid_request"
  | "text_too_long"
  | "unauthorized"
  | "fetch_failed"
  | "paywall_or_blocked"
  | "no_recipe_found"
  | "llm_failure"
  | "llm_output_invalid"
  | "not_configured";

export const IMPORT_ERRORS: Record<
  ImportErrorCode,
  { status: number; message: string }
> = {
  invalid_request: {
    status: 400,
    message: "Provide a recipe URL or pasted recipe text (not both).",
  },
  text_too_long: {
    status: 400,
    message: "That's a lot of text. Paste just the recipe portion.",
  },
  unauthorized: {
    status: 401,
    message: "Your session has expired. Sign in again.",
  },
  fetch_failed: {
    status: 422,
    message:
      "Couldn't fetch that page. Check the URL, or paste the recipe text instead.",
  },
  paywall_or_blocked: {
    status: 422,
    message:
      "That site blocked the request (likely a paywall). Copy the recipe text from the page and paste it instead.",
  },
  no_recipe_found: {
    status: 422,
    message:
      "Couldn't find a recipe in that content. Try pasting just the recipe text.",
  },
  llm_failure: {
    status: 502,
    message:
      "The recipe parser is unavailable right now. Try again in a minute.",
  },
  llm_output_invalid: {
    status: 502,
    message:
      "The parser returned something unusable. Try again, or paste cleaner text.",
  },
  not_configured: {
    status: 500,
    message: "Recipe import isn't set up yet (missing ANTHROPIC_API_KEY).",
  },
};

export class ImportError extends Error {
  constructor(
    public code: ImportErrorCode,
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ImportError";
  }
}

// Construct an ImportError with its canonical status + verbatim message.
export function importError(code: ImportErrorCode): ImportError {
  const { status, message } = IMPORT_ERRORS[code];
  return new ImportError(code, status, message);
}
