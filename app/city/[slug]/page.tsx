"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import TikTokEmbed from "@/components/TikTokEmbed";
import DistanceLabel from "@/components/DistanceLabel";
import SiteHeader from "@/components/SiteHeader";
import BottomTabs from "@/components/BottomTabs";
import TopRightMenu from "@/components/TopRightMenu";
import SaveSpotButton from "@/components/SaveSpotButton";
import {
  getColorForCategory,
  labelFromCategorySlug,
  normalizeCategorySlug,
} from "@/components/CityMap";

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
  wolt_link?: string | null;
  lieferando_link?: string | null;
  uber_eats_url?: string | null;
  uber_eats_link?: string | null;
  ubereats_url?: string | null;
  ubereats_link?: string | null;
};

type City = { id: string; name: string; slug: string };

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
  return Boolean(
    spot.wolt_url ||
      spot.wolt_link ||
      spot.lieferando_url ||
      spot.lieferando_link ||
      spot.uber_eats_url ||
      spot.uber_eats_link ||
      spot.ubereats_url ||
      spot.ubereats_link
  );
}

const TASTE_DES_MONATS_IDS = [
  "0f63bbc8-7050-4406-b512-3e133965a1e4",
  "4eb57f03-101e-4d80-98cc-42d3f148b57a",
];

