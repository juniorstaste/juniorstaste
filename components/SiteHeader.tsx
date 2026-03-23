"use client";

import { usePathname, useRouter } from "next/navigation";

type Props = {
  subtitle?: string | null;
  compact?: boolean;
};

export default function SiteHeader({ subtitle, compact = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const logoSrc = pathname === "/" ? "/logo-transparent.png" : "/logo-compact.png";

  return (
    <div className={`text-center ${compact ? "mb-3" : "mb-6"}`}>
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
  src={logoSrc}
  alt="GnosTest"
  className={`h-auto w-auto mx-auto ${compact ? "max-w-[210px]" : "max-w-[260px]"}`}
/>
      </button>

      {/* optionaler Subtitle (Stadt / Spots in deiner Nähe etc.) */}
      {subtitle ? (
        <div className={`${compact ? "mt-2" : "mt-3"} text-white text-[22px] italic`}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}
