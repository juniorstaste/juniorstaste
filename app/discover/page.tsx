"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import DistanceLabel from "@/components/DistanceLabel";
import BottomTabs from "@/components/BottomTabs";
import TopRightMenu from "@/components/TopRightMenu";
import SaveSpotButton from "@/components/SaveSpotButton";
import ShareSpotButton from "@/components/ShareSpotButton";
import SpotTikTokSection from "@/components/SpotTikTokSection";
import DeliveryButtons from "@/components/DeliveryButtons";
import { trackAndOpenExternalLink } from "@/lib/externalClickTracking";
import {
  getColorForCategory,
  labelFromCategorySlug,
  normalizeCategorySlug,
} from "@/lib/cityMapCategories";
import { LAST_CITY_VIEW_KEY } from "@/lib/lastCityNavigation";
import { safeSetItem } from "@/lib/safeStorage";
import { prioritizeSpots } from "@/lib/prioritySpot";

const CityMap = dynamic(() => import("@/components/CityMap"), { ssr: false });

type Spot = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  tiktok_embed_id: string | null;
  google_maps_link: string | null;
  rating: number | null;
  price_level: number | null;
  city_name?: string | null;
  city_slug?: string | null;
  category_slug?: string | null;
  category_name?: string | null;
  created_at?: string | null;
  wolt_url?: string | null;
  lieferando_url?: string | null;
  uber_eats_url?: string | null;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function hasDeliveryOption(spot: Spot) {
  return Boolean(spot.wolt_url || spot.lieferando_url || spot.uber_eats_url);
}

function shuffleSpots<T>(items: T[]) {
  const next = [...items];

  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }

  return next;
}

const TASTE_DES_MONATS_IDS = [
  "0f63bbc8-7050-4406-b512-3e133965a1e4",
  "4eb57f03-101e-4d80-98cc-42d3f148b57a",
];

function normalizeCategoryKey(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[/_-]+/g, " ")
    .replace(/&/g, " ")
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getCategoryEmoji(slug?: string | null, name?: string | null) {
  const key = normalizeCategoryKey(slug) || normalizeCategoryKey(name);

  if (!key || key === "all" || key === "alle") return "✨";
  if (key.includes("asian") || key.includes("asia") || key.includes("sushi")) return "🍣";
  if (key.includes("burger")) return "🍔";
  if (key.includes("doener") || key.includes("doner") || key.includes("kebab")) return "🥙";
  if (
    key.includes("fried chicken") ||
    key.includes("chicken") ||
    key.includes("haehnchen") ||
    key.includes("hahnchen")
  ) {
    return "🍗";
  }
  if (
    key.includes("kaffee") ||
    key.includes("fruehstueck") ||
    key.includes("dessert") ||
    key.includes("coffee") ||
    key.includes("breakfast")
  ) {
    return "☕";
  }
  if (key.includes("pizza")) return "🍕";
  if (key.includes("sandwich")) return "🥪";
  if (
    key.includes("tacos burritos") ||
    key.includes("tacos") ||
    key.includes("burritos") ||
    key.includes("mexican")
  ) {
    return "🌮";
  }

  return null;
}

function getCategorySortOrder(slug?: string | null, name?: string | null) {
  const key = normalizeCategoryKey(slug) || normalizeCategoryKey(name);

  if (key.includes("burger")) return 1;
  if (key.includes("fried chicken") || key.includes("chicken") || key.includes("haehnchen") || key.includes("hahnchen")) return 2;
  if (key.includes("doener") || key.includes("doner") || key.includes("kebab")) return 3;
  if (
    key.includes("kaffee") ||
    key.includes("fruehstueck") ||
    key.includes("dessert") ||
    key.includes("coffee") ||
    key.includes("breakfast")
  ) {
    return 4;
  }
  if (key.includes("pizza")) return 5;
  if (key.includes("asian") || key.includes("asia") || key.includes("sushi")) return 6;
  if (key.includes("tacos burritos") || key.includes("tacos") || key.includes("burritos") || key.includes("mexican")) return 7;
  if (key.includes("orientalisch") || key.includes("oriental")) return 8;

  return 99;
}

