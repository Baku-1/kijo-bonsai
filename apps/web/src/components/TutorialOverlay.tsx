// ---------------------------------------------------------------------------
// TutorialOverlay — 7-step first-time tutorial for new players.
//
// Shows on first visit; persisted via localStorage key kijo_tutorial_complete.
// Once the key is 'true' the component renders nothing and never shows again.
//
// Keyboard navigation: → next, ← prev, Escape = skip to end.
// Accessibility: role="dialog", aria-modal, aria-labelledby, progressbar.
// SSR guard on localStorage access (typeof window check in lazy initializer).
// ---------------------------------------------------------------------------
import React, { useState, useEffect, useCallback } from "react";

const TUTORIAL_KEY = "kijo_tutorial_complete";

interface TutorialStep {
  title: string;
  body: string;
}

const STEPS: TutorialStep[] = [
  {
    title: "Welcome to Kijo",
    body: "Your bonsai is a living NFT on the Ronin blockchain. Care for it daily and watch it grow into a unique piece of art.",
  },
  {
    title: "Connect Your Wallet",
    body: "Connect your Ronin Wallet to save your bonsai on-chain and unlock spirit techniques.",
  },
  {
    title: "Your Bonsai",
    body: "This is your bonsai. It grows based on your care — water it daily, prune its shape, and train its branches.",
  },
  {
    title: "Daily Care",
    body: "Water your tree every day to keep it healthy. Miss too many days and it begins to weaken.",
  },
  {
    title: "Techniques",
    body: "As your bonsai matures, it unlocks techniques — pruning cuts, wire training, and weighting — that shape its character.",
  },
  {
    title: "The Store",
    body: "Visit the store to buy seeds for new bonsai, tools for shaping, and care supplies.",
  },
  {
    title: "Your First Tree",
    body: "You're ready. Your bonsai is waiting. Take care of it — it will grow with you.",
  },
];

export function TutorialOverlay() {
  // Lazy initializer: read localStorage once at mount.
  // Returns false (don't show) if already completed or in an SSR context.
  const [show, setShow] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(TUTORIAL_KEY) !== "true";
  });
  const [step, setStep] = useState(0);

  const finish = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TUTORIAL_KEY, "true");
    }
    setShow(false);
  }, []);

  const next = useCallback(() => {
    if (step === STEPS.length - 1) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  }, [step, finish]);

  const prev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  // Keyboard navigation — only active while the overlay is visible.
  useEffect(() => {
    if (!show) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        e.stopPropagation();
        next();
      } else if (e.key === "ArrowLeft") {
        e.stopPropagation();
        prev();
      } else if (e.key === "Escape") {
        e.stopPropagation();
        finish();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [show, next, prev, finish]);

  if (!show) return null;

  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;
  const current = STEPS[step];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
    >
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--edge)",
          borderRadius: 16,
          padding: 32,
          width: "min(92vw, 480px)",
          position: "relative",
        }}
      >
        {/* Skip — always visible, top-right corner */}
        <button
          onClick={finish}
          aria-label="Skip tutorial"
          style={{
            position: "absolute",
            top: 16,
            right: 20,
            background: "none",
            border: "none",
            color: "var(--muted, #888)",
            cursor: "pointer",
            fontSize: 13,
            padding: 0,
          }}
        >
          Skip
        </button>

        {/* Step indicator */}
        <p
          style={{
            fontSize: 12,
            color: "var(--muted, #888)",
            margin: "0 0 8px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Step {step + 1} of {STEPS.length}
        </p>

        {/* Progress bar */}
        <div
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label="Tutorial progress"
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: 4,
            height: 4,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              background: "var(--accent, #5CAA50)",
              width: `${progress}%`,
              height: "100%",
              borderRadius: 4,
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Step content */}
        <h2 id="tutorial-title" style={{ margin: "0 0 16px", fontSize: 22 }}>
          {current.title}
        </h2>
        <p
          style={{
            margin: "0 0 32px",
            fontSize: 15,
            lineHeight: 1.65,
            color: "var(--muted, #aaa)",
          }}
        >
          {current.body}
        </p>

        {/* Navigation */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            onClick={prev}
            disabled={step === 0}
            style={{ opacity: step === 0 ? 0.3 : 1 }}
          >
            ← Previous
          </button>
          {isLast ? (
            <button className="primary" onClick={finish}>
              🌱 Start Growing
            </button>
          ) : (
            <button className="primary" onClick={next}>
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
