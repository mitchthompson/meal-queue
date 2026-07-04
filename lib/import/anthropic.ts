// Calls Claude Haiku 4.5 with structured JSON output, over plain fetch (no SDK,
// no new dependency). The request shape (output_config.format.json_schema) was
// verified against the current Messages API: structured outputs are GA on the
// first-party API for Haiku 4.5, no beta header, and `effort` is unsupported on
// Haiku so it is deliberately omitted. temperature:0 is accepted on Haiku.
import { DRAFT_JSON_SCHEMA } from "./schema";
import { importError } from "./errors";

export const IMPORT_MODEL = "claude-haiku-4-5-20251001";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type AnthropicUsage = { input_tokens: number; output_tokens: number };

export async function callClaude(
  system: string,
  userContent: string,
): Promise<{ json: unknown; usage: AnthropicUsage }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw importError("not_configured");

  const body = JSON.stringify({
    model: IMPORT_MODEL,
    max_tokens: 4096,
    temperature: 0,
    system,
    output_config: {
      format: { type: "json_schema", schema: DRAFT_JSON_SCHEMA },
    },
    messages: [{ role: "user", content: userContent }],
  });

  const post = () =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(45_000),
    });

  let res: Response;
  try {
    res = await post();
    // One automatic retry after 2s, only on 429/529.
    if (res.status === 429 || res.status === 529) {
      await sleep(2000);
      res = await post();
    }
  } catch {
    throw importError("llm_failure"); // network error, timeout, or abort
  }

  if (!res.ok) throw importError("llm_failure");

  let payload: {
    stop_reason?: string;
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  try {
    payload = await res.json();
  } catch {
    throw importError("llm_output_invalid");
  }

  if (payload.stop_reason === "max_tokens") {
    throw importError("llm_output_invalid");
  }

  const textBlock = Array.isArray(payload.content)
    ? payload.content.find((block) => block?.type === "text")
    : undefined;
  if (!textBlock || typeof textBlock.text !== "string") {
    throw importError("llm_output_invalid");
  }

  let json: unknown;
  try {
    json = JSON.parse(textBlock.text);
  } catch {
    throw importError("llm_output_invalid");
  }

  return {
    json,
    usage: {
      input_tokens: Number(payload.usage?.input_tokens ?? 0),
      output_tokens: Number(payload.usage?.output_tokens ?? 0),
    },
  };
}
