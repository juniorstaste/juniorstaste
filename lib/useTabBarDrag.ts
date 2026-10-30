"use client";

import { useCallback, useEffect, useRef } from "react";

type DragSession<T extends string> = {
  pointerId: number;
  startX: number;
  startY: number;
  activeTab: T;
  dragged: boolean;
};

export function useTabBarDrag<T extends string>(
  tabs: readonly T[],
  onPreview: (tab: T) => void,
  onCommit?: (tab: T) => void
) {
  const tabBarRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<DragSession<T> | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimeoutRef = useRef<number | null>(null);
  const cleanupListenersRef = useRef<(() => void) | null>(null);
  const onPreviewRef = useRef(onPreview);
  const onCommitRef = useRef(onCommit);

  useEffect(() => {
    onPreviewRef.current = onPreview;
    onCommitRef.current = onCommit;
  }, [onCommit, onPreview]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary || event.button !== 0 || !(event.target instanceof Element)) return;

      const tabElement = event.target.closest<HTMLElement>("[data-tab-id]");
      if (!tabElement || !tabBarRef.current?.contains(tabElement)) return;

      const tab = tabElement.dataset.tabId;
      if (!tab || !tabs.includes(tab as T)) return;

      dragSessionRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        activeTab: tab as T,
        dragged: false,
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const session = dragSessionRef.current;
        const bar = tabBarRef.current;
        if (!session || session.pointerId !== moveEvent.pointerId || !bar) return;

        const deltaX = moveEvent.clientX - session.startX;
        const deltaY = moveEvent.clientY - session.startY;
        if (Math.abs(deltaX) < 12 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return;

        const element = document
          .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
          ?.closest<HTMLElement>("[data-tab-id]");
        if (!element || !bar.contains(element)) return;

        const nextTab = element.dataset.tabId;
        if (!nextTab || !tabs.includes(nextTab as T) || nextTab === session.activeTab) return;

        session.activeTab = nextTab as T;
        session.dragged = true;
        onPreviewRef.current(session.activeTab);
      };

      const finishDrag = (finishEvent: PointerEvent) => {
        const session = dragSessionRef.current;
        if (!session || session.pointerId !== finishEvent.pointerId) return;

        cleanupListenersRef.current?.();
        cleanupListenersRef.current = null;
        dragSessionRef.current = null;

        if (suppressClickTimeoutRef.current !== null) {
          window.clearTimeout(suppressClickTimeoutRef.current);
        }
        suppressClickRef.current = session.dragged;
        suppressClickTimeoutRef.current = window.setTimeout(() => {
          suppressClickRef.current = false;
          suppressClickTimeoutRef.current = null;
        }, 0);

        if (session.dragged) onCommitRef.current?.(session.activeTab);
      };

      cleanupListenersRef.current?.();
      cleanupListenersRef.current = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", finishDrag);
        window.removeEventListener("pointercancel", finishDrag);
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", finishDrag);
      window.addEventListener("pointercancel", finishDrag);
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
      if (suppressClickTimeoutRef.current !== null) {
        window.clearTimeout(suppressClickTimeoutRef.current);
      }
    },
    []
  );

  return { tabBarRef, onPointerDown, shouldSuppressClick };
}
