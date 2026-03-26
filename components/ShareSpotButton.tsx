"use client";

import { useState } from "react";

type Props = {
  spotId: string;
  spotName: string;
  variant?: "detail" | "list";
};

function ShareIcon({ variant }: { variant: "detail" | "list" }) {
  const strokeColor = variant === "detail" ? "white" : "#0f3b2e";

  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={strokeColor}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13 5l6 6-6 6" />
      <path d="M19 11H9.5C7 11 5 13 5 15.5V19" />
    </svg>
  );
}

export default function ShareSpotButton({
  spotId,
  spotName,
  variant = "detail",
}: Props) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const buttonClass =
    variant === "detail"
      ? "relative z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/15"
      : "relative z-20 inline-flex h-8 w-8 items-center justify-center transition";

  async function handleShare(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();

    if (typeof window === "undefined") return;

    const url = `${window.location.origin}/spot/${spotId}`;
    const shareData = {
      title: spotName,
      text: `Schau dir ${spotName} bei Junior's Taste an.`,
      url,
    };

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        if (typeof navigator.canShare !== "function" || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setFeedback("Link kopiert");
        window.setTimeout(() => setFeedback(null), 1600);
        return;
      }

      window.prompt("Link kopieren:", url);
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      console.error("Teilen fehlgeschlagen:", error);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleShare}
        className={buttonClass}
        aria-label="Spot teilen"
        title="Spot teilen"
      >
        <ShareIcon variant={variant} />
      </button>

      {feedback ? (
        <div className="absolute right-0 top-full mt-2 whitespace-nowrap rounded-lg bg-[#0f3b2e] px-2 py-1 text-[11px] font-semibold text-white shadow-lg">
          {feedback}
        </div>
      ) : null}
    </div>
  );
}
