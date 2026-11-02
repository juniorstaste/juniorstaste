"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

type SwipeSession<T extends string> = {
  pointerId: number;
  startX: number;
  startY: number;
  startTab: T;
};

const SWIPE_DISTANCE_THRESHOLD = 35;
const HORIZONTAL_DOMINANCE_RATIO = 1.3;

export function useTabBarSwipe<T extends string>(
  tabs: readonly T[],
  activeTab: T,
  onSwipe: (tab: T) => void
) {
  const tabBarRef = useRef<HTMLDivElement | null>(null);
  const swipeSessionRef = useRef<SwipeSession<T> | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimeoutRef = useRef<number | null>(null);
  const cleanupListenersRef = useRef<(() => void) | null>(null);
  const onSwipeRef = useRef(onSwipe);

  useEffect(() => {
    onSwipeRef.current = onSwipe;
  }, [onSwipe]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary || event.button !== 0 || !tabs.includes(activeTab)) return;

      const bar = tabBarRef.current;
      if (!bar || !(event.target instanceof Node) || !bar.contains(event.target)) return;

      const startElement = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-tab-id]")
        : null;
      const startTab = startElement?.dataset.tabId;
      if (!startTab || !tabs.includes(startTab as T)) return;

      cleanupListenersRef.current?.();
      swipeSessionRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTab: startTab as T,
      };

      const finishSwipe = (finishEvent: PointerEvent, cancelled: boolean) => {
        const session = swipeSessionRef.current;
        if (!session || session.pointerId !== finishEvent.pointerId) return;

        cleanupListenersRef.current?.();
        cleanupListenersRef.current = null;
        swipeSessionRef.current = null;

        if (cancelled) return;

        const deltaX = finishEvent.clientX - session.startX;
        const deltaY = finishEvent.clientY - session.startY;
        if (
          Math.abs(deltaX) < SWIPE_DISTANCE_THRESHOLD ||
          Math.abs(deltaX) <= Math.abs(deltaY) * HORIZONTAL_DOMINANCE_RATIO
        ) {
          return;
        }

        suppressClickRef.current = true;
        if (suppressClickTimeoutRef.current !== null) {
          window.clearTimeout(suppressClickTimeoutRef.current);
        }
        suppressClickTimeoutRef.current = window.setTimeout(() => {
          suppressClickRef.current = false;
          suppressClickTimeoutRef.current = null;
        }, 0);

        const nextIndex = tabs.indexOf(session.startTab) + (deltaX > 0 ? 1 : -1);
        const target = tabs[nextIndex];
        if (target !== undefined) onSwipeRef.current(target);
      };

      const handlePointerUp = (finishEvent: PointerEvent) => finishSwipe(finishEvent, false);
      const handlePointerCancel = (finishEvent: PointerEvent) => finishSwipe(finishEvent, true);

      cleanupListenersRef.current = () => {
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
      };
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
    },
    [activeTab, tabs]
  );

  const shouldSuppressClick = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    if (suppressClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressClickTimeoutRef.current);
      suppressClickTimeoutRef.current = null;
    }
    return true;
  }, []);

  useEffect(
    () => () => {
      cleanupListenersRef.current?.();
      if (suppressClickTimeoutRef.current !== null) {
        window.clearTimeout(suppressClickTimeoutRef.current);
      }
    },
    []
  );

  return { tabBarRef, onPointerDown, shouldSuppressClick };
}
