import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";
import { draftToFormState } from "@/lib/hooks/draft-to-form";
import type { UnitOption } from "@/lib/hooks/draft-to-form";
import { saveRecipeForm } from "@/lib/hooks/use-recipes";
import type { RecipeFormState } from "@/lib/hooks/use-recipes";
import type { ImportFailure, ImportSuccess } from "@/lib/import/schema";

// Client-side state machine for in-app recipe import (Phase C, milestone 8).
// Calls the server route POST /api/import-recipe (which parses via Claude and
// NEVER writes to the DB), then hands the parsed draft to the shared
// saveRecipeForm() so saving goes through the same auth.uid() save_recipe RPC
// the editor uses. Board verdicts locked round 5: IM1 B (mode pills), IM2 wait
// as shown, IM3 A (amber paywall redirect), IM4 B (parsed/original toggle),
// IM5/IM6 as shown, IM7 A (button beside "New recipe").
export type ImportPhase = "closed" | "entry" | "parsing" | "review";
export type ImportMode = "paste" | "link";

// The one error code that fails soft into an amber redirect rather than a red
// status line (IM3: A). Everything else surfaces as a normal error.
const PAYWALL_CODE = "paywall_or_blocked";

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

export function useImport(units: UnitOption[], knownTags: string[]) {
  const router = useRouter();
  const [phase, setPhase] = useState<ImportPhase>("closed");
  const [mode, setMode] = useState<ImportMode>("paste");
  const [sourceText, setSourceText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [draftForm, setDraftForm] = useState<RecipeFormState | null>(null);
  const [originalText, setOriginalText] = useState("");
  const [sourceHost, setSourceHost] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  function resetState() {
    abortRef.current?.abort();
    abortRef.current = null;
    setMode("paste");
    setSourceText("");
    setSourceUrl("");
    setDraftForm(null);
    setOriginalText("");
    setSourceHost(null);
    setError(null);
    setErrorCode(null);
    setSaving(false);
  }

  function openImport() {
    resetState();
    setPhase("entry");
  }

  function closeImport() {
    resetState();
    setPhase("closed");
  }

  // Return to the entry surface from the review screen (Start over), keeping
  // the typed source so the owner can adjust and re-parse.
  function backToEntry() {
    abortRef.current?.abort();
    abortRef.current = null;
    setDraftForm(null);
    setOriginalText("");
    setSourceHost(null);
    setError(null);
    setErrorCode(null);
    setSaving(false);
    setPhase("entry");
  }

  async function startParse() {
    const usePaste = mode === "paste";
    const text = sourceText.trim();
    const url = sourceUrl.trim();
    if (usePaste ? !text : !url) return;

    setError(null);
    setErrorCode(null);
    setPhase("parsing");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setPhase("entry");
        setError("Your session has expired. Sign in again.");
        setErrorCode("unauthorized");
        return;
      }

      const res = await fetch("/api/import-recipe", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(usePaste ? { text, tags: knownTags } : { url, tags: knownTags }),
        signal: controller.signal,
      });

      const json = (await res.json()) as ImportSuccess | ImportFailure;

      if (!res.ok || "error" in json) {
        const failure = json as ImportFailure;
        const code = failure.error?.code ?? "llm_failure";
        const message = failure.error?.message ?? "Something went wrong. Try again.";
        // IM3: A — a blocked/paywalled URL fails soft into the paste box (amber
        // callout), keeping the URL; the component moves focus to the textarea.
        if (code === PAYWALL_CODE) {
          setMode("paste");
          setError(message);
          setErrorCode(PAYWALL_CODE);
          setPhase("entry");
          return;
        }
        setError(message);
        setErrorCode(code);
        setPhase("entry");
        return;
      }

      const success = json as ImportSuccess;
      setDraftForm(draftToFormState(success.draft, units));
      setOriginalText(success.original_text);
      setSourceHost(success.meta.source === "url" ? hostFromUrl(url) : null);
      setPhase("review");
    } catch {
      // Distinguish a user Cancel from a programmatic reset. cancelParse()
      // aborts but leaves this controller active; closeImport/openImport/
      // backToEntry abort AND clear abortRef first (and may start a newer
      // request). If this controller is no longer the active one, it has been
      // superseded — do NOT clobber the phase the reset/newer request set.
      if (abortRef.current !== controller) return;
      if (controller.signal.aborted) {
        setPhase("entry");
        return;
      }
      setError("The recipe parser is unavailable right now. Try again in a minute.");
      setErrorCode("llm_failure");
      setPhase("entry");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function cancelParse() {
    abortRef.current?.abort();
  }

  async function saveDraft() {
    if (!draftForm) return;
    setSaving(true);
    setError(null);
    setErrorCode(null);
    try {
      const savedId = await saveRecipeForm(draftForm);
      router.push(`/recipes/${savedId}`);
    } catch (caught) {
      setError(toErrorMessage(caught, "Failed to save recipe."));
      setErrorCode("save_failed");
      setSaving(false);
    }
  }

  const isPaywallRedirect = errorCode === PAYWALL_CODE;

  return {
    phase,
    mode,
    setMode,
    sourceText,
    setSourceText,
    sourceUrl,
    setSourceUrl,
    draftForm,
    setDraftForm,
    originalText,
    sourceHost,
    error,
    isPaywallRedirect,
    saving,
    startParse,
    cancelParse,
    saveDraft,
    openImport,
    closeImport,
    backToEntry,
  };
}

export type ImportController = ReturnType<typeof useImport>;