export default function DiscoverPage() {
  const router = useRouter();

  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "map" | "tasteDesMonats">("list");
  const [sort, setSort] = useState<"random" | "rating" | "price" | "distance">("random");
  const [deliveryFilter, setDeliveryFilter] = useState<"all" | "with" | "without">("all");
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(30);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);
  const [selectedMapLegendSlug, setSelectedMapLegendSlug] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const legendListRef = useRef<HTMLDivElement | null>(null);
  const mapLocationRequestedRef = useRef(false);

  const chipButtonBase =
    "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-150 active:scale-[1.03]";
  const compactControlBase =
    "w-full appearance-none rounded-full border border-white/10 bg-white/10 px-4 py-2 text-center text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-white/15 active:scale-[1.03] focus:outline-none";
  const segmentedButtonBase =
    "flex min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold transition-all duration-150 active:scale-[1.03]";

  useEffect(() => {
    async function loadSpots() {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("spots_with_city")
        .select("*");

      if (error) {
        setErrorMsg(error.message);
        setSpots([]);
        setLoading(false);
        return;
      }

      setSpots(prioritizeSpots(shuffleSpots((data as Spot[]) ?? [])));
      setLoading(false);
    }

    loadSpots();
  }, []);

  useEffect(() => {
    safeSetItem(LAST_CITY_VIEW_KEY, view);
  }, [view]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();

    spots.forEach((spot) => {
      if (!spot.category_slug) return;
      map.set(spot.category_slug, spot.category_name ?? spot.category_slug);
    });

    return Array.from(map.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [spots]);

  const tasteDesMonatsSpots = useMemo(() => {
    const ordered =
      spots
        .filter((spot) => TASTE_DES_MONATS_IDS.includes(spot.id))
        .sort((a, b) => TASTE_DES_MONATS_IDS.indexOf(a.id) - TASTE_DES_MONATS_IDS.indexOf(b.id)) ??
      [];

    return prioritizeSpots(ordered);
  }, [spots]);

  const filteredSpots = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = !q
      ? [...spots]
      : spots.filter((s) => {
          const haystack = [s.name, s.description ?? "", s.address ?? "", s.city_name ?? ""]
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        });

    if (category !== "all") {
      list = list.filter((s) => s.category_slug === category);
    }

    if (userPos) {
      list = list.filter((s) => {
        if (typeof s.lat !== "number" || typeof s.lng !== "number") return false;
        const d = haversineKm(userPos, { lat: s.lat as number, lng: s.lng as number });
        return d <= radiusKm;
      });
    }

    if (deliveryFilter === "with") {
      list = list.filter((s) => hasDeliveryOption(s));
    } else if (deliveryFilter === "without") {
      list = list.filter((s) => !hasDeliveryOption(s));
    }

    if (sort === "rating") {
      list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    } else if (sort === "price") {
      list.sort((a, b) => (a.price_level ?? 999) - (b.price_level ?? 999));
    } else if (sort === "distance" && userPos) {
      list.sort((a, b) => {
        if (typeof a.lat !== "number" || typeof a.lng !== "number") return 1;
        if (typeof b.lat !== "number" || typeof b.lng !== "number") return -1;
        const da = haversineKm(userPos, { lat: a.lat as number, lng: a.lng as number });
        const db = haversineKm(userPos, { lat: b.lat as number, lng: b.lng as number });
        return da - db;
      });
    }

    return prioritizeSpots(list);
  }, [spots, search, category, userPos, radiusKm, deliveryFilter, sort]);

  const distanceById = useMemo(() => {
    const map = new Map<string, number>();
    if (!userPos) return map;

    filteredSpots.forEach((s) => {
      if (typeof s.lat !== "number" || typeof s.lng !== "number") return;
      map.set(s.id, haversineKm(userPos, { lat: s.lat as number, lng: s.lng as number }));
    });

    return map;
  }, [filteredSpots, userPos]);

  const mapSpots = useMemo(() => {
    return filteredSpots
      .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
      .map((s) => ({
        id: s.id,
        name: s.name,
        lat: s.lat as number,
        lng: s.lng as number,
        image_url: s.image_url ?? null,
        rating: s.rating ?? null,
        price_level: s.price_level ?? null,
        category_slug: (s.category_slug ?? "other").toString().trim().toLowerCase(),
        google_maps_link: s.google_maps_link ?? null,
        wolt_url: s.wolt_url ?? null,
        lieferando_url: s.lieferando_url ?? null,
        uber_eats_url: s.uber_eats_url ?? null,
      }));
  }, [filteredSpots]);

  const mapCenter = useMemo<[number, number]>(() => {
    const first = mapSpots[0];
    if (first) return [first.lat, first.lng];
    return [52.52, 13.405];
  }, [mapSpots]);

  const legendCategorySpots = useMemo(() => {
    if (!selectedMapLegendSlug) return [];

    // "Alle" ist ein Sonderfall (kein echter Kategorie-Slug) — ohne ihn
    // zeigte die Legende hier immer "0 Spots".
    const categoryFilteredSpots =
      selectedMapLegendSlug === "all"
        ? [...filteredSpots]
        : filteredSpots.filter(
            (spot) => normalizeCategorySlug(spot.category_slug) === selectedMapLegendSlug
          );

    return prioritizeSpots(categoryFilteredSpots);
  }, [filteredSpots, selectedMapLegendSlug]);

  useEffect(() => {
    if (!selectedMapLegendSlug || !legendListRef.current) return;

    const timeoutId = window.setTimeout(() => {
      legendListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [selectedMapLegendSlug, legendCategorySpots.length]);

  useEffect(() => {
    if (view !== "map") return;
    if (userPos) return;
    if (mapLocationRequestedRef.current) return;
    if (typeof window === "undefined" || !navigator.geolocation) return;

    mapLocationRequestedRef.current = true;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [userPos, view]);

  const selectedCategoryLabel =
    category === "all"
      ? "Kategorie: Alle"
      : categories.find((c) => c.slug === category)?.name ?? "Kategorie";

  const selectedSortLabel =
    sort === "random"
      ? "Sortierung: Zufällig"
      : sort === "rating"
      ? "Best bewertet"
      : sort === "price"
      ? "Preis"
      : "Nähe (GPS)";

  const selectedDeliveryLabel =
    deliveryFilter === "all"
      ? "Lieferung: Alle"
      : deliveryFilter === "with"
      ? "Mit Lieferung"
      : "Vor Ort essen";

  const orderedCategories = [...categories].sort((a, b) => {
    const orderDiff = getCategorySortOrder(a.slug, a.name) - getCategorySortOrder(b.slug, b.name);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, "de");
  });

  function getSelectWidth(label: string, min = 140) {
    return `${Math.max(min, label.length * 9 + 48)}px`;
  }

  const isSearchExpanded = isSearchFocused || search.trim().length > 0;
  const sharedContentWidthClass = "w-[94%] max-w-[500px]";
  const searchWidthClass = isSearchExpanded ? sharedContentWidthClass : sharedContentWidthClass;
  const segmentedWidthClass = sharedContentWidthClass;

  function requestNearbySpots() {
    setGeoError(null);

    if (!navigator.geolocation) {
      setGeoError("Dein Browser unterstützt Standort nicht.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setSort("distance");
      },
      () =>
        setGeoError("Standort konnte nicht abgerufen werden. Bitte Standort erlauben."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <main className="mx-auto max-w-[560px] p-4 pb-28">
      <div className="mb-5">
        <div className="relative mb-10 mt-3 h-10">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center justify-start"
            aria-label="Zur Startseite"
          >
            <img
              src="/logos/citypage-logo.png"
              alt="Junior's Taste"
              className="h-auto w-[148px]"
            />
          </button>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-center text-sm font-semibold text-white shadow-sm">
            Entdecken
          </div>

          <div className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center">
            <TopRightMenu onOpenChange={setMenuOpen} />
          </div>
        </div>

        {view !== "map" ? (
          <div className="mb-4 flex justify-center">
            <div className={sharedContentWidthClass}>
              <h1 className="text-[30px] font-extrabold leading-none text-white">
                {view === "tasteDesMonats" ? "Taste des Monats" : "Entdecken"}
              </h1>
              <p className="mt-2 text-sm font-medium text-white/70">
                {view === "tasteDesMonats"
                  ? "Drei Spots, die ich diesen Monat besonders feiere."
                  : "JuniorsTaste's Favorites aus allen Städten"}
              </p>
            </div>
          </div>
        ) : null}

        {view === "list" && (
          <div className="mb-4">
            <div className="flex flex-col gap-3">
              <div className="flex justify-center">
                <div className={`min-w-0 transition-all duration-300 ease-out ${searchWidthClass}`}>
                  <div className="relative flex h-9 items-center rounded-full border border-white/10 bg-white/10 px-3 shadow-sm transition-all duration-300 ease-out">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white" aria-hidden="true">
                      🔍
                    </span>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onFocus={() => setIsSearchFocused(true)}
                      onBlur={() => setIsSearchFocused(false)}
                      placeholder="Foodspots, Burrito, Burger ..."
                      className="h-full min-w-0 flex-1 border-0 bg-transparent pl-5 text-sm font-medium text-white placeholder:text-xs placeholder:font-normal placeholder:text-white/35 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="text-left">
                <div className="w-full max-w-full overflow-x-auto no-scrollbar">
                  <div className="flex min-w-max gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCategory("all");
                        setSearch("");
                      }}
                      className={`${chipButtonBase} ${category === "all" ? "jt-active-gradient-soft border-transparent" : "border-white/10 bg-white/10 text-white/85 hover:bg-white/15"}`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden="true">{getCategoryEmoji("all", "Alle")}</span>
                        <span>Alle</span>
                      </span>
                    </button>
                    {orderedCategories.map((c) => (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => {
                          setCategory(c.slug);
                          setSearch("");
                        }}
                        className={`${chipButtonBase} ${category === c.slug ? "jt-active-gradient-soft border-transparent" : "border-white/10 bg-white/10 text-white/85 hover:bg-white/15"}`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {getCategoryEmoji(c.slug, c.name) ? <span aria-hidden="true">{getCategoryEmoji(c.slug, c.name)}</span> : null}
                          <span>{c.name}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-4 text-left">
                <div className="flex justify-center">
                  <div className={`flex ${segmentedWidthClass} rounded-full border border-white/10 bg-white/10 p-1 shadow-sm`}>
                    <button
                      onClick={() => setView("list")}
                      className={`${segmentedButtonBase} ${view === "list" ? "jt-active-gradient-soft" : "bg-transparent text-white/80 hover:bg-white/10"}`}
                    >
                      Liste
                    </button>
                    <button
                      onClick={() => setView("map")}
                      className={`${segmentedButtonBase} bg-transparent text-white/80 hover:bg-white/10`}
                    >
                      Karte
                    </button>
                    <button
                      onClick={() => setView("tasteDesMonats")}
                      className={`${segmentedButtonBase} bg-transparent text-white/80 hover:bg-white/10`}
                    >
                      Taste des Monats
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-left">
                <div className="w-full max-w-full overflow-x-auto no-scrollbar">
                  <div className="flex min-w-max justify-center gap-2">
                    <div className="shrink-0" style={{ width: getSelectWidth(selectedSortLabel, 154) }}>
                      <select
                        value={sort}
                        onChange={(e) => {
                          const nextSort = e.target.value as typeof sort;
                          if (nextSort === "distance") {
                            requestNearbySpots();
                            return;
                          }
                          setSort(nextSort);
                        }}
                        className={`${compactControlBase} ${sort !== "random" ? "jt-active-gradient-soft border-transparent" : ""}`}
                        style={{ textAlignLast: "center" }}
                      >
                        <option value="random">Sortierung: Zufällig</option>
                        <option value="rating">Best bewertet</option>
                        <option value="price">Preis</option>
                        <option value="distance">Nähe (GPS)</option>
                      </select>
                    </div>

                    <div className="shrink-0" style={{ width: getSelectWidth(selectedDeliveryLabel, 154) }}>
                      <select
                        value={deliveryFilter}
                        onChange={(e) => setDeliveryFilter(e.target.value as "all" | "with" | "without")}
                        className={`${compactControlBase} ${deliveryFilter !== "all" ? "jt-active-gradient-soft border-transparent" : ""}`}
                        style={{ textAlignLast: "center" }}
                      >
                        <option value="all">Lieferung: Alle</option>
                        <option value="with">Mit Lieferung</option>
                        <option value="without">Vor Ort essen</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {view === "list" && geoError ? (
        <div className="mb-3 text-sm text-red-200">{geoError}</div>
      ) : null}

      {view === "list" && userPos ? (
        <div className="mb-4 rounded-[20px] border border-white/10 bg-white/10 p-3 text-white shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold">Umkreis</div>
            <button
              type="button"
              onClick={() => {
                setUserPos(null);
                setRadiusKm(30);
                setSort("random");
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-medium text-white/85 transition hover:bg-white/15"
              title="Standort zurücksetzen"
              aria-label="Standort zurücksetzen"
            >
              ✕
            </button>
          </div>

          <div className="mt-2.5">
            <select
              value={radiusKm}
              onChange={(e) => {
                setRadiusKm(Number(e.target.value));
                setSort("distance");
              }}
              className="w-full appearance-none rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-white/15 active:scale-[1.03] focus:outline-none"
            >
              <option value={2}>2 km</option>
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
              <option value={15}>15 km</option>
              <option value={20}>20 km</option>
              <option value={25}>25 km</option>
              <option value={30}>30 km</option>
            </select>

            <div className="mt-1.5 text-[11px] text-white/75">{`Zeige Spots im Umkreis von ${radiusKm} km.`}</div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-[#f6efe3]">Lade Spots…</p>
      ) : errorMsg ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900">
          <b>Supabase-Fehler:</b> {errorMsg}
        </div>
      ) : view === "map" ? (
        <div className="relative z-0 -mx-4 -mb-6 mt-2 sm:mx-0">
          <div className="pointer-events-none absolute inset-x-4 top-4 z-[1200]">
            <div className="pointer-events-auto mx-auto max-w-[500px]">
              <div className="relative flex h-11 items-center rounded-full border border-white/10 bg-[#0f3b2e]/78 px-4 shadow-lg backdrop-blur-md transition-all duration-300 ease-out">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white" aria-hidden="true">
                  🔍
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  placeholder="Foodspots, Burrito, Burger ..."
                  className="h-full min-w-0 flex-1 border-0 bg-transparent pl-7 text-sm font-medium text-white placeholder:text-sm placeholder:font-normal placeholder:text-white/40 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden sm:rounded-[28px]">
          <CityMap
            center={mapCenter}
            spots={mapSpots}
            categories={orderedCategories}
            userPos={userPos}
            userRadiusKm={15}
            activeSpotId={activeSpotId}
            onActiveChange={(id: string) => setActiveSpotId(id)}
            onSpotClick={(id: string) => router.push(`/spot/${id}`)}
            selectedLegendSlug={selectedMapLegendSlug}
            onLegendSelect={setSelectedMapLegendSlug}
            immersiveSheet
          />
          </div>

          {selectedMapLegendSlug ? (
            <div ref={legendListRef} className="mt-4 grid gap-3 scroll-mt-4">
              <div className="mb-1 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-white">
                    {labelFromCategorySlug(selectedMapLegendSlug)}
                  </h2>
                  <p className="mt-1 text-sm text-white/75">
                    {legendCategorySpots.length} Spots in dieser Kategorie.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMapLegendSlug(null)}
                  className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Auswahl aufheben
                </button>
              </div>

              {legendCategorySpots.map((s) => (
                <div
                  key={s.id}
                  onClick={() => router.push(`/spot/${s.id}`)}
                  className="relative min-w-0 cursor-pointer rounded-2xl border border-[#efe7da]/45 bg-[#fffaf2]/90 p-3 shadow-sm backdrop-blur-sm transition-all duration-300 hover:bg-[#fffaf2]/94 hover:shadow-lg"
                >
                  <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                    <ShareSpotButton spotId={s.id} spotName={s.name} variant="list" />
                    <SaveSpotButton spotId={s.id} variant="list" />
                  </div>

                  <div className="min-w-0 flex gap-3">
                    {s.image_url ? (
                      <img
                        src={s.image_url}
                        alt={s.name}
                        className="h-16 w-16 rounded-xl object-cover ring-1 ring-black/5"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-xl bg-[#f3ecdf] ring-1 ring-black/5" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ backgroundColor: getColorForCategory(s.category_slug) }}
                        />
                        <h3 className="truncate text-sm font-extrabold text-[#1f1f1f]">
                          {s.name}
                        </h3>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5a5348]">
                        {s.city_name ? <span className="font-medium">{s.city_name}</span> : null}

                        {typeof s.rating === "number" ? (
                          <span className="flex items-center gap-1">
                            <span className="text-[#d4a017]">★</span>
                            <span className="font-semibold text-[#9a6b00]">{s.rating.toFixed(1)}</span>
                          </span>
                        ) : null}

                        {typeof s.price_level === "number" ? (
                          <span className="font-semibold text-[#3b342b]">
                            {"€".repeat(Math.max(1, Math.min(4, s.price_level)))}
                          </span>
                        ) : null}
                      </div>

                      {s.address ? (
                        <p className="mt-1 break-words text-xs text-[#6b6256]">{s.address}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : view === "tasteDesMonats" ? (
        <div className="grid gap-3">
          {tasteDesMonatsSpots.length === 0 ? (
            <p className="text-[#f6efe3]">Keine Spots für Taste des Monats hinterlegt.</p>
          ) : (
            tasteDesMonatsSpots.map((s) => (
              <div
                key={s.id}
                onClick={() => router.push(`/spot/${s.id}`)}
                className="relative min-w-0 cursor-pointer rounded-2xl border border-[#efe7da]/45 bg-[#fffaf2]/90 p-3 shadow-sm backdrop-blur-sm transition-all duration-300 hover:bg-[#fffaf2]/94 hover:shadow-lg"
              >
                <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                  <ShareSpotButton spotId={s.id} spotName={s.name} variant="list" />
                  <SaveSpotButton spotId={s.id} variant="list" />
                </div>

                <div className="min-w-0 flex gap-3">
                  {s.image_url ? (
                    <img
                      src={s.image_url}
                      alt={s.name}
                      className="h-16 w-16 rounded-xl object-cover ring-1 ring-black/5"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-[#f3ecdf] ring-1 ring-black/5" />
                  )}

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-extrabold text-[#1f1f1f]">{s.name}</h2>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5a5348]">
                      {s.city_name ? <span className="font-medium">{s.city_name}</span> : null}

                      {typeof s.rating === "number" ? (
                        <span className="flex items-center gap-1">
                          <span className="text-[#d4a017]">★</span>
                          <span className="font-semibold text-[#9a6b00]">{s.rating.toFixed(1)}</span>
                        </span>
                      ) : null}

                      {typeof s.price_level === "number" ? (
                        <span className="font-semibold text-[#3b342b]">
                          {"€".repeat(Math.max(1, Math.min(4, s.price_level)))}
                        </span>
                      ) : null}
                    </div>

                    {s.address ? (
                      <p className="mt-1 break-words text-xs text-[#6b6256]">{s.address}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : filteredSpots.length === 0 ? (
        <p className="text-[#f6efe3]">Keine Spots gefunden.</p>
      ) : (
        <div className="grid gap-3">
          {filteredSpots.map((s) => {
            const wolt = s.wolt_url ?? null;
            const lieferando = s.lieferando_url ?? null;
            const uberEats = s.uber_eats_url ?? null;

            return (
              <div
                key={s.id}
                onClick={() => router.push(`/spot/${s.id}`)}
                className="relative min-w-0 cursor-pointer rounded-2xl border border-[#efe7da]/45 bg-[#fffaf2]/90 p-4 shadow-sm backdrop-blur-sm transition-all duration-300 hover:bg-[#fffaf2]/94 hover:shadow-lg"
              >
                <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                  <ShareSpotButton spotId={s.id} spotName={s.name} variant="list" />
                  <SaveSpotButton spotId={s.id} variant="list" />
                </div>

                <div className="min-w-0 flex gap-3">
                  {s.image_url ? (
                    <img
                      src={s.image_url}
                      alt={s.name}
                      className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-black/5"
                    />
                  ) : (
                    <div className="h-20 w-20 shrink-0 rounded-xl bg-[#f3ecdf] ring-1 ring-black/5" />
                  )}

                  <div className="min-w-0 flex-1 pr-8">
                    <h2 className="break-words text-base font-extrabold text-[#1f1f1f] sm:truncate">
                      {s.name}
                    </h2>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#5a5348]">
                      {s.city_name ? <span className="font-medium">{s.city_name}</span> : null}

                      {typeof s.rating === "number" ? (
                        <span className="flex items-center gap-1">
                          <span className="text-[#d4a017]">★</span>
                          <span className="font-semibold text-[#9a6b00]">{s.rating.toFixed(1)}</span>
                        </span>
                      ) : null}

                      {typeof s.price_level === "number" ? (
                        <span className="font-semibold text-[#3b342b]">
                          {"€".repeat(Math.max(1, Math.min(4, s.price_level)))}
                        </span>
                      ) : null}
                    </div>

                    {userPos && distanceById.has(s.id) ? (
                      <div className="mt-1">
                        <DistanceLabel km={distanceById.get(s.id)!} />
                      </div>
                    ) : null}

                    {s.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-[#2f2a23]">{s.description}</p>
                    ) : null}

                    {s.address ? (
                      <p className="mt-1 break-words text-sm text-[#6b6256]">{s.address}</p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 min-w-0 flex flex-wrap gap-2">
                  {s.google_maps_link ? (
                    <a
                      href={s.google_maps_link}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) =>
                        void trackAndOpenExternalLink({
                          event: e,
                          url: s.google_maps_link!,
                          spotId: s.id,
                          buttonType: "maps",
                        })
                      }
                      className="max-w-full break-words rounded-xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-2.5 text-[15px] font-semibold text-[#1f1f1f] shadow-sm transition hover:bg-[#f6efe3]"
                    >
                      Google Maps
                    </a>
                  ) : null}

                  <DeliveryButtons
                    spotId={s.id}
                    woltUrl={wolt}
                    lieferandoUrl={lieferando}
                    uberEatsUrl={uberEats}
                  />
                </div>

                {s.tiktok_embed_id ? (
                  <SpotTikTokSection
                    key={`${s.id}-${s.tiktok_embed_id}`}
                    embedInstanceId={`${s.id}-${s.tiktok_embed_id}`}
                    videoId={s.tiktok_embed_id}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {!menuOpen ? <BottomTabs view={view} onChange={setView} /> : null}
    </main>
  );
}
