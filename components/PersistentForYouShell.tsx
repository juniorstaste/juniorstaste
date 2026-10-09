"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import ForYouPageContent from "@/components/ForYouPageContent";

export default function PersistentForYouShell() {
  const pathname = usePathname();
  const isForYouRoute = pathname === "/for-you";
  const [shouldMountForYou, setShouldMountForYou] = useState(isForYouRoute);

  useEffect(() => {
    if (isForYouRoute) {
      setShouldMountForYou(true);
    }
  }, [isForYouRoute]);

  if (!shouldMountForYou) return null;

  return (
    <div style={{ display: isForYouRoute ? "block" : "none" }}>
      <ForYouPageContent isVisible={isForYouRoute} />
    </div>
  );
}
