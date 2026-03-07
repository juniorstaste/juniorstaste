"use client";

import { useEffect, useState } from "react";

type Props = {
  spotId: string;
  variant?: "detail" | "list";
};

function BookmarkIcon({
  filled,
  variant,
}: {
  filled: boolean;
  variant: "detail" | "list";
}) {
  const detailFill = "#e8decc";
  const listGreen = "#0f3b2e";

  const fillColor =
    variant === "detail"
      ? filled
        ? detailFill
        : "none"
      : filled
      ? listGreen
      : "none";

  const strokeColor = variant === "detail" ? "white" : listGreen;

  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={fillColor}
      stroke={strokeColor}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3h12v18l-6-4-6 4V3z" />
    </svg>
  );
}

export default function SaveSpotButton({
  spotId,
  variant = "detail",
}: Props) {
  const [saved, setSaved] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("saved_spot_ids");
    if (!raw) {
      setSaved(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setSaved(Array.isArray(parsed) ? parsed.includes(spotId) : false);
    } catch {
      setSaved(false);
    }
  }, [spotId]);

  function toggleSave(e?: React.MouseEvent) {
    e?.stopPropagation();

    const raw = localStorage.getItem("saved_spot_ids");
    let ids: string[] = [];

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        ids = Array.isArray(parsed) ? parsed : [];
      } catch {
        ids = [];
      }
    }

    const isCurrentlySaved = ids.includes(spotId);
    let next: string[];

    if (isCurrentlySaved) {
      next = ids.filter((id) => id !== spotId);
      setSaved(false);
    } else {
      next = [...ids, spotId];
      setSaved(true);

      setAnimate(false);
      requestAnimationFrame(() => {
        setAnimate(true);
        setTimeout(() => setAnimate(false), 280);
      });
    }

    localStorage.setItem("saved_spot_ids", JSON.stringify(next));
  }

  const buttonClass =
    variant === "detail"
      ? `inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/15 ${
          animate ? "save-bounce" : ""
        }`
      : `inline-flex h-8 w-8 items-center justify-center transition ${
          animate ? "save-bounce" : ""
        }`;

  return (
    <>
      <button
        type="button"
        onClick={toggleSave}
        className={buttonClass}
        aria-label={saved ? "Spot aus Favoriten entfernen" : "Spot speichern"}
        title={saved ? "Spot gespeichert" : "Spot speichern"}
      >
        <BookmarkIcon filled={saved} variant={variant} />
      </button>

      <style jsx>{`
        .save-bounce {
          animation: savePop 280ms ease-out;
        }

        @keyframes savePop {
          0% {
            transform: scale(1);
          }
          35% {
            transform: scale(1.22);
          }
          65% {
            transform: scale(0.94);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
}