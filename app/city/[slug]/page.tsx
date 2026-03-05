"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import TikTokEmbed from "@/components/TikTokEmbed";
import DistanceLabel from "@/components/DistanceLabel";
import SiteHeader from "@/components/SiteHeader";
import BottomTabs from "@/components/BottomTabs";
import JuniorstasteGrid from "@/components/JuniorstasteGrid";

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

export default function CityPage() {
  const router = useRouter();
  const params = useParams();

  const citySlug = useMemo(() => {
    const raw = (params as any)?.slug;
    if (!raw) return null;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ✅ Cities für Dropdown
  const [cities, setCities] = useState<City[]>([]);
  const [citySelectValue, setCitySelectValue] = useState<string>("");

  const [category, setCategory] = useState<string>("all");
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"list" | "map" | "juniorstaste">("list");
  const [sort, setSort] = useState<"newest" | "rating" | "price" | "distance">("newest");

  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [radiusEnabled, setRadiusEnabled] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);

  // =========================
  // ✅ UI TOKENS (dein Style)
  // =========================
  const topText = "text-white";

  const controlBase =
    "w-full px-4 py-3 rounded-2xl border border-[#e7dfcf] bg-[#f6efe3] " +
    "text-[#0f2a22] placeholder:text-[#0f2a22]/50 font-semibold shadow-sm transition hover:bg-[#efe5d6] " +
    "focus:outline-none focus:ring-2 focus:ring-[#c6a85b]";

  const buttonBase =
    "px-4 py-3 rounded-2xl border border-[#e7dfcf] bg-[#f6efe3] " +
    "text-[#0f2a22] font-semibold shadow-sm transition hover:bg-[#efe5d6]";

  // =========================
  // ✅ 0) Dropdown: immer aktuelle City als value
  // =========================
  useEffect(() => {
    if (citySlug) setCitySelectValue(citySlug);
  }, [citySlug]);

  // ✅ Cities laden (für Dropdown)
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

    // 1) Near ausgewählt -> Standort abfragen -> Near Page
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

    // 2) City ausgewählt -> City Page
    if (next) router.push(`/city/${next}`);
  }

  // =========================
  // ✅ 1) Spots laden
  // =========================
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

  // =========================
  // ✅ 2) Kategorien laden
  // =========================
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

  // =========================
  // ✅ 3) Search + Radius + Sort
  // =========================
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
        const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bd - ad;
      });
    }

    return list;
  }, [spots, search, sort, userPos, radiusKm, radiusEnabled]);

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

  // =========================
  // ✅ Map-Spots vorbereiten
  // =========================
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

  if (!citySlug) return <main className="p-4">Lade Stadt…</main>;

  return (
    <main className="mx-auto max-w-[560px] p-4 pb-28">
      <a href="/" className={`inline-block mb-3 font-semibold ${topText} underline-offset-4 hover:underline`}>
        ← Zurück
      </a>

      {/* Logo */}
      <div className="text-center mb-6">
        <SiteHeader subtitle={null as any} />

        {/* ✅ Dropdown direkt unter dem Logo (Design wie vorher) */}
        <div className="mb-5">
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

          {geoError ? <div className="mt-2 text-sm text-red-200">{geoError}</div> : null}
        </div>
      </div>

      {/* ✅ View Toggle */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setView("list")}
          className={`flex-1 px-4 py-2.5 rounded-xl border transition-all font-semibold
          ${
            view === "list"
              ? "bg-white border-[#e7dfcf] text-[#0f3b2e] shadow-sm"
              : "bg-[#f6efe3] border-[#e7dfcf] text-[#0f3b2e] hover:bg-[#efe4d1]"
          }`}
        >
          Liste
        </button>

        <button
          onClick={() => setView("map")}
          className={`flex-1 px-4 py-2.5 rounded-xl border transition-all font-semibold
          ${
            view === "map"
              ? "bg-white border-[#e7dfcf] text-[#0f3b2e] shadow-sm"
              : "bg-[#f6efe3] border-[#e7dfcf] text-[#0f3b2e] hover:bg-[#efe4d1]"
          }`}
        >
          Karte
        </button>
      </div>

      {/* ✅ Standort (dein bestehender Bereich bleibt unverändert) */}
      <div className="flex gap-3 mb-4">
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
          className={`${buttonBase} flex-1`}
        >
          📍 In meiner Nähe
        </button>

        <button
          onClick={() => {
            setUserPos(null);
            setRadiusEnabled(false);
          }}
          className={buttonBase}
          title="Standort zurücksetzen"
        >
          ✕
        </button>
      </div>

      {geoError ? <div className="mb-3 text-sm text-red-200">{geoError}</div> : null}

      {/* ✅ Umkreis */}
      {userPos ? (
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
              <option value={25}>25 km</option>
            </select>

            <div className="mt-2 text-xs opacity-80">
              {radiusEnabled ? `Zeige Spots im Umkreis von ${radiusKm} km.` : "Aktiviere den Umkreis, um Spots zu filtern."}
            </div>
          </div>
        </div>
      ) : null}

      {/* ✅ Suche */}
      <div className="mb-4">
        <label className={`block mb-2 font-extrabold ${topText}`}>Suche</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="z.B. Burger, Döner, Pizza…"
          className={controlBase}
        />
      </div>

      {/* ✅ Kategorie */}
      <div className="mb-4">
        <label className={`block mb-2 font-extrabold ${topText}`}>Kategorie</label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setSearch("");
          }}
          className={controlBase}
        >
          <option value="all">Alle</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* ✅ Sortierung */}
{view === "list" && (
  <div className="mb-5">
    <label className={`block mb-2 font-extrabold ${topText}`}>Sortierung</label>

    <select
      value={sort}
      onChange={(e) => setSort(e.target.value as any)}
      className={controlBase}
    >
      <option value="newest">Neueste</option>
      <option value="rating">Best bewertet</option>
      <option value="price">Preis</option>
      <option value="distance" disabled={!userPos}>
        Nähe (GPS)
      </option>
    </select>
  </div>
)}

      {/* ✅ Content */}
      {loading ? (
        <p className="text-[#f6efe3]">Lade Spots…</p>
      ) : errorMsg ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900">
          <b>Supabase-Fehler:</b> {errorMsg}
        </div>
      ) : filteredSpots.length === 0 ? (
        <p className="text-[#f6efe3]">Keine Spots gefunden für diese Stadt.</p>
      ) : view === "map" ? (
        <div className="mt-2">
          <CityMap
            center={mapCenter}
            spots={mapSpots}
            userPos={userPos}
            activeSpotId={activeSpotId}
            onActiveChange={(id: string) => setActiveSpotId(id)}
            onSpotClick={(id: string) => router.push(`/spot/${id}`)}
          />
          <p className="mt-3 text-sm text-[#f6efe3]/80">Tipp: Marker anklicken, um den Namen zu sehen.</p>
        </div>
      ) : view === "juniorstaste" ? (
        <JuniorstasteGrid citySlug={citySlug} username="juniorstaste" />
      ) : (
        <div className="grid gap-3">
          {filteredSpots.map((s) => {
            const wolt = s.wolt_url ?? s.wolt_link ?? null;
            const lieferando = s.lieferando_url ?? s.lieferando_link ?? null;

            return (
              <div
                key={s.id}
                onClick={() => router.push(`/spot/${s.id}`)}
                className="cursor-pointer rounded-2xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-4 shadow-sm transition-all duration-300 hover:shadow-lg"
              >
                <div className="flex gap-3">
                  {s.image_url ? (
                    <img
                      src={s.image_url}
                      alt={s.name}
                      className="h-20 w-20 rounded-xl object-cover ring-1 ring-black/5"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-xl bg-[#f3ecdf] ring-1 ring-black/5" />
                  )}

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-extrabold text-[#1f1f1f]">{s.name}</h2>

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

                    {s.address ? <p className="mt-1 truncate text-sm text-[#6b6256]">{s.address}</p> : null}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {s.google_maps_link ? (
                        <a
                          href={s.google_maps_link}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-2.5 text-[15px] font-semibold text-[#1f1f1f] shadow-sm transition hover:bg-[#f6efe3]"
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
                          className="rounded-xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-2.5 text-[15px] font-semibold text-[#1f1f1f] shadow-sm transition hover:bg-[#f6efe3]"
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
                          className="rounded-xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-2.5 text-[15px] font-semibold text-[#1f1f1f] shadow-sm transition hover:bg-[#f6efe3]"
                        >
                          Lieferando
                        </a>
                      ) : null}

                      {s.tiktok_embed_id ? (
                        <a
                          href={`https://www.tiktok.com/@juniorstaste/video/${s.tiktok_embed_id}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-2.5 text-[15px] font-semibold text-[#1f1f1f] shadow-sm transition hover:bg-[#f6efe3]"
                        >
                          TikTok Video
                        </a>
                      ) : null}
                    </div>

                    {s.tiktok_embed_id ? (
                      <div className="mt-4 rounded-2xl overflow-hidden shadow-lg" onClick={(e) => e.stopPropagation()}>
                        <TikTokEmbed username="juniorstaste" videoId={s.tiktok_embed_id} />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BottomTabs view={view} onChange={setView} />
    </main>
  );
}