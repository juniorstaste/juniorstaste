"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import SavedPageContent from "@/components/SavedPageContent";

function PersistentPane({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const scrollYRef = useRef(0);
  const wasActiveRef = useRef(active);

  useEffect(() => {
    if (!active) return;

    const saveScroll = () => {
      scrollYRef.current = window.scrollY;
    };

    saveScroll();
    window.addEventListener("scroll", saveScroll, { passive: true });
    window.addEventListener("pagehide", saveScroll);

    return () => {
      saveScroll();
      window.removeEventListener("scroll", saveScroll);
      window.removeEventListener("pagehide", saveScroll);
    };
  }, [active]);

  useLayoutEffect(() => {
    if (!wasActiveRef.current && active) {
      const restoreScroll = () => {
        window.scrollTo(0, scrollYRef.current);
      };
      let secondFrame = 0;

      restoreScroll();
      const firstFrame = window.requestAnimationFrame(() => {
        restoreScroll();
        secondFrame = window.requestAnimationFrame(restoreScroll);
      });

      wasActiveRef.current = active;
      return () => {
        window.cancelAnimationFrame(firstFrame);
        window.cancelAnimationFrame(secondFrame);
      };
    }

    wasActiveRef.current = active;
  }, [active]);

  return <div style={{ display: active ? "block" : "none" }}>{children}</div>;
}

export default function PersistentMainTabsShell() {
  const pathname = usePathname();
  const isSavedRoute = pathname === "/saved";
  const [shouldMountSaved, setShouldMountSaved] = useState(isSavedRoute);

  useLayoutEffect(() => {
    if (isSavedRoute) {
      setShouldMountSaved(true);
    }
  }, [isSavedRoute]);

  return (
    <>
      {shouldMountSaved ? (
        <PersistentPane active={isSavedRoute}>
          <SavedPageContent isVisible={isSavedRoute} />
        </PersistentPane>
      ) : null}
    </>
  );
}
