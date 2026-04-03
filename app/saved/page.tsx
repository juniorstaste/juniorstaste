"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import SiteHeader from "@/components/SiteHeader";
import TopRightMenu from "@/components/TopRightMenu";
import SaveSpotButton from "@/components/SaveSpotButton";
import ShareSpotButton from "@/components/ShareSpotButton";
import { useRouter } from "next/navigation";
import { trackAndOpenExternalLink } from "@/lib/externalClickTracking";
import { logSupabaseError } from "@/lib/logSupabaseError";
import { prioritizeSpots } from "@/lib/prioritySpot";

type Spot = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  image_url: string | null;
  city_id?: string | null;
  city_name?: string | null;
  city_slug?: string | null;
  tiktok_embed_id?: string | null;
  google_maps_link?: string | null;
  wolt_url?: string | null;
  lieferando_url?: string | null;
  uber_eats_url?: string | null;
  city?: {
    name?: string | null;
    slug?: string | null;
  } | null;
};

export default function SavedPage() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const router = useRouter();
  const { authLoading, user, savedSpotIds, openAuthPrompt } = useAuth();

  useEffect(() => {
    async function loadSavedSpots() {
      if (!user) {
        setSpots([]);
        setLoading(false);
        return;
      }

      const { data: savedRows, error: savedError } = await supabase
        .from("saved_spots")
        .select("spot_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (savedError) {
        logSupabaseError("Konnte saved_spots nicht laden:", savedError);
        setSpots([]);
        setLoading(false);
        return;
      }

      const savedIds = (savedRows ?? []).map((row: { spot_id: string }) => row.spot_id);

      if (savedIds.length === 0) {
        setSpots([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("spots")
        .select(
          "id, name, description, address, image_url, city_id, tiktok_embed_id, google_maps_link, wolt_url, lieferando_url, uber_eats_url"
        )
        .in("id", savedIds);

      if (error) {
        logSupabaseError("Konnte Spot-Daten fuer gespeicherte Spots nicht laden:", error);
        setSpots([]);
        setLoading(false);
        return;
      }

      const cityIds = Array.from(
        new Set(
          ((data ?? []) as Spot[])
            .map((spot) => spot.city_id)
            .filter((cityId): cityId is string => typeof cityId === "string" && cityId.length > 0)
        )
      );

      let cityMap = new Map<string, { name: string | null; slug: string | null }>();

      if (cityIds.length > 0) {
        const { data: cityRows, error: cityError } = await supabase
          .from("cities")
          .select("id, name, slug")
          .in("id", cityIds);

        if (cityError) {
          logSupabaseError("Konnte Stadt-Daten fuer gespeicherte Spots nicht laden:", cityError);
        } else {
          cityMap = new Map(
            (cityRows ?? []).map((city: { id: string; name: string | null; slug: string | null }) => [
              city.id,
              { name: city.name, slug: city.slug },
            ])
          );
        }
      }

      const normalizedData = ((data ?? []) as Spot[]).map((spot) => ({
        ...spot,
        city_name: spot.city_id ? (cityMap.get(spot.city_id)?.name ?? null) : null,
        city_slug: spot.city_id ? (cityMap.get(spot.city_id)?.slug ?? null) : null,
      }));

      const ordered =
        savedIds
          .map((id) => normalizedData.find((spot) => spot.id === id))
          .filter(Boolean) ?? [];

      setSpots(ordered as Spot[]);
      setLoading(false);
    }

    loadSavedSpots();
  }, [savedSpotIds, user]);

const savedCities = Array.from(
  new Set(
    spots
      .map((spot) => spot.city_name)
      .filter((city): city is string => Boolean(city))
  )
).sort((a, b) => a.localeCompare(b));

const filteredSpots = prioritizeSpots(
  selectedCity === "all"
    ? spots
    : spots.filter((spot) => spot.city_name === selectedCity)
);
  return (
    <main className="min-h-screen bg-[#0f3b2e]">
      <div className="mx-auto max-w-[560px] p-4 pb-28">
        {/* Top row */}
<div className="mb-3 flex items-center justify-between">
  <button
  onClick={() => router.push("/")}
className="flex items-center justify-center w-10 h-10 -ml-2 text-[28px] leading-none text-white font-semibold active:scale-90 transition"
  aria-label="Zurück"
>
  ‹
</button>

  <TopRightMenu />
</div>

        {/* Header */}
        <div className="text-center mb-6">
  <SiteHeader subtitle={null} compact />
  <h1 className="mt-4 text-3xl md:text-4xl font-extrabold italic text-white tracking-wide">
    Gespeicherte Spots
  </h1>

  {spots.length > 0 ? (
    <div className="mt-4">
      <select
        value={selectedCity}
        onChange={(e) => setSelectedCity(e.target.value)}
        className="w-full rounded-2xl border border-[#e7dfcf] bg-[#f6efe3] px-4 py-3 text-center font-semibold text-[#0f2a22] shadow-sm transition hover:bg-[#efe5d6] focus:outline-none focus:ring-2 focus:ring-[#c6a85b]"
      >
        <option value="all">Alle Städte</option>
        {savedCities.map((city) => (
          <option key={city} value={city}>
            {city}
          </option>
        ))}
      </select>
    </div>
  ) : null}
</div>

        {authLoading ? (
          <p className="text-white/80">Prüfe Login…</p>
        ) : !user ? (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
    <div className="font-semibold mb-2">Bitte melde dich an</div>
    <p className="text-white/80 text-sm">
      Melde dich an oder erstelle ein Konto, um deine gespeicherten Spots zu sehen.
    </p>

    <button
      type="button"
      onClick={() => openAuthPrompt({ type: "open-saved" })}
      className="mt-4 rounded-2xl bg-[#e8decc] px-4 py-3 font-semibold text-[#0f3b2e]"
    >
      Einloggen / Konto erstellen
    </button>
  </div>
 ) : loading ? (
          <p className="text-white/80">Lade gespeicherte Spots…</p>
        ) : spots.length === 0 ? (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
    <div className="font-semibold mb-2">Noch nichts gespeichert</div>
    <p className="text-white/80 text-sm">
      Speichere Spots über das Bookmark auf der Detailseite oder in der Listenansicht, dann erscheinen sie hier.
    </p>
  </div>
) : filteredSpots.length === 0 ? (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
    <div className="font-semibold mb-2">Keine Spots in dieser Stadt</div>
    <p className="text-white/80 text-sm">
      Für die ausgewählte Stadt gibt es aktuell keine gespeicherten Spots.
    </p>
  </div>
) : (
          <div className="grid gap-4">
            {filteredSpots.map((spot) => {
              const wolt = spot.wolt_url ?? null;
              const lieferando = spot.lieferando_url ?? null;
              const uberEats = spot.uber_eats_url ?? null;

              return (
                <div
                  key={spot.id}
                  onClick={() => router.push(`/spot/${spot.id}`)}
                  className="relative cursor-pointer rounded-2xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-3 shadow-sm transition-all duration-300 hover:shadow-lg"
                >
                  {/* Bookmark oben rechts */}
                  <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                    <ShareSpotButton spotId={spot.id} spotName={spot.name} variant="list" />
                    <SaveSpotButton spotId={spot.id} variant="list" />
                  </div>

                  <div className="min-w-0 flex gap-3">
                    {spot.image_url ? (
                      <img
                        src={spot.image_url}
                        alt={spot.name}
                        className="h-16 w-16 rounded-xl object-cover ring-1 ring-black/5"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-xl bg-[#f3ecdf] ring-1 ring-black/5" />
                    )}

                    <div className="min-w-0 flex-1 pr-14">
                      <h2 className="truncate text-sm font-extrabold text-[#1f1f1f]">
                        {spot.name}
                      </h2>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5a5348]">
                        {spot.city_name ? <span className="font-medium">{spot.city_name}</span> : null}
                      </div>

                      {spot.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-[#2f2a23]">
                          {spot.description}
                        </p>
                      ) : null}

                      {spot.address ? (
                        <p className="mt-1 break-words text-xs text-[#6b6256]">
                          {spot.address}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {spot.google_maps_link ? (
                      <a
                        href={spot.google_maps_link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) =>
                          void trackAndOpenExternalLink({
                            event: e,
                            url: spot.google_maps_link!,
                            spotId: spot.id,
                            buttonType: "maps",
                          })
                        }
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
                        onClick={(e) =>
                          void trackAndOpenExternalLink({
                            event: e,
                            url: wolt,
                            spotId: spot.id,
                            buttonType: "wolt",
                          })
                        }
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
                        onClick={(e) =>
                          void trackAndOpenExternalLink({
                            event: e,
                            url: lieferando,
                            spotId: spot.id,
                            buttonType: "lieferando",
                          })
                        }
                        className="rounded-xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-2.5 text-[15px] font-semibold text-[#1f1f1f] shadow-sm transition hover:bg-[#f6efe3]"
                      >
                        Lieferando
                      </a>
                    ) : null}

                    {uberEats ? (
                      <a
                        href={uberEats}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) =>
                          void trackAndOpenExternalLink({
                            event: e,
                            url: uberEats,
                            spotId: spot.id,
                            buttonType: "ubereats",
                          })
                        }
                        className="rounded-xl border border-[#e7dfcf] bg-[#fffaf2] px-4 py-2.5 text-[15px] font-semibold text-[#1f1f1f] shadow-sm transition hover:bg-[#f6efe3]"
                      >
                        Uber Eats
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
