"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import DistanceLabel from "@/components/DistanceLabel";
import SiteHeader from "@/components/SiteHeader";
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
  const legendListRef = useRef<HTMLDivElement | null>(null);
  const mapLocationRequestedRef = useRef(false);

  const topText = "text-white";
  const controlBase =
    "w-full px-4 py-3 rounded-2xl border border-[#e7dfcf] bg-[#f6efe3] " +
    "text-[#0f2a22] placeholder:text-[#0f2a22]/50 font-semibold shadow-sm transition-colors transition-transform duration-150 hover:bg-[#efe5d6] " +
    "active:scale-[1.03] focus:outline-none";

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
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LAST_CITY_VIEW_KEY, view);
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

    return prioritizeSpots(
      filteredSpots.filter(
        (spot) => normalizeCategorySlug(spot.category_slug) === selectedMapLegendSlug
      )
    );
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

  function getSelectWidth(label: string, min = 140) {
    return `${Math.max(min, label.length * 9 + 48)}px`;
  }

  const categoryFilterWidth = getSelectWidth(selectedCategoryLabel, 150);
  const sortFilterWidth = getSelectWidth(selectedSortLabel, 170);
  const deliveryFilterWidth = getSelectWidth(selectedDeliveryLabel, 170);

  return (
    <main className="mx-auto max-w-[560px] p-4 pb-28">
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="flex h-10 w-10 -ml-2 items-center justify-center text-[28px] font-semibold leading-none text-white transition active:scale-90"
          aria-label="Zurück"
        >
          ‹
        </button>

        <TopRightMenu onOpenChange={setMenuOpen} />
      </div>

      <div className="mb-6 text-center">
        <SiteHeader subtitle={null as any} compact />

        <div className="mt-4">
          <h1 className="text-3xl font-extrabold italic tracking-wide text-white md:text-4xl">
            Entdecken
          </h1>
          <p className="mt-2 text-sm italic text-white/80">Spots aus allen Städten</p>
        </div>

        {view !== "tasteDesMonats" && (
          <div className="mb-5 mt-6">
            <div className="flex flex-col gap-4">
              <div className="text-left">
                <label className={`mb-2 block font-extrabold ${topText}`}>Filter</label>

                <div className="no-scrollbar w-full max-w-full overflow-x-auto">
                  <div className="flex min-w-max gap-3">
                    <div
                      className="shrink-0"
                      style={{ width: categoryFilterWidth }}
                    >
                      <select
                        value={category}
                        onChange={(e) => {
                          setCategory(e.target.value);
                          setSearch("");
                        }}
                        className={controlBase}
                      >
                        <option value="all">Kategorie: Alle</option>
                        {categories.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div
                      className="shrink-0"
                      style={{ width: sortFilterWidth }}
                    >
                      <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value as typeof sort)}
                        className={controlBase}
                      >
                        <option value="random">Sortierung: Zufällig</option>
                        <option value="rating">Best bewertet</option>
                        <option value="price">Preis</option>
                        <option value="distance" disabled={!userPos}>
                          Nähe (GPS)
                        </option>
                      </select>
                    </div>

                    <div
                      className="shrink-0"
                      style={{ width: deliveryFilterWidth }}
                    >
                      <select
                        value={deliveryFilter}
                        onChange={(e) =>
                          setDeliveryFilter(e.target.value as "all" | "with" | "without")
                        }
                        className={controlBase}
                      >
                        <option value="all">Lieferung: Alle</option>
                        <option value="with">Mit Lieferung</option>
                        <option value="without">Vor Ort essen</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4 text-left">
                <label className={`mb-2 block font-extrabold ${topText}`}>Ansicht</label>

                <div className="no-scrollbar w-full max-w-full overflow-x-auto">
                  <div className="flex min-w-max gap-3">
                    <button
                      onClick={() => setView("list")}
                      className={`min-w-[180px] shrink-0 rounded-2xl border px-4 py-3 font-semibold transition-all ${
                        view === "list"
                          ? "bg-white border-[#e7dfcf] text-[#0f3b2e] shadow-sm"
                          : "bg-[#f6efe3] border-[#e7dfcf] text-[#0f3b2e] hover:bg-[#efe4d1]"
                      }`}
                    >
                      Liste
                    </button>

                    <button
                      onClick={() => setView("map")}
                      className={`min-w-[180px] shrink-0 rounded-2xl border px-4 py-3 font-semibold transition-all ${
                        view === "map"
                          ? "bg-white border-[#e7dfcf] text-[#0f3b2e] shadow-sm"
                          : "bg-[#f6efe3] border-[#e7dfcf] text-[#0f3b2e] hover:bg-[#efe4d1]"
                      }`}
                    >
                      Karte
                    </button>

                    <button
                      onClick={() => {
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
                            setGeoError(
                              "Standort konnte nicht abgerufen werden. Bitte Standort erlauben."
                            ),
                          { enableHighAccuracy: true, timeout: 10000 }
                        );
                      }}
                      className="min-w-[180px] shrink-0 whitespace-nowrap rounded-2xl border border-[#e7dfcf] bg-[#f6efe3] px-4 py-3 font-semibold text-[#0f3b2e] shadow-sm transition hover:bg-[#efe5d6]"
                    >
                      📍 In meiner Nähe
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {view !== "tasteDesMonats" && geoError ? (
        <div className="mb-3 text-sm text-red-200">{geoError}</div>
      ) : null}

      {view !== "tasteDesMonats" && userPos ? (
        <div className="mb-4 rounded-2xl border border-[#e7dfcf] bg-[#f6efe3] p-4 text-[#0f2a22] shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="font-extrabold">Umkreis</div>
            <button
              type="button"
              onClick={() => {
                setUserPos(null);
                setRadiusKm(30);
                setSort("random");
              }}
              className="rounded-2xl border border-[#e7dfcf] bg-[#f6efe3] px-3 py-2 text-sm font-semibold text-[#0f3b2e] shadow-sm transition hover:bg-[#efe5d6]"
              title="Standort zurücksetzen"
              aria-label="Standort zurücksetzen"
            >
              ✕
            </button>
          </div>

          <div className="mt-3">
            <select
              value={radiusKm}
              onChange={(e) => {
                setRadiusKm(Number(e.target.value));
                setSort("distance");
              }}
              className={controlBase}
            >
              <option value={2}>2 km</option>
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
              <option value={15}>15 km</option>
              <option value={20}>20 km</option>
              <option value={25}>25 km</option>
              <option value={30}>30 km</option>
            </select>

            <div className="mt-2 text-xs opacity-80">{`Zeige Spots im Umkreis von ${radiusKm} km.`}</div>
          </div>
        </div>
      ) : null}

      {view !== "tasteDesMonats" && (
        <div className="mb-4 mt-[-20px]">
          <label className={`mb-2 block font-extrabold ${topText}`}>Suche</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="z.B. Burger, Döner, Pizza…"
            className={controlBase}
          />
        </div>
      )}

      {loading ? (
        <p className="text-[#f6efe3]">Lade Spots…</p>
      ) : errorMsg ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900">
          <b>Supabase-Fehler:</b> {errorMsg}
        </div>
      ) : view === "map" ? (
        <div className="relative z-0 mt-2">
          <CityMap
            center={mapCenter}
            spots={mapSpots}
            userPos={userPos}
            userRadiusKm={15}
            activeSpotId={activeSpotId}
            onActiveChange={(id: string) => setActiveSpotId(id)}
            onSpotClick={(id: string) => router.push(`/spot/${id}`)}
            selectedLegendSlug={selectedMapLegendSlug}
            onLegendSelect={setSelectedMapLegendSlug}
          />
          <p className="mt-3 text-sm text-[#f6efe3]/80">
            Tipp: Marker anklicken, um den Namen zu sehen.
          </p>

          {selectedMapLegendSlug ? (
            <div ref={legendListRef} className="mt-4 grid gap-3 scroll-mt-4">
              <div className="mb-1 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-extrabold text-white">
                    {labelFromCategorySlug(selectedMapLegendSlug)}
                  </h2>
                  <p className="mt-1 text-sm italic text-white/80">
                    {legendCategorySpots.length} Spots in dieser Kategorie.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMapLegendSlug(null)}
                  className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Auswahl aufheben
                </button>
              </div>

              {legendCategorySpots.map((s) => (
                <div
                  key={s.id}
                  onClick={() => router.push(`/spot/${s.id}`)}
                  className="relative min-w-0 cursor-pointer rounded-2xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-3 shadow-sm transition-all duration-300 hover:shadow-lg"
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
          <div className="mb-1">
            <h2 className="text-xl font-extrabold text-white">Taste des Monats</h2>
            <p className="mt-1 text-sm italic text-white/80">
              Drei Spots, die ich diesen Monat besonders feiere.
            </p>
          </div>

          {tasteDesMonatsSpots.length === 0 ? (
            <p className="text-[#f6efe3]">Keine Spots für Taste des Monats hinterlegt.</p>
          ) : (
            tasteDesMonatsSpots.map((s) => (
              <div
                key={s.id}
                onClick={() => router.push(`/spot/${s.id}`)}
                className="relative min-w-0 cursor-pointer rounded-2xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-3 shadow-sm transition-all duration-300 hover:shadow-lg"
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
                className="relative min-w-0 cursor-pointer rounded-2xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-4 shadow-sm transition-all duration-300 hover:shadow-lg"
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
