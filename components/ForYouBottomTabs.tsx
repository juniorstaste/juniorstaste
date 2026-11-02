"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildCityViewHref,
  LAST_CITY_FALLBACK_SLUG,
  LAST_CITY_SLUG_KEY,
  LAST_CITY_VIEW_KEY,
} from "@/lib/lastCityNavigation";
import type { CityTabView } from "@/lib/lastCityNavigation";
import { useTabBarScrub } from "@/lib/useTabBarScrub";

type Tab = "for-you" | CityTabView | "saved";

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

export default function ForYouBottomTabs() {
  const router = useRouter();
  const [isCompact, setIsCompact] = useState(false);
  const [recentlySelectedTab, setRecentlySelectedTab] = useState<Tab | null>(() => {
    if (typeof window === "undefined") return null;

    const raw = window.sessionStorage.getItem(RECENT_TAB_STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as { tab?: Tab; expiresAt?: number };
      if (!parsed.tab || typeof parsed.expiresAt !== "number") {
        window.sessionStorage.removeItem(RECENT_TAB_STORAGE_KEY);
        return null;
      }

      if (parsed.expiresAt <= Date.now()) {
        window.sessionStorage.removeItem(RECENT_TAB_STORAGE_KEY);
        return null;
      }

      return parsed.tab;
    } catch {
      window.sessionStorage.removeItem(RECENT_TAB_STORAGE_KEY);
      return null;
    }
  });

  const baseBtn =
    "flex items-center justify-center whitespace-nowrap rounded-[20px] font-semibold " +
    "transform-gpu transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97]";

  const triggerTab = useCallback((tab: Tab, action: () => void) => {
    setRecentlySelectedTab(tab);
    action();
  }, []);

  const navigateToCityView = useCallback((nextView: CityTabView) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_CITY_VIEW_KEY, nextView);
      const citySlug =
        window.localStorage.getItem(LAST_CITY_SLUG_KEY) || LAST_CITY_FALLBACK_SLUG;
      router.replace(buildCityViewHref(citySlug, nextView));
      return;
    }

    router.replace(buildCityViewHref(LAST_CITY_FALLBACK_SLUG, nextView));
  }, [router]);
  const selectTab = useCallback((tab: Tab) => {
    triggerTab(tab, () => {
      if (tab === "for-you") {
        router.replace("/for-you");
      } else if (tab === "saved") {
        router.replace("/saved");
      } else {
        navigateToCityView(tab);
      }
    });
  }, [navigateToCityView, router, triggerTab]);
  const {
    tabBarRef,
    onPointerDown,
    shouldSuppressClick,
    previewTab,
    bubblePosition,
    isDragging,
  } = useTabBarScrub(
    ["for-you", "map", "list", "saved"] as const,
    "for-you",
    selectTab
  );

  useEffect(() => {
    const citySlug =
      typeof window !== "undefined"
        ? window.localStorage.getItem(LAST_CITY_SLUG_KEY) || LAST_CITY_FALLBACK_SLUG
        : LAST_CITY_FALLBACK_SLUG;

    router.prefetch("/for-you");
    router.prefetch("/saved");
    router.prefetch(buildCityViewHref(citySlug, "list"));
    router.prefetch(buildCityViewHref(citySlug, "map"));
  }, [router]);

  useEffect(() => {
    if (!recentlySelectedTab) return;

    window.sessionStorage.setItem(
      RECENT_TAB_STORAGE_KEY,
      JSON.stringify({
        tab: recentlySelectedTab,
        expiresAt: Date.now() + RECENT_TAB_MIN_VISIBLE_MS,
      })
    );

    const timeoutId = window.setTimeout(() => {
      setRecentlySelectedTab(null);
      window.sessionStorage.removeItem(RECENT_TAB_STORAGE_KEY);
    }, RECENT_TAB_MIN_VISIBLE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [recentlySelectedTab]);

  useEffect(() => {
    const onCompactEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ compact?: boolean }>).detail;
      if (typeof detail?.compact === "boolean") {
        setIsCompact(detail.compact);
      }
    };

    window.addEventListener("jt-bottom-tabs-compact", onCompactEvent as EventListener);

    return () => {
      window.removeEventListener("jt-bottom-tabs-compact", onCompactEvent as EventListener);
    };
  }, []);

  function renderLabel(tab: Tab, label: string) {
    const isVisible = (previewTab ?? recentlySelectedTab) === tab;

    return (
      <span
        className={`overflow-hidden text-left transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isVisible
            ? "ml-1.5 max-w-[74px] translate-x-0 scale-100 opacity-100"
            : "ml-0 max-w-0 -translate-x-1 scale-95 opacity-0"
        }`}
      >
        <span className={`block ${isDragging && previewTab === tab ? "text-white" : ""}`}>
          {label}
        </span>
      </span>
    );
  }

  function renderTabContent(tab: Tab) {
    const iconClass = `transition-transform duration-300 ease-out ${
      isCompact ? "scale-90" : "scale-100"
    } ${recentlySelectedTab === tab ? "animate-[jt-tab-bounce_420ms_ease-out]" : ""}`;
    const icon =
      tab === "for-you" ? (
        <ForYouIcon />
      ) : tab === "map" ? (
        <MapIcon />
      ) : tab === "list" ? (
        <ListIcon />
      ) : (
        <SavedIcon />
      );
    const label =
      tab === "for-you" ? "For You" : tab === "map" ? "Karte" : tab === "list" ? "Liste" : "Saved";

    return (
      <>
        <span className={iconClass}>{icon}</span>
        {renderLabel(tab, label)}
      </>
    );
  }

  function isActiveTab(tab: Tab) {
    return (previewTab ?? "for-you") === tab;
  }

  function activeTabClass(tab: Tab) {
    if (!isActiveTab(tab)) return "text-[#17392f]/88 md:hover:text-[#0f3b2e] md:hover:bg-black/5";
    return isDragging
      ? "text-[#0f3b2e]"
      : "jt-active-gradient scale-[1.02] shadow-[0_10px_28px_rgba(255,124,144,0.24)]";
  }

  function tabButtonStyle(tab: Tab) {
    return `relative z-10 flex-1 ${baseBtn} ${
      isCompact ? "h-[42px] px-1.5 text-[11px]" : "h-[50px] px-3 text-[14px]"
    } ${activeTabClass(tab)}`;
  }

  return (
    <div
      className="for-you-bottom-tabs fixed left-0 right-0 z-[1100] transition-all duration-300 ease-out"
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
          <div
            ref={tabBarRef}
            onPointerDown={onPointerDown}
            className={`tab-bar-gesture relative flex items-center transition-all duration-300 ease-out ${isCompact ? "gap-1" : "gap-1.5"} ${isDragging ? "tab-bar-scrubbing" : ""}`}
          >
            {bubblePosition ? (
              <span
                aria-hidden="true"
                className={`tab-scrub-bubble jt-active-gradient absolute ${
                  isDragging ? "is-dragging" : ""
                }`}
                style={{
                  left: bubblePosition.left,
                  top: bubblePosition.top,
                  width: bubblePosition.width,
                  height: bubblePosition.height,
                }}
              />
            ) : null}
            <button
              data-tab-id="for-you"
              onClick={() => {
                if (!shouldSuppressClick()) selectTab("for-you");
              }}
              className={tabButtonStyle("for-you")}
            >
              {renderTabContent("for-you")}
            </button>

            <button
              data-tab-id="map"
              onClick={() => {
                if (!shouldSuppressClick()) selectTab("map");
              }}
              className={tabButtonStyle("map")}
            >
              {renderTabContent("map")}
            </button>

            <button
              data-tab-id="list"
              onClick={() => {
                if (!shouldSuppressClick()) selectTab("list");
              }}
              className={tabButtonStyle("list")}
            >
              {renderTabContent("list")}
            </button>

            <button
              data-tab-id="saved"
              onClick={() => {
                if (!shouldSuppressClick()) selectTab("saved");
              }}
              className={tabButtonStyle("saved")}
              title="Saved"
            >
              {renderTabContent("saved")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
