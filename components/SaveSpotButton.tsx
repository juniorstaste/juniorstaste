"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { BookmarkSimple } from "@phosphor-icons/react";

type Props = {
  spotId: string;
  variant?: "detail" | "list" | "list-light" | "video";
};

function BookmarkIcon({
  filled,
  variant,
}: {
  filled: boolean;
  variant: "detail" | "list" | "list-light";
}) {
  const detailFill = "#e8decc";
  const listGreen = "#0f3b2e";
  const lightFill = "#f6efe3";

  const fillColor =
    variant === "detail"
      ? filled
        ? detailFill
        : "none"
      : variant === "list-light"
      ? filled
        ? lightFill
        : "none"
      : filled
      ? listGreen
      : "none";

  const strokeColor = variant === "list" ? listGreen : "white";

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
  const [animate, setAnimate] = useState(false);
  const { isSavedSpot, toggleSavedSpot } = useAuth();
  const saved = isSavedSpot(spotId);
  const gradientId = `video-save-gradient-${spotId}`;

  async function toggleSave(e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    const changed = await toggleSavedSpot(spotId);

    if (changed && !saved) {
      setAnimate(false);
      requestAnimationFrame(() => {
        setAnimate(true);
        setTimeout(() => setAnimate(false), 280);
      });
    }
  }

  const buttonClass =
    variant === "detail"
      ? `relative z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/15 ${
          animate ? "save-bounce" : ""
        }`
      : variant === "list-light"
      ? `relative z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 transition hover:bg-white/15 ${
          animate ? "save-bounce" : ""
        }`
      : variant === "video"
      ? `inline-flex h-10 w-10 items-center justify-center text-white transition-transform duration-200 ${
          animate ? "save-bounce" : ""
        }`
      : `relative z-20 inline-flex h-8 w-8 items-center justify-center transition ${
          animate ? "save-bounce" : ""
        }`;

  return (
    <>
      {variant === "video" ? (
        <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff7c90" />
              <stop offset="100%" stopColor="#ffe1a4" />
            </linearGradient>
          </defs>
        </svg>
      ) : null}
      <button
        type="button"
        onClick={toggleSave}
        className={buttonClass}
        aria-label={saved ? "Spot aus Favoriten entfernen" : "Spot speichern"}
        title={saved ? "Spot gespeichert" : "Spot speichern"}
      >
        {variant === "video" ? (
          <BookmarkSimple
            size={26}
            weight="fill"
            aria-hidden="true"
            style={saved ? { fill: `url(#${gradientId})` } : undefined}
          />
        ) : (
          <BookmarkIcon filled={saved} variant={variant} />
        )}
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
