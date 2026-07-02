"use client";

import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";

type CookStep = {
  step_number: number;
  body: string;
};

type CookIngredient = {
  id: string;
  name: string;
  amount: string;
};

type CookModeProps = {
  recipeName: string;
  steps: CookStep[];
  ingredients: CookIngredient[];
  onExit: () => void;
};

// No step↔ingredient link exists in the schema, so chips are matched by
// name against the step text: a chip shows when any word of the ingredient
// name (3+ letters, so "chicken thighs" matches a step that says "chicken")
// appears in the step, tolerating a plural "s"/"es" on either side.
// Heuristic — tracked in docs/design-flags.md.
function wordsMatch(a: string, b: string) {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return longer === `${shorter}s` || longer === `${shorter}es`;
}

function matchesStep(stepBody: string, ingredientName: string) {
  const stepWords = stepBody.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return ingredientName
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length >= 3)
    .some((word) => stepWords.some((stepWord) => wordsMatch(word, stepWord)));
}

export function CookMode({ recipeName, steps, ingredients, onExit }: CookModeProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const stepIngredients = useMemo(
    () => ingredients.filter((ingredient) => matchesStep(step.body, ingredient.name)),
    [ingredients, step],
  );

  useEffect(() => {
    nextButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onExit();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onExit]);

  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function acquire() {
      if (!("wakeLock" in navigator)) return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        setWakeLockActive(true);
        lock.addEventListener("release", () => setWakeLockActive(false));
      } catch {
        // Best-effort: the browser can refuse (low battery, hidden tab).
        setWakeLockActive(false);
      }
    }

    function handleVisibilityChange() {
      // iOS releases the lock whenever the app is backgrounded.
      if (document.visibilityState === "visible") acquire();
    }

    acquire();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sentinel?.release().catch(() => {});
    };
  }, []);

  function advance() {
    if (isLastStep) {
      // "Mark cooked" writes nothing yet — no cooked state exists in the
      // schema (open question in docs/design-flags.md).
      onExit();
      return;
    }
    setStepIndex((current) => Math.min(steps.length - 1, current + 1));
  }

  return (
    <div aria-label={`Cooking ${recipeName}`} aria-modal="true" className="cook-mode" role="dialog">
      <div className="cook-head">
        <button className="cook-exit" onClick={onExit} type="button">
          ✕ Exit
        </button>
        <span className="cook-count">
          Step {stepIndex + 1} of {steps.length}
        </span>
      </div>
      <h2 className="cook-recipe">{recipeName}</h2>
      <div aria-hidden="true" className="cook-dots">
        {steps.map((dotStep, index) => (
          <i className={clsx(index <= stepIndex && "done")} key={dotStep.step_number} />
        ))}
      </div>
      <div className="cook-step-label">Step {stepIndex + 1}</div>
      <p aria-live="polite" className="cook-step-text">
        {step.body}
      </p>
      {stepIngredients.length > 0 ? (
        <div className="cook-step-ings">
          {stepIngredients.map((ingredient) => (
            <span key={ingredient.id}>
              {ingredient.name} {ingredient.amount}
            </span>
          ))}
        </div>
      ) : null}
      <div className="cook-nav">
        <button
          className={clsx("cook-back", stepIndex === 0 && "hidden")}
          onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
          type="button"
        >
          Back
        </button>
        <button className="cook-next" onClick={advance} ref={nextButtonRef} type="button">
          {isLastStep ? "Done — mark cooked" : "Next step"}
        </button>
      </div>
      <div className="cook-wake-note">{wakeLockActive ? "screen stays awake while cooking" : null}</div>
    </div>
  );
}
