"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type View = "list" | "map";
type Tab = "for-you" | View | "saved";

type Props = {
  view: Tab;
  onChange: (v: View) => void;
};

const RECENT_TAB_STORAGE_KEY = "jt_recent_bottom_tab";
const RECENT_TAB_MIN_VISIBLE_MS = 1500;

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

function ForYouIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3.5 14.6 8.7 20.5 9.6 16.3 13.7 17.3 19.5 12 16.7 6.7 19.5 7.7 13.7 3.5 9.6 9.4 8.7 12 3.5Z"
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
  const [isCompact, setIsCompact] = useState(false);
  const [recentlyTappedTab, setRecentlyTappedTab] = useState<Tab | null>(null);
  const SCROLL_DIRECTION_THRESHOLD = 6;
  const baseBtn =
    "flex items-center justify-center whitespace-nowrap rounded-[20px] font-semibold " +
    "transform-gpu transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97]";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const raw = window.sessionStorage.getItem(RECENT_TAB_STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { tab?: Tab; expiresAt?: number };
      if (!parsed.tab || typeof parsed.expiresAt !== "number") {
        window.sessionStorage.removeItem(RECENT_TAB_STORAGE_KEY);
        return;
      }

      const remaining = parsed.expiresAt - Date.now();
      if (remaining <= 0) {
        window.sessionStorage.removeItem(RECENT_TAB_STORAGE_KEY);
        return;
      }

      setRecentlyTappedTab(parsed.tab);
    } catch {
      window.sessionStorage.removeItem(RECENT_TAB_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!recentlyTappedTab) return;

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        RECENT_TAB_STORAGE_KEY,
        JSON.stringify({
          tab: recentlyTappedTab,
          expiresAt: Date.now() + RECENT_TAB_MIN_VISIBLE_MS,
        })
      );
    }

    const timeoutId = window.setTimeout(() => {
      setRecentlyTappedTab(null);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(RECENT_TAB_STORAGE_KEY);
      }
    }, RECENT_TAB_MIN_VISIBLE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [recentlyTappedTab]);

  useEffect(() => {
    let lastScrollY = typeof window !== "undefined" ? window.scrollY : 0;

    const onScroll = () => {
      const nextScrollY = window.scrollY;
      const delta = nextScrollY - lastScrollY;

      if (Math.abs(delta) <= SCROLL_DIRECTION_THRESHOLD) return;

      setIsCompact(delta > 0);
      lastScrollY = nextScrollY;
    };

    const onCompactEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ compact?: boolean }>).detail;
      if (typeof detail?.compact === "boolean") {
        setIsCompact(detail.compact);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("jt-bottom-tabs-compact", onCompactEvent as EventListener);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("jt-bottom-tabs-compact", onCompactEvent as EventListener);
    };
  }, []);

  function triggerTab(tab: Tab, action: () => void) {
    setRecentlyTappedTab(tab);
    action();
  }

  function renderLabel(tab: Tab, label: string) {
    const isVisible = recentlyTappedTab === tab;

    return (
      <span
        className={`overflow-hidden text-left transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isVisible
            ? "ml-1.5 max-w-[74px] translate-x-0 scale-100 opacity-100"
            : "ml-0 max-w-0 -translate-x-1 scale-95 opacity-0"
        }`}
      >
        <span className="block">{label}</span>
      </span>
    );
  }

  return (
    <div
      className="fixed left-0 right-0 z-[1100] transition-all duration-300 ease-out"
      style={{ bottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <div
        className={`mx-auto max-w-[520px] transition-all duration-300 ease-out ${
          isCompact ? "w-[72%] min-w-[280px]" : "w-[calc(100%-32px)]"
        }`}
      >
        <div
          className={`rounded-[28px] border border-white/25 shadow-2xl backdrop-blur-sm transition-all duration-300 ease-out ${
            isCompact ? "p-[3px]" : "p-1.5"
          }`}
          style={{
            background:
              "linear-gradient(90deg, rgba(255, 124, 144, 0.35) 0%, rgba(255, 225, 164, 0.35) 100%)",
          }}
        >
          <div className={`flex items-center transition-all duration-300 ease-out ${isCompact ? "gap-1" : "gap-1.5"}`}>
            <button
              onClick={() => triggerTab("for-you", () => router.push("/for-you"))}
              className={`flex-1 ${baseBtn} ${
                isCompact ? "h-[42px] px-1.5 text-[11px]" : "h-[50px] px-3 text-[14px]"
              } ${
                view === "for-you"
                  ? "jt-active-gradient scale-[1.02] shadow-[0_10px_28px_rgba(255,124,144,0.24)]"
                  : "text-[#17392f]/88 md:hover:text-[#0f3b2e] md:hover:bg-black/5"
              }`}
            >
              <span className={`transition-transform duration-300 ease-out ${isCompact ? "scale-90" : "scale-100"} ${recentlyTappedTab === "for-you" ? "animate-[jt-tab-bounce_420ms_ease-out]" : ""}`}>
                <ForYouIcon />
              </span>
              {renderLabel("for-you", "For You")}
            </button>

            <button
              onClick={() => triggerTab("map", () => onChange("map"))}
              className={`flex-1 ${baseBtn} ${
                isCompact ? "h-[42px] px-1.5 text-[11px]" : "h-[50px] px-3 text-[14px]"
              } ${
                view === "map"
                  ? "jt-active-gradient scale-[1.02] shadow-[0_10px_28px_rgba(255,124,144,0.24)]"
                  : "text-[#17392f]/88 md:hover:text-[#0f3b2e] md:hover:bg-black/5"
              }`}
            >
              <span className={`transition-transform duration-300 ease-out ${isCompact ? "scale-90" : "scale-100"} ${recentlyTappedTab === "map" ? "animate-[jt-tab-bounce_420ms_ease-out]" : ""}`}>
                <MapIcon />
              </span>
              {renderLabel("map", "Karte")}
            </button>

            <button
              onClick={() => triggerTab("list", () => onChange("list"))}
              className={`flex-1 ${baseBtn} ${
                isCompact ? "h-[42px] px-1.5 text-[11px]" : "h-[50px] px-3 text-[14px]"
              } ${
                view === "list"
                  ? "jt-active-gradient scale-[1.02] shadow-[0_10px_28px_rgba(255,124,144,0.24)]"
                  : "text-[#17392f]/88 md:hover:text-[#0f3b2e] md:hover:bg-black/5"
              }`}
            >
              <span className={`transition-transform duration-300 ease-out ${isCompact ? "scale-90" : "scale-100"} ${recentlyTappedTab === "list" ? "animate-[jt-tab-bounce_420ms_ease-out]" : ""}`}>
                <ListIcon />
              </span>
              {renderLabel("list", "Liste")}
            </button>

            <button
              onClick={() => triggerTab("saved", () => router.push("/saved"))}
              className={`flex-1 ${baseBtn} ${
                isCompact ? "h-[42px] px-1.5 text-[11px]" : "h-[50px] px-3 text-[14px]"
              } ${
                view === "saved"
                  ? "jt-active-gradient scale-[1.02] shadow-[0_10px_28px_rgba(255,124,144,0.24)]"
                  : "text-[#17392f]/88 md:hover:text-[#0f3b2e] md:hover:bg-black/5"
              }`}
              title="Saved"
            >
              <span className={`transition-transform duration-300 ease-out ${isCompact ? "scale-90" : "scale-100"} ${recentlyTappedTab === "saved" ? "animate-[jt-tab-bounce_420ms_ease-out]" : ""}`}>
                <SavedIcon />
              </span>
              {renderLabel("saved", "Saved")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
