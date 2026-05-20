"use client";

import { useRouter } from "next/navigation";

type View = "list" | "map" | "tasteDesMonats";
type Tab = View | "saved";

type Props = {
  view: Tab;
  onChange: (v: View) => void;
};

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 6h13M8 12h13M8 18h13M3.5 6h.5M3.5 12h.5M3.5 18h.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 3v15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 6v15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SavedIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v13l-6.5-3.8L5.5 19V6A1.5 1.5 0 0 1 7 4.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function BottomTabs({ view, onChange }: Props) {
  const router = useRouter();
  const baseBtn =
    "flex h-[50px] items-center justify-center gap-1.5 whitespace-nowrap rounded-[20px] px-3 text-[14px] font-semibold " +
    "transition-all duration-200 ease-out active:scale-[0.98]";

  return (
    <div
      className="fixed left-0 right-0 z-[1100]"
      style={{ bottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <div className="mx-auto w-[calc(100%-32px)] max-w-[520px]">
        <div
          className="rounded-[28px] border border-white/25 p-1.5 shadow-2xl backdrop-blur-sm"
          style={{
            background:
              "linear-gradient(90deg, rgba(255, 124, 144, 0.35) 0%, rgba(255, 225, 164, 0.35) 100%)",
          }}
        >
          <div className="flex gap-1.5">
            <button
              onClick={() => onChange("list")}
              className={`flex-1 ${baseBtn} ${
                view === "list"
                  ? "jt-active-gradient"
                  : "text-[#17392f]/88 md:hover:text-[#0f3b2e] md:hover:bg-black/5"
              }`}
            >
              <ListIcon />
              Liste
            </button>

            <button
              onClick={() => onChange("map")}
              className={`flex-1 ${baseBtn} ${
                view === "map"
                  ? "jt-active-gradient"
                  : "text-[#17392f]/88 md:hover:text-[#0f3b2e] md:hover:bg-black/5"
              }`}
            >
              <MapIcon />
              Karte
            </button>

            <button
              onClick={() => router.push("/saved")}
              className={`flex-1 ${baseBtn} ${
                view === "saved"
                  ? "jt-active-gradient"
                  : "text-[#17392f]/88 md:hover:text-[#0f3b2e] md:hover:bg-black/5"
              }`}
              title="Saved"
            >
              <SavedIcon />
              Saved
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