export default function CityPage() {
  const router = useRouter();
  const params = useParams();

  const citySlug = useMemo(() => {
    const raw = (params as any)?.slug;
    if (!raw) return null;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [spots, setSpots] = useState<Spot[]>([]);
  const [tasteDesMonatsSpots, setTasteDesMonatsSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [cities, setCities] = useState<City[]>([]);
  const [citySelectValue, setCitySelectValue] = useState<string>("");

  const [category, setCategory] = useState<string>("all");
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "map" | "tasteDesMonats">("list");
  const [sort, setSort] = useState<"newest" | "rating" | "price" | "distance">("newest");
  const [deliveryFilter, setDeliveryFilter] = useState<"all" | "with" | "without">("all");

  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [radiusEnabled, setRadiusEnabled] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);
  const [selectedMapLegendSlug, setSelectedMapLegendSlug] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const legendListRef = useRef<HTMLDivElement | null>(null);

  const topText = "text-white";

  const controlBase =
    "w-full px-4 py-3 rounded-2xl border border-[#e7dfcf] bg-[#f6efe3] " +
    "text-[#0f2a22] placeholder:text-[#0f2a22]/50 font-semibold shadow-sm transition hover:bg-[#efe5d6] " +
    "focus:outline-none focus:ring-2 focus:ring-[#c6a85b]";

  useEffect(() => {
    if (citySlug) setCitySelectValue(citySlug);
  }, [citySlug]);

  useEffect(() => {
    async function loadCities() {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, slug")
        .order("name", { ascending: true });

      if (!error) setCities((data as City[]) ?? []);
    }

    loadCities();
  }, []);

  async function handleCitySelectChange(next: string) {
    setCitySelectValue(next);

    if (next === "__near__") {
      setGeoError(null);

      if (!navigator.geolocation) {
        setGeoError("Dein Browser unterstützt Standort nicht.");
        if (citySlug) setCitySelectValue(citySlug);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          router.push(`/near?lat=${lat}&lng=${lng}&r=5`);
        },
        () => {
          setGeoError("Standort konnte nicht abgerufen werden. Bitte Standort erlauben.");
          if (citySlug) setCitySelectValue(citySlug);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );

      return;
    }

    if (next) router.push(`/city/${next}`);
  }

  useEffect(() => {
    if (!citySlug) return;

    async function loadSpots() {
      setLoading(true);
      setErrorMsg(null);

      let query = supabase
        .from("spots_with_city")
        .select("*")
        .eq("city_slug", citySlug)
        .order("created_at", { ascending: false });

      if (category !== "all") query = query.eq("category_slug", category);

      const { data, error } = await query;

      if (error) {
        setErrorMsg(error.message);
        setSpots([]);
        setLoading(false);
        return;
      }

      setSpots((data as Spot[]) ?? []);
      setLoading(false);
    }

    loadSpots();
  }, [citySlug, category]);

  useEffect(() => {
    if (!citySlug) return;

    async function loadCategories() {
      const { data, error } = await supabase
        .from("spots_with_city")
        .select("category_slug, category_name")
        .eq("city_slug", citySlug);

      if (error) return;

      const map = new Map<string, string>();
      (data ?? []).forEach((row: any) => {
        if (row.category_slug) map.set(row.category_slug, row.category_name ?? row.category_slug);
      });

      const list = Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(list);
    }

    loadCategories();
  }, [citySlug]);

  useEffect(() => {
    async function loadTasteDesMonats() {
      const { data, error } = await supabase
        .from("spots_with_city")
        .select("*")
        .in("id", TASTE_DES_MONATS_IDS);

      if (error) return;

      const ordered =
        (data as Spot[] | null)?.sort(
          (a, b) =>
            TASTE_DES_MONATS_IDS.indexOf(a.id) - TASTE_DES_MONATS_IDS.indexOf(b.id)
        ) ?? [];

      setTasteDesMonatsSpots(ordered);
    }

    loadTasteDesMonats();
  }, []);

  const filteredSpots = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = !q
      ? [...spots]
      : spots.filter((s) => {
          const haystack = [s.name, s.description ?? "", s.address ?? ""].join(" ").toLowerCase();
          return haystack.includes(q);
        });

    if (radiusEnabled && userPos) {
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
    } else {
      list.sort((a, b) => {
        if (citySlug === "stuttgart") {
          const aIsBun = a.name === "Bun'n Smash";
          const bIsBun = b.name === "Bun'n Smash";

          if (aIsBun && !bIsBun) return -1;
          if (!aIsBun && bIsBun) return 1;
        }

        const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bd - ad;
      });
    }

    return list;
  }, [spots, search, sort, userPos, radiusKm, radiusEnabled, deliveryFilter, citySlug]);

  const distanceById = useMemo(() => {
    const map = new Map<string, number>();
    if (!userPos) return map;

    filteredSpots.forEach((s) => {
      if (typeof s.lat !== "number" || typeof s.lng !== "number") return;
      const d = haversineKm(userPos, { lat: s.lat as number, lng: s.lng as number });
      map.set(s.id, d);
    });

    return map;
  }, [filteredSpots, userPos]);

  const mapSpots = useMemo(() => {
    return filteredSpots
      .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
      .map((s) => {
        const wolt = s.wolt_url ?? s.wolt_link ?? null;
        const lieferando = s.lieferando_url ?? s.lieferando_link ?? null;

        return {
          id: s.id,
          name: s.name,
          lat: s.lat as number,
          lng: s.lng as number,
          image_url: s.image_url ?? null,
          rating: s.rating ?? null,
          price_level: s.price_level ?? null,
          category_slug: (s.category_slug ?? "other").toString().trim().toLowerCase(),
          wolt_url: wolt,
          lieferando_url: lieferando,
        };
      });
  }, [filteredSpots]);

  const mapCenter = useMemo<[number, number]>(() => {
    const first = mapSpots[0];
    if (first) return [first.lat, first.lng];
    return [52.52, 13.405];
  }, [mapSpots]);

  const legendCategorySpots = useMemo(() => {
    if (!selectedMapLegendSlug) return [];

    return filteredSpots.filter(
      (spot) => normalizeCategorySlug(spot.category_slug) === selectedMapLegendSlug
    );
  }, [filteredSpots, selectedMapLegendSlug]);

  useEffect(() => {
    if (!selectedMapLegendSlug || !legendListRef.current) return;

    const timeoutId = window.setTimeout(() => {
      legendListRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectedMapLegendSlug, legendCategorySpots.length]);

  if (!citySlug) return <main className="p-4">Lade Stadt…</main>;

  const selectedCityLabel =
    citySelectValue === "__near__"
      ? "📍 In meiner Nähe suchen…"
      : cities.find((c) => c.slug === citySelectValue)?.name ?? "Stadt";

  const selectedCategoryLabel =
    category === "all"
      ? "Kategorie: Alle"
      : categories.find((c) => c.slug === category)?.name ?? "Kategorie";

  const selectedSortLabel =
    sort === "newest"
      ? "Sortierung: Neueste"
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

  return (
    <main className="mx-auto max-w-[560px] p-4 pb-28">
      <div className="mb-3 flex items-center justify-between">
        <button
  onClick={() => router.push("/")}
className="flex items-center justify-center w-10 h-10 -ml-2 text-[28px] leading-none text-white font-semibold active:scale-90 transition"
  aria-label="Zurück"
>
  ‹
</button>

        <TopRightMenu onOpenChange={setMenuOpen} />
      </div>

      {/* Logo */}
      <div className="text-center mb-6">
        <SiteHeader subtitle={null as any} compact />

        {view !== "tasteDesMonats" && (
          <div className="mb-5">
            <div className="flex flex-col gap-4">
              {/* FILTER */}
              <div className="text-left">
                <label className={`block mb-2 font-extrabold ${topText}`}>Filter</label>

                <div className="w-full max-w-full overflow-x-auto no-scrollbar">
                  <div className="flex gap-3 min-w-max">
                    {/* Stadt */}
                    <div className="shrink-0" style={{ width: getSelectWidth(selectedCityLabel, 150) }}>
                      <select
                        value={citySelectValue}
                        onChange={(e) => handleCitySelectChange(e.target.value)}
                        className={controlBase + " italic"}
                      >
                        <option value="__near__">📍 In meiner Nähe suchen…</option>
                        <option disabled>──────────</option>
                        {cities.map((c) => (
                          <option key={c.id} value={c.slug}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Kategorie */}
                    <div className="shrink-0" style={{ width: getSelectWidth(selectedCategoryLabel, 150) }}>
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

                    {/* Sortierung */}
                    <div className="shrink-0" style={{ width: getSelectWidth(selectedSortLabel, 170) }}>
                      <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value as any)}
                        className={controlBase}
                      >
                        <option value="newest">Sortierung: Neueste</option>
                        <option value="rating">Best bewertet</option>
                        <option value="price">Preis</option>
                        <option value="distance" disabled={!userPos}>
                          Nähe (GPS)
                        </option>
                      </select>
                    </div>

                    {/* Lieferung */}
                    <div className="shrink-0" style={{ width: getSelectWidth(selectedDeliveryLabel, 170) }}>
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

              {/* ANSICHT */}
              <div className="mb-4 text-left">
                <label className={`block mb-2 font-extrabold ${topText}`}>Ansicht</label>

                <div className="w-full max-w-full overflow-x-auto no-scrollbar">
                  <div className="flex gap-3 min-w-max">
                    {/* Liste */}
                    <button
                      onClick={() => setView("list")}
                      className={`min-w-[180px] px-4 py-3 rounded-2xl whitespace-nowrap border transition-all font-semibold shrink-0 ${
                        view === "list"
  ? "bg-white border-[#e7dfcf] text-[#0f3b2e] shadow-sm"
                          : "bg-[#f6efe3] border-[#e7dfcf] text-[#0f3b2e] hover:bg-[#efe4d1]"
                      }`}
                    >
                      Liste
                    </button>

                    {/* Karte */}
                    <button
                      onClick={() => setView("map")}
                      className={`min-w-[180px] px-4 py-3 rounded-2xl border transition-all font-semibold shrink-0 ${
                        view === "map"
  ? "bg-white border-[#e7dfcf] text-[#0f3b2e] shadow-sm"
                          : "bg-[#f6efe3] border-[#e7dfcf] text-[#0f3b2e] hover:bg-[#efe4d1]"
                      }`}
                    >
                      Karte
                    </button>

                    {/* In meiner Nähe */}
                    <button
                      onClick={() => {
                        setGeoError(null);

                        if (!navigator.geolocation) {
                          setGeoError("Dein Browser unterstützt Standort nicht.");
                          return;
                        }

                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            const lat = pos.coords.latitude;
                            const lng = pos.coords.longitude;
                            setUserPos({ lat, lng });
                            setSort("distance");
                          },
                          () => setGeoError("Standort konnte nicht abgerufen werden. Bitte Standort erlauben."),
                          { enableHighAccuracy: true, timeout: 10000 }
                        );
                      }}
                      className="min-w-[180px] px-4 py-3 rounded-2xl border border-[#e7dfcf] bg-[#f6efe3] text-[#0f3b2e] font-semibold shadow-sm transition hover:bg-[#efe5d6] shrink-0 whitespace-nowrap"
                    >
                      📍 In meiner Nähe
                    </button>

                    {/* Reset */}
                    {userPos ? (
                      <button
                        onClick={() => {
                          setUserPos(null);
                          setRadiusEnabled(false);
                        }}
                        className="px-4 py-3 rounded-2xl border border-[#e7dfcf] bg-[#f6efe3] text-[#0f3b2e] font-semibold shadow-sm transition hover:bg-[#efe5d6] shrink-0"
                        title="Standort zurücksetzen"
                      >
                        ✕
                      </button>
                    ) : null}
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

      {/* ✅ Umkreis */}
      {view !== "tasteDesMonats" && userPos ? (
        <div className="mb-4 rounded-2xl border border-[#e7dfcf] bg-[#f6efe3] p-4 text-[#0f2a22] shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="font-extrabold">Umkreis</div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={radiusEnabled}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setRadiusEnabled(checked);
                  if (checked) setSort("distance");
                }}
              />
              aktiv
            </label>
          </div>

          <div className="mt-3">
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              disabled={!radiusEnabled}
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

            <div className="mt-2 text-xs opacity-80">
              {radiusEnabled
                ? `Zeige Spots im Umkreis von ${radiusKm} km.`
                : "Aktiviere den Umkreis, um Spots zu filtern."}
            </div>
          </div>
        </div>
      ) : null}

      {/* ✅ Suche */}
      {view !== "tasteDesMonats" && (
        <div className="mt-[-20px] mb-4">
          <label className={`block mb-2 font-extrabold ${topText}`}>Suche</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="z.B. Burger, Döner, Pizza…"
            className={controlBase}
          />
        </div>
      )}

      {/* ✅ Content */}
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
            activeSpotId={activeSpotId}
            onActiveChange={(id: string) => setActiveSpotId(id)}
            onSpotClick={(id: string) => router.push(`/spot/${id}`)}
            selectedLegendSlug={selectedMapLegendSlug}
            onLegendSelect={setSelectedMapLegendSlug}
          />
          <p className="mt-3 text-sm text-[#f6efe3]/80">Tipp: Marker anklicken, um den Namen zu sehen.</p>

          {selectedMapLegendSlug ? (
            <div
              ref={legendListRef}
              className="mt-4 grid gap-3 scroll-mt-4"
            >
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
                  <div className="absolute right-3 top-3 z-10">
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
                            <span className="font-semibold text-[#9a6b00]">
                              {s.rating.toFixed(1)}
                            </span>
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
            <p className="text-sm italic text-white/80 mt-1">
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
  <div className="absolute right-3 top-3 z-10">
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
        <p className="text-[#f6efe3]">Keine Spots gefunden für diese Stadt.</p>
      ) : (
        <div className="grid gap-3">
          {filteredSpots.map((s) => {
            const wolt = s.wolt_url ?? s.wolt_link ?? null;
            const lieferando = s.lieferando_url ?? s.lieferando_link ?? null;

            return (
  <div
    key={s.id}
    onClick={() => router.push(`/spot/${s.id}`)}
    className="relative min-w-0 cursor-pointer rounded-2xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-4 shadow-sm transition-all duration-300 hover:shadow-lg"
  >
    <div className="absolute right-3 top-3 z-10">
      <SaveSpotButton spotId={s.id} variant="list" />
    </div>

    {/* Oberer Infobereich */}
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
        <h2 className="break-words text-base font-extrabold text-[#1f1f1f] sm:truncate">{s.name}</h2>

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

        {s.address ? <p className="mt-1 break-words text-sm text-[#6b6256]">{s.address}</p> : null}

              </div>
    </div>

    <div className="mt-4 min-w-0 flex flex-wrap gap-2">
      {s.google_maps_link ? (
        <a
          href={s.google_maps_link}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="max-w-full break-words rounded-xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-2.5 text-[15px] font-semibold text-[#1f1f1f] shadow-sm transition hover:bg-[#f6efe3]"
        >
          Google Maps
        </a>
      ) : null}

      {wolt ? (
        <a
          href={wolt}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="max-w-full break-words rounded-xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-2.5 text-[15px] font-semibold text-[#1f1f1f] shadow-sm transition hover:bg-[#f6efe3]"
        >
          Wolt
        </a>
      ) : null}

      {lieferando ? (
        <a
          href={lieferando}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="max-w-full break-words rounded-xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-2.5 text-[15px] font-semibold text-[#1f1f1f] shadow-sm transition hover:bg-[#f6efe3]"
        >
          Lieferando
        </a>
      ) : null}

    
    </div>

    {/* TikTok als eigener Bereich unterhalb */}
    {s.tiktok_embed_id ? (
      <div
        className="mt-6"
        onClick={(e) => e.stopPropagation()}
      >
      
        <div className="mx-auto min-w-0 w-full max-w-[420px]">
  <TikTokEmbed
    username="juniorstaste"
    videoId={s.tiktok_embed_id}
    height={760}
  />
</div>
      </div>
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
