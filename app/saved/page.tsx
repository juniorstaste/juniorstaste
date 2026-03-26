"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import SiteHeader from "@/components/SiteHeader";
import TopRightMenu from "@/components/TopRightMenu";
import SaveSpotButton from "@/components/SaveSpotButton";
import ShareSpotButton from "@/components/ShareSpotButton";
import TikTokEmbed from "@/components/TikTokEmbed";
import { useRouter } from "next/navigation";
import { trackAndOpenExternalLink } from "@/lib/externalClickTracking";

type Spot = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  image_url: string | null;
  city_name?: string | null;
  city_slug?: string | null;
  tiktok_embed_id?: string | null;
  google_maps_link?: string | null;
  wolt_url?: string | null;
  lieferando_url?: string | null;
  wolt_link?: string | null;
  lieferando_link?: string | null;
  uber_eats_url?: string | null;
  uber_eats_link?: string | null;
  ubereats_url?: string | null;
  ubereats_link?: string | null;
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

      if (savedSpotIds.length === 0) {
        setSpots([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("spots_with_city")
        .select(
          "id, name, description, address, image_url, city_name, city_slug, tiktok_embed_id, google_maps_link, wolt_url, lieferando_url, wolt_link, lieferando_link, uber_eats_url, uber_eats_link, ubereats_url, ubereats_link"
        )
        .in("id", savedSpotIds);

      if (error) {
        setSpots([]);
        setLoading(false);
        return;
      }

      // Reihenfolge wie gespeichert beibehalten
      const ordered =
        savedSpotIds
          .map((id) => (data ?? []).find((spot) => spot.id === id))
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

const filteredSpots =
  selectedCity === "all"
    ? spots
    : spots.filter((spot) => spot.city_name === selectedCity);
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
              const wolt = spot.wolt_url ?? spot.wolt_link ?? null;
              const lieferando = spot.lieferando_url ?? spot.lieferando_link ?? null;
              const uberEats =
                spot.uber_eats_url ?? spot.uber_eats_link ?? spot.ubereats_url ?? spot.ubereats_link ?? null;

              return (
                <div
                  key={spot.id}
                  className="relative rounded-2xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-4 shadow-sm"
                >
                  {/* Bookmark oben rechts */}
                  <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                    <ShareSpotButton spotId={spot.id} spotName={spot.name} variant="list" />
                    <SaveSpotButton spotId={spot.id} variant="list" />
                  </div>

                  <a href={`/spot/${spot.id}`} className="block">
                    <div className="flex gap-3">
                      {spot.image_url ? (
                        <img
                          src={spot.image_url}
                          alt={spot.name}
                          className="h-20 w-20 rounded-xl object-cover ring-1 ring-black/5"
                        />
                      ) : (
                        <div className="h-20 w-20 rounded-xl bg-[#f3ecdf] ring-1 ring-black/5" />
                      )}

                      <div className="min-w-0 flex-1 pr-8">
                        <h2 className="truncate text-base font-extrabold text-[#1f1f1f]">
                          {spot.name}
                        </h2>

                        {spot.city_name ? (
                          <div className="mt-1 text-sm text-[#5a5348] font-medium">
                            {spot.city_name}
                          </div>
                        ) : null}

                        {spot.description ? (
                          <p className="mt-2 line-clamp-2 text-sm text-[#2f2a23]">
                            {spot.description}
                          </p>
                        ) : null}

                        {spot.address ? (
                          <p className="mt-1 truncate text-sm text-[#6b6256]">
                            {spot.address}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </a>

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

                  {/* TikTok Video */}
                  {spot.tiktok_embed_id ? (
  <div className="mt-4 flex justify-center">
    <div className="rounded-2xl overflow-hidden shadow-lg">
      <TikTokEmbed
        username="juniorstaste"
        videoId={spot.tiktok_embed_id}
      />
    </div>
  </div>
) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
