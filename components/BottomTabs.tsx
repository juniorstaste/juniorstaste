"use client";
console.log("✅ BottomTabs ACTIVE: components/BottomTabs.tsx");

type View = "list" | "map" | "tasteDesMonats";

type Props = {
  view: View;
  onChange: (v: View) => void;
};

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 6h13M8 12h13M8 18h13M3.5 6h.5M3.5 12h.5M3.5 18h.5"
        stroke="#0f3b2e"
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
        stroke="#0f3b2e"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 3v15" stroke="#0f3b2e" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 6v15" stroke="#0f3b2e" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function BurgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 10a7 7 0 0 1 14 0H5Z"
        stroke="#0f3b2e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 13h16"
        stroke="#0f3b2e"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M5 16h14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"
        stroke="#0f3b2e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function BottomTabs({ view, onChange }: Props) {
  const baseBtn =
  "h-[56px] rounded-2xl font-semibold flex items-center justify-center gap-1.5 transition text-[14px] whitespace-nowrap";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-[560px] px-4 pb-[max(env(safe-area-inset-bottom),8px)]">
        <div className="rounded-2xl bg-[#e8decc] shadow-sm p-1">
          <div className="flex gap-1">
            <button
              onClick={() => onChange("list")}
              className={`flex-[0.9] ${baseBtn} ${
                view === "list"
                  ? "bg-white/60 text-[#0f3b2e]"
                  : "text-[#0f3b2e]/80 hover:text-[#0f3b2e] hover:bg-white/20"
              }`}
            >
              <ListIcon />
              Liste
            </button>

            <button
              onClick={() => onChange("map")}
              className={`flex-[0.9] ${baseBtn} ${
                view === "map"
                  ? "bg-white/60 text-[#0f3b2e]"
                  : "text-[#0f3b2e]/80 hover:text-[#0f3b2e] hover:bg-white/20"
              }`}
            >
              <MapIcon />
              Karte
            </button>

            <button
              onClick={() => onChange("tasteDesMonats")}
              className={`flex-[1.2] ${baseBtn} ${
                view === "tasteDesMonats"
                  ? "bg-white/60 text-[#0f3b2e]"
                  : "text-[#0f3b2e]/80 hover:text-[#0f3b2e] hover:bg-white/20"
              }`}
              title="Taste des Monats"
            >
              <BurgerIcon />
              Taste des Monats
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
