"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BottomTabs from "@/components/BottomTabs";
import {
  buildCityViewHref,
  CityTabView,
  isCityTabView,
  LAST_CITY_FALLBACK_SLUG,
  LAST_CITY_SLUG_KEY,
  LAST_CITY_VIEW_KEY,
} from "@/lib/lastCityNavigation";
import { safeGetItem, safeSetItem } from "@/lib/safeStorage";

export default function GlobalBottomTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const [view, setView] = useState<CityTabView | "saved">("list");

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

    const storedView = safeGetItem(LAST_CITY_VIEW_KEY);
    setView(isCityTabView(storedView) ? storedView : "list");
  }, [pathname]);

  function handleChange(nextView: CityTabView) {
    setView(nextView);

    safeSetItem(LAST_CITY_VIEW_KEY, nextView);
    const citySlug = safeGetItem(LAST_CITY_SLUG_KEY) || LAST_CITY_FALLBACK_SLUG;
    router.push(buildCityViewHref(citySlug, nextView));
  }

  if (!pathname || pathname === "/") return null;

  if (
    pathname.startsWith("/city/") ||
    pathname.startsWith("/near") ||
    pathname.startsWith("/discover")
  ) {
    return null;
  }

  return <BottomTabs view={view} onChange={handleChange} />;
}
