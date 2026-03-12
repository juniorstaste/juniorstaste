"use client";
export const dynamic = "force-dynamic";
export const runtime = "edge";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import dynamicImport from "next/dynamic";

import TikTokEmbed from "@/components/TikTokEmbed";
import DistanceLabel from "@/components/DistanceLabel";
import SiteHeader from "@/components/SiteHeader";
import BottomTabs from "@/components/BottomTabs";
import ProfileButton from "@/components/ProfileButton";
import SaveSpotButton from "@/components/SaveSpotButton";

const CityMap = dynamicImport(() => import("@/components/CityMap"), { ssr: false });

type Spot = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  tiktok_embed_id: string | null;
  google_maps_link: string | null;

  rating: number | null;
  price_level: number | null;

  category_slug?: string | null;
  category_name?: string | null;
  city_name?: string | null;

  wolt_url?: string | null;
  lieferando_url?: string | null;
  wolt_link?: string | null;
  lieferando_link?: string | null;

  created_at?: string | null;
};

const TASTE_DES_MONATS_IDS = [
  "0f63bbc8-7050-4406-b512-3e133965a1e4",
  "4eb57f03-101e-4d80-98cc-42d3f148b57a",
];

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

export default function NearPage() {
  const router = useRouter();
  const params = useSearchParams();

  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const initialRadius = Number(params.get("r")) || 5;

  const [radius, setRadius] = useState<number>(initialRadius);

  const [spots, setSpots] = useState<Spot[]>([]);
  const [tasteDesMonatsSpots, setTasteDesMonatsSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);
  const [sort, setSort] = useState<"distance" | "rating" | "price" | "newest">("distance");

  const [view, setView] = useState<"list" | "map" | "tasteDesMonats">("list");
  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);

  const topText = "text-white";
  const controlBase =
    "w-full px-4 py-3 rounded-2xl border border-[#e7dfcf] bg-[#f6efe3] " +
    "text-[#0f2a22] placeholder:text-[#0f2a22]/50 font-semibold shadow-sm transition hover:bg-[#efe5d6] " +
    "focus:outline-none focus:ring-2 focus:ring-[#c6a85b]";

  useEffect(() => {
    if (!hasValidCoords) return;

    async function loadSpots() {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase.from("spots_with_city").select("*");

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
  }, [hasValidCoords]);

  useEffect(() => {
    if (!hasValidCoords) return;

    async function loadCategories() {
      const { data, error } = await supabase
        .from("spots_with_city")
        .select("category_slug, category_name");

      if (error) return;

      const m = new Map<string, string>();
      (data ?? []).forEach((row: any) => {
        if (row.category_slug) m.set(row.category_slug, row.category_name ?? row.category_slug);
      });

      const list = Array.from(m.entries()).map(([slug, name]) => ({ slug, name }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(list);
    }

    loadCategories();
  }, [hasValidCoords]);

  useEffect(() => {
    async function loadTasteDesMonats() {
      const { data, error } = await supabase
        .from("spots_with_city")
        .select("*")
        .in("id", TASTE_DES_MONATS_IDS);

      if (error) return;

      const ordered =
        (data as Spot[] | null)?.sort(
          (a, b) => TASTE_DES_MONATS_IDS.indexOf(a.id) - TASTE_DES_MONATS_IDS.indexOf(b.id)
        ) ?? [];

      setTasteDesMonatsSpots(ordered);
    }

    loadTasteDesMonats();
  }, []);

  const filteredSpots = useMemo(() => {
    if (!hasValidCoords) return [];

    const q = search.trim().toLowerCase();

    let list = spots.filter((s) => {
      if (typeof s.lat !== "number" || typeof s.lng !== "number") return false;

      const inRadius = haversineKm({ lat, lng }, { lat: s.lat, lng: s.lng }) <= radius;

      const textMatch = !q
        ? true
        : [s.name, s.description ?? "", s.address ?? ""].join(" ").toLowerCase().includes(q);

      const categoryMatch = category === "all" ? true : (s.category_slug ?? "other") === category;

      return inRadius && textMatch && categoryMatch;
    });

    if (sort === "distance") {
      list.sort((a, b) => {
        if (typeof a.lat !== "number" || typeof a.lng !== "number") return 1;
        if (typeof b.lat !== "number" || typeof b.lng !== "number") return -1;
        const da = haversineKm({ lat, lng }, { lat: a.lat, lng: a.lng });
        const db = haversineKm({ lat, lng }, { lat: b.lat, lng: b.lng });
        return da - db;
      });
    } else if (sort === "rating") {
      list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    } else if (sort === "price") {
      list.sort((a, b) => (a.price_level ?? 999) - (b.price_level ?? 999));
    } else if (sort === "newest") {
      list.sort((a, b) => {
        const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bd - ad;
      });
    }

    return list;
  }, [spots, search, category, sort, radius, lat, lng, hasValidCoords]);

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

  if (!hasValidCoords) {
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

          <ProfileButton />
        </div>

        <div className="text-center mb-6">
          <SiteHeader />
          <h1 className="mt-4 text-3xl md:text-4xl font-extrabold italic text-white tracking-wide">
            Spots in deiner Nähe
          </h1>
        </div>

        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900 mt-4">
          Fehler: Standort-Koordinaten fehlen. Bitte gehe zurück und klicke „Standort verwenden“ erneut.
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[560px] p-4 pb-28">
      <div className="mb-3 flex items-center justify-between">
        <a href="/" className={`font-semibold ${topText} underline-offset-4 hover:underline`}>
          ← Zurück
        </a>

        <ProfileButton />
      </div>

      <div className="text-center mb-6">
        <SiteHeader />
        <h1 className="mt-4 text-3xl md:text-4xl font-extrabold italic text-white tracking-wide">
          Spots in deiner Nähe
        </h1>
      </div>

      {view !== "tasteDesMonats" && (
        <>
          <div className="mb-5">
  <div className="overflow-x-auto no-scrollbar">
    <div className="flex gap-3 min-w-max">

      {/* Radius */}
      <div className="shrink-0">
        <select
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className={controlBase}
        >
          <option value={2}>Radius: 2 km</option>
          <option value={5}>Radius: 5 km</option>
          <option value={10}>Radius: 10 km</option>
          <option value={25}>Radius: 25 km</option>
        </select>
      </div>

      {/* Kategorie */}
      <div className="shrink-0">
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
      <div className="shrink-0">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className={controlBase}
        >
          <option value="distance">Sortierung: Nähe</option>
          <option value="rating">Best bewertet</option>
          <option value="price">Preis</option>
          <option value="newest">Neueste</option>
        </select>
      </div>

    </div>
  </div>
</div>

{/* Suche */}
<div className="mb-4">
  <label className={`block mb-2 font-extrabold ${topText}`}>Suche</label>
  <input
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    placeholder="z.B. Burger, Döner, Pizza…"
    className={controlBase}
  />
</div>
        </>
      )}

      {loading ? (
        <p className="text-[#f6efe3]">Lade Spots…</p>
      ) : errorMsg ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900">
          <b>Supabase-Fehler:</b> {errorMsg}
        </div>
      ) : view === "map" ? (
        <div className="mt-2">
          <CityMap
            center={[lat, lng]}
            spots={mapSpots}
            userPos={{ lat, lng }}
            activeSpotId={activeSpotId}
            onActiveChange={(id: string) => setActiveSpotId(id)}
            onSpotClick={(id: string) => router.push(`/spot/${id}`)}
          />
          <p className="mt-3 text-sm text-[#f6efe3]/80">Tipp: Marker anklicken, um den Namen zu sehen.</p>
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
                className="relative cursor-pointer rounded-2xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-3 shadow-sm transition-all duration-300 hover:shadow-lg"
              >
                <div className="absolute right-3 top-3 z-10">
                  <SaveSpotButton spotId={s.id} variant="list" />
                </div>

                <div className="flex gap-3">
                  {s.image_url ? (
                    <img
                      src={s.image_url}
                      alt={s.name}
                      className="h-16 w-16 rounded-xl object-cover ring-1 ring-black/5"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-[#f3ecdf] ring-1 ring-black/5" />
                  )}

                  <div className="min-w-0 flex-1 pr-8">
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

                    {s.address ? <p className="mt-1 truncate text-xs text-[#6b6256]">{s.address}</p> : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : filteredSpots.length === 0 ? (
        <p className="text-[#f6efe3]">Keine Spots im Radius gefunden.</p>
      ) : (
        <div className="grid gap-3">
          {filteredSpots.map((s) => {
            const wolt = s.wolt_url ?? s.wolt_link ?? null;
            const lieferando = s.lieferando_url ?? s.lieferando_link ?? null;

            return (
              <div
                key={s.id}
                onClick={() => router.push(`/spot/${s.id}`)}
                className="relative cursor-pointer rounded-2xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-4 shadow-sm transition-all duration-300 hover:shadow-lg"
              >
                <div className="absolute right-3 top-3 z-10">
                  <SaveSpotButton spotId={s.id} variant="list" />
                </div>

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

                    <div className="mt-1 text-sm text-[#5a5348]">
                      <DistanceLabel
                        km={haversineKm({ lat, lng }, { lat: s.lat as number, lng: s.lng as number })}
                      />
                    </div>

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
                    </div>

                    {s.tiktok_embed_id ? (
                      <div className="mt-8 flex justify-center" onClick={(e) => e.stopPropagation()}>
                        <div className="w-full rounded-2xl overflow-hidden shadow-lg">
                          <TikTokEmbed
                            username="juniorstaste"
                            videoId={s.tiktok_embed_id}
                            height={760}
                          />
                        </div>
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