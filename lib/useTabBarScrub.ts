"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

type TabRect<T extends string> = {
  tab: T;
  left: number;
  top: number;
  width: number;
  height: number;
  center: number;
};

type BubblePosition = Pick<TabRect<string>, "left" | "top" | "width" | "height">;

type ScrubSession = {
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
};

const DRAG_THRESHOLD = 10;
const HORIZONTAL_DOMINANCE_RATIO = 1.2;
const SNAP_DURATION_MS = 160;

function getTabRects<T extends string>(bar: HTMLDivElement, tabs: readonly T[]) {
  const barRect = bar.getBoundingClientRect();
  return Array.from(bar.querySelectorAll<HTMLElement>("[data-tab-id]"))
    .map((element): TabRect<T> | null => {
      const tab = element.dataset.tabId;
      if (!tab || !tabs.includes(tab as T)) return null;

      const rect = element.getBoundingClientRect();
      return {
        tab: tab as T,
        left: rect.left - barRect.left,
        top: rect.top - barRect.top,
        width: rect.width,
        height: rect.height,
        center: rect.left + rect.width / 2,
      };
    })
    .filter((rect): rect is TabRect<T> => rect !== null)
    .sort((a, b) => a.center - b.center);
}

function getNearestTab<T extends string>(rects: readonly TabRect<T>[], x: number) {
  return rects.reduce((nearest, rect) =>
    Math.abs(rect.center - x) < Math.abs(nearest.center - x) ? rect : nearest
  );
}

function getBubblePosition<T extends string>(rects: readonly TabRect<T>[], x: number) {
  if (rects.length === 1 || x <= rects[0].center) {
    const { left, top, width, height } = rects[0];
    return { left, top, width, height };
  }

  const last = rects[rects.length - 1];
  if (x >= last.center) {
    const { left, top, width, height } = last;
    return { left, top, width, height };
  }

  const rightIndex = rects.findIndex((rect) => rect.center >= x);
  const from = rects[rightIndex - 1];
  const to = rects[rightIndex];
  const progress = (x - from.center) / (to.center - from.center);

  return {
    left: from.left + (to.left - from.left) * progress,
    top: from.top + (to.top - from.top) * progress,
    width: from.width + (to.width - from.width) * progress,
    height: from.height + (to.height - from.height) * progress,
  };
}

export function useTabBarScrub<T extends string>(
  tabs: readonly T[],
  activeTab: T,
  onCommit: (tab: T) => void
) {
  const [previewTab, setPreviewTab] = useState<T | null>(null);
  const [bubblePosition, setBubblePosition] = useState<BubblePosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const tabBarRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<ScrubSession | null>(null);
  const cleanupListenersRef = useRef<(() => void) | null>(null);
  const clearPreviewTimeoutRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimeoutRef = useRef<number | null>(null);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const bar = tabBarRef.current;
      if (
        !bar ||
        !event.isPrimary ||
        event.button !== 0 ||
        !(event.target instanceof Node) ||
        !bar.contains(event.target)
      ) {
        return;
      }

      cleanupListenersRef.current?.();
      if (clearPreviewTimeoutRef.current !== null) {
        window.clearTimeout(clearPreviewTimeoutRef.current);
        clearPreviewTimeoutRef.current = null;
      }
      setPreviewTab(null);
      setBubblePosition(null);
      setIsDragging(false);

      sessionRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      };

      const updatePreview = (clientX: number) => {
        const currentBar = tabBarRef.current;
        if (!currentBar) return null;

        const rects = getTabRects(currentBar, tabs);
        if (rects.length === 0) return null;
        const barRect = currentBar.getBoundingClientRect();
        const x = Math.max(barRect.left, Math.min(clientX, barRect.right));
        const target = getNearestTab(rects, x);
        setPreviewTab(target.tab);
        setBubblePosition(getBubblePosition(rects, x));
        return { rects, target };
      };

      const finish = (finishEvent: PointerEvent, cancelled: boolean) => {
        const session = sessionRef.current;
        if (!session || session.pointerId !== finishEvent.pointerId) return;

        cleanupListenersRef.current?.();
        cleanupListenersRef.current = null;
        sessionRef.current = null;

        if (cancelled || !session.dragging) {
          setPreviewTab(null);
          setBubblePosition(null);
          setIsDragging(false);
          return;
        }

        const result = updatePreview(finishEvent.clientX);
        if (!result) return;

        const { target } = result;
        setPreviewTab(target.tab);
        setBubblePosition({
          left: target.left,
          top: target.top,
          width: target.width,
          height: target.height,
        });
        setIsDragging(false);

        suppressClickRef.current = true;
        if (suppressClickTimeoutRef.current !== null) {
          window.clearTimeout(suppressClickTimeoutRef.current);
        }
        suppressClickTimeoutRef.current = window.setTimeout(() => {
          suppressClickRef.current = false;
          suppressClickTimeoutRef.current = null;
        }, 0);

        onCommitRef.current(target.tab);
        clearPreviewTimeoutRef.current = window.setTimeout(() => {
          setPreviewTab(null);
          setBubblePosition(null);
          clearPreviewTimeoutRef.current = null;
        }, SNAP_DURATION_MS);
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const session = sessionRef.current;
        if (!session || session.pointerId !== moveEvent.pointerId) return;

        const deltaX = moveEvent.clientX - session.startX;
        const deltaY = moveEvent.clientY - session.startY;
        if (
          !session.dragging &&
          (Math.abs(deltaX) < DRAG_THRESHOLD ||
            Math.abs(deltaX) <= Math.abs(deltaY) * HORIZONTAL_DOMINANCE_RATIO)
        ) {
          return;
        }

        session.dragging = true;
        setIsDragging(true);
        updatePreview(moveEvent.clientX);
      };

      const handlePointerUp = (finishEvent: PointerEvent) => finish(finishEvent, false);
      const handlePointerCancel = (finishEvent: PointerEvent) => finish(finishEvent, true);

      cleanupListenersRef.current = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
    },
    [tabs]
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
      if (clearPreviewTimeoutRef.current !== null) {
        window.clearTimeout(clearPreviewTimeoutRef.current);
      }
      if (suppressClickTimeoutRef.current !== null) {
        window.clearTimeout(suppressClickTimeoutRef.current);
      }
    },
    []
  );

  return {
    tabBarRef,
    onPointerDown,
    shouldSuppressClick,
    previewTab,
    bubblePosition,
    isDragging,
  };
}
