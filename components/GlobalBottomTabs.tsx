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

export default function GlobalBottomTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const [view, setView] = useState<CityTabView>("list");

  useEffect(() => {
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
      router.push(buildCityViewHref(citySlug, nextView));
      return;
    }

    router.push(buildCityViewHref(LAST_CITY_FALLBACK_SLUG, nextView));
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
