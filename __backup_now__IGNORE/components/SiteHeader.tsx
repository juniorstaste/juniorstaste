"use client";

import { useRouter } from "next/navigation";

type Props = {
  subtitle?: string | null;
};

export default function SiteHeader({ subtitle }: Props) {
  const router = useRouter();

  return (
    <div className="text-center">
      {/* ✅ Logo klickbar -> Startseite */}
      <button
        type="button"
        onClick={() => router.push("/")}
        className="mx-auto block cursor-pointer"
        style={{ background: "transparent", border: "none", padding: 0 }}
        aria-label="Zur Startseite"
      >
        {/* ⬇️ hier bleibt dein Logo so wie du es schon eingebaut hast */}
        <img
  src="/logo-transparent.png"
  alt="GnosTest"
  className="h-auto w-auto max-w-[260px] mx-auto"
/>
      </button>

      {/* optionaler Subtitle (Stadt / Spots in deiner Nähe etc.) */}
      {subtitle ? (
        <div className="mt-3 text-white text-[22px] italic">{subtitle}</div>
      ) : null}
    </div>
  );
}