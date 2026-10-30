"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import BottomTabs from "@/components/BottomTabs";
import {
  ROOT_TAB_SWIPE_EVENT,
  SAVED_SUBTAB_SWIPE_EVENT,
  TAB_SWIPE_COMPLETE_EVENT,
  type SwipeDirection,
} from "@/lib/swipeNavigation";
import {
  buildCityViewHref,
  CityTabView,
  isCityTabView,
  LAST_CITY_FALLBACK_SLUG,
  LAST_CITY_SLUG_KEY,
  LAST_CITY_VIEW_KEY,
} from "@/lib/lastCityNavigation";

export default function GlobalBottomTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const [view, setView] = useState<CityTabView | "saved" | "for-you">("list");
  const activePointer = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    target: Element;
  } | null>(null);

  useEffect(() => {
    const isRootPage =
      pathname === "/for-you" ||
      pathname === "/saved" ||
      pathname?.startsWith("/city/") ||
      pathname?.startsWith("/near") ||
      pathname?.startsWith("/discover");

    if (!isRootPage) return;

    function isHorizontalScroller(target: Element) {
      let element: Element | null = target;

      while (element && element !== document.body) {
        const overflowX = window.getComputedStyle(element).overflowX;
        if (
          (overflowX === "auto" || overflowX === "scroll") &&
          element.scrollWidth > element.clientWidth + 1
        ) {
          return true;
        }
        element = element.parentElement;
      }

      return false;
    }

    function handlePointerDown(event: PointerEvent) {
      activePointer.current = null;
      if (event.pointerType !== "touch" || !(event.target instanceof Element)) return;

      const target = event.target;
      if (
        target.closest(
          'button, a, input, textarea, select, [contenteditable="true"], [data-no-tab-swipe], .leaflet-container'
        ) ||
        isHorizontalScroller(target)
      ) {
        return;
      }

      activePointer.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        target,
      };
    }

    function handlePointerUp(event: PointerEvent) {
      const pointer = activePointer.current;
      activePointer.current = null;
      if (!pointer || pointer.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - pointer.startX;
      const deltaY = event.clientY - pointer.startY;
      if (Math.abs(deltaX) < 60 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
      if (pointer.startX <= 28) return;

      const direction: SwipeDirection = deltaX < 0 ? "left" : "right";
      const isSavedSubtabSwipe =
        pathname === "/saved" &&
        pointer.target.closest("[data-saved-subtab-swipe-area]") !== null;

      event.preventDefault();
      event.stopPropagation();

      window.dispatchEvent(
        new CustomEvent(
          isSavedSubtabSwipe ? SAVED_SUBTAB_SWIPE_EVENT : ROOT_TAB_SWIPE_EVENT,
          { detail: { direction } }
        )
      );
      window.dispatchEvent(
        new CustomEvent(TAB_SWIPE_COMPLETE_EVENT, {
          detail: { target: pointer.target },
        })
      );
    }

    function handlePointerCancel() {
      activePointer.current = null;
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointerup", handlePointerUp, {
      capture: true,
      passive: false,
    });
    document.addEventListener("pointercancel", handlePointerCancel, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("pointercancel", handlePointerCancel, true);
      activePointer.current = null;
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/saved") {
      setView("saved");
      return;
    }

    if (
      pathname?.startsWith("/city/") ||
      pathname?.startsWith("/near") ||
      pathname?.startsWith("/discover")
    ) {
      return;
    }

    if (typeof window === "undefined") {
      setView("list");
      return;
    }

    const storedView = window.localStorage.getItem(LAST_CITY_VIEW_KEY);
    setView(isCityTabView(storedView) ? storedView : "list");
  }, [pathname]);

  function handleChange(nextView: CityTabView) {
    setView(nextView);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_CITY_VIEW_KEY, nextView);
      const citySlug =
        window.localStorage.getItem(LAST_CITY_SLUG_KEY) || LAST_CITY_FALLBACK_SLUG;
      router.replace(buildCityViewHref(citySlug, nextView));
      return;
    }

    router.replace(buildCityViewHref(LAST_CITY_FALLBACK_SLUG, nextView));
  }

  if (!pathname || pathname === "/" || pathname === "/for-you") return null;

  if (
    pathname.startsWith("/city/") ||
    pathname.startsWith("/near") ||
    pathname.startsWith("/discover")
  ) {
    return null;
  }

  return <BottomTabs view={view} onChange={handleChange} />;
}
