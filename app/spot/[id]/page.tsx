"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import StarRating from "@/components/StarRating";
import DistanceLabel from "@/components/DistanceLabel";
import TikTokEmbed from "@/components/TikTokEmbed";
import TopRightMenu from "@/components/TopRightMenu";
import SaveSpotButton from "@/components/SaveSpotButton";
import ShareSpotButton from "@/components/ShareSpotButton";
import DeliveryButtons from "@/components/DeliveryButtons";
import { trackAndOpenExternalLink } from "@/lib/externalClickTracking";
import { getPriceLevelValue } from "@/lib/priceLevel";
import { prioritizeSpots } from "@/lib/prioritySpot";

const SpotMiniMap = dynamic(() => import("@/components/SpotMiniMap"), { ssr: false });

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
  city_name: string | null;
  city_slug: string | null;
  category_name?: string | null;
  category_slug?: string | null;
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
    Math.sin(dLng / 2) * Math.sin(dLng / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

export default function SpotDetailPage() {
  const params = useParams();
  const router = useRouter();

  const spotId = useMemo(() => {
    const raw = (params as { id?: string | string[] } | null)?.id;
    if (!raw) return null;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [spot, setSpot] = useState<Spot | null>(null);
  const [recommendations, setRecommendations] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  // Spot laden
  useEffect(() => {
    if (!spotId) return;

    async function load() {
      const { data, error } = await supabase
        .from("spots_with_city")
        .select("*")
        .eq("id", spotId)
        .maybeSingle();

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setSpot(data as Spot);
      setLoading(false);
    }

    load();
  }, [spotId]);

  useEffect(() => {
    const currentSpot = spot;

    if (!currentSpot?.id) {
      setRecommendations([]);
      return;
    }

    async function loadRecommendations(spotData: Spot) {
      const recommendationFields =
        "id, name, image_url, city_name, city_slug, category_name, category_slug, rating, price_level";

      const seenIds = new Set<string>([spotData.id]);
      let categoryRecommendations: Spot[] = [];
      let cityFallbackRecommendations: Spot[] = [];

      if (spotData.category_slug) {
        const { data, error } = await supabase
          .from("spots_with_city")
          .select(recommendationFields)
          .eq("category_slug", spotData.category_slug)
          .neq("id", spotData.id)
          .limit(12);

        if (!error) {
          categoryRecommendations = prioritizeSpots((data as Spot[]) ?? []).filter((item) => {
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return true;
          });
        }
      }

      if (categoryRecommendations.length < 6 && spotData.city_slug) {
        const { data, error } = await supabase
          .from("spots_with_city")
          .select(recommendationFields)
          .eq("city_slug", spotData.city_slug)
          .neq("id", spotData.id)
          .limit(18);

        if (!error) {
          cityFallbackRecommendations = prioritizeSpots((data as Spot[]) ?? []).filter((item) => {
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return true;
          });
        }
      }

      setRecommendations([...categoryRecommendations, ...cityFallbackRecommendations].slice(0, 6));
    }

    void loadRecommendations(currentSpot);
  }, [spot]);

  // ✅ Standort AUTOMATISCH abfragen
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        // Falls User ablehnt → einfach keine Entfernung anzeigen
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  if (!spotId) return null;

  const wolt = spot?.wolt_url ?? null;
  const lieferando = spot?.lieferando_url ?? null;
  const uberEats = spot?.uber_eats_url ?? null;

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-[#0f3b2e] px-6 py-8 pb-[calc(7rem+env(safe-area-inset-bottom))] text-white">

      <div className="flex items-center justify-between mb-6">

<button
  onClick={() => {
    if (spot?.city_slug) {
      router.push(`/city/${spot.city_slug}`);
      return;
    }

    router.push("/");
  }}
className="flex items-center justify-start active:scale-[1.03] transition"
  aria-label="Zur Startseite"
>
  <img
    src="/logos/citypage-logo.png"
    alt="Junior's Taste"
    className="h-auto w-[148px]"
  />
</button>

  <div className="flex items-center gap-2">
    {spot?.id && <ShareSpotButton spotId={spot.id} spotName={spot.name} />}
    {spot?.id && <SaveSpotButton spotId={spot.id} />}
    <TopRightMenu />
  </div>

</div>

      {loading ? (
        <p>Lade Spot…</p>
      ) : errorMsg ? (
        <div className="text-red-400">{errorMsg}</div>
      ) : !spot ? null : (
        <>
          {/* Mini Map */}
          {spot.lat && spot.lng ? (
            <div className="mb-3 rounded-2xl overflow-hidden">
              <SpotMiniMap
                lat={spot.lat}
                lng={spot.lng}
                name={spot.name}
                googleMapsLink={spot.google_maps_link}
                spotId={spot.id}
                userPos={userPos}
              />
            </div>
          ) : null}

          {/* ✅ Entfernung DIREKT unter Karte */}
          {userPos && spot.lat && spot.lng && (
            <div className="mb-4 flex justify-end">
              <DistanceLabel
                km={haversineKm(userPos, { lat: spot.lat, lng: spot.lng })}
                className="text-right text-white/65"
              />
            </div>
          )}

          {/* Titelzeile mit Spot-Bild */}
          <div className="mb-3 flex items-center gap-4">
            {spot.image_url ? (
              <img
                src={spot.image_url}
                alt={spot.name}
                className="h-32 w-32 shrink-0 rounded-2xl object-cover ring-1 ring-black/5"
              />
            ) : null}

            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-extrabold">{spot.name}</h1>
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-4 items-center mb-4">
            {spot.city_name && <span>{spot.city_name}</span>}
            {spot.rating != null && <StarRating value={spot.rating} />}
            {(() => {
              const activePriceLevel = getPriceLevelValue(spot.price_level, 4);

              if (activePriceLevel <= 0) return null;

              return (
                <div
                  className="flex items-center gap-0.5 text-base font-semibold"
                  aria-label={`Preisniveau ${activePriceLevel} von 4`}
                >
                  {Array.from({ length: 4 }, (_, index) => (
                    <span
                      key={index}
                      className={index < activePriceLevel ? "text-white" : "text-white/30"}
                    >
                      €
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Adresse / Maps */}
          {spot.address || spot.google_maps_link ? (
            <div className="mb-6 flex items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-white/5 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Adresse
                </div>
                {spot.address ? (
                  <p className="break-words text-sm font-semibold text-white">
                    {spot.address}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-white/70">Adresse nicht verfügbar</p>
                )}
              </div>

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
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e8decc] text-[#0f3b2e] shadow-sm transition active:scale-95"
                  aria-label="Adresse in Google Maps öffnen"
                  title="Adresse in Google Maps öffnen"
                >
                  <img
                    src="/icons/google-maps.svg"
                    alt="Google Maps"
                    className="h-5 w-5"
                  />
                </a>
              ) : null}
            </div>
          ) : null}

          {/* Buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            <DeliveryButtons
              spotId={spot.id}
              woltUrl={wolt}
              lieferandoUrl={lieferando}
              uberEatsUrl={uberEats}
              buttonClassName="rounded-2xl bg-[#e8decc] px-4 py-2 font-semibold text-[#0f3b2e]"
            />
          </div>

          {/* TikTok */}
          {spot.tiktok_embed_id && (
  <div className="mt-4 flex justify-center">
    <div className="w-full w-full rounded-2xl overflow-hidden shadow-lg">
      <TikTokEmbed
        key={`${spot.id}-${spot.tiktok_embed_id}`}
        embedInstanceId={`${spot.id}-${spot.tiktok_embed_id}`}
        username="juniorstaste"
        videoId={spot.tiktok_embed_id}
        height={760}
      />
    </div>
  </div>
)}

          {recommendations.length > 0 ? (
            <section className="mt-8">
              <h2 className="mb-4 text-xl font-extrabold text-white">
                K&ouml;nnte dir auch gefallen
              </h2>

              <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {recommendations.map((item) => {
                  const activePriceLevel = getPriceLevelValue(item.price_level, 4);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => router.push(`/spot/${item.id}`)}
                      className="w-[188px] shrink-0 rounded-2xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-3 text-left shadow-sm transition-all duration-300 hover:shadow-lg"
                    >
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="mb-3 h-24 w-full rounded-xl object-cover ring-1 ring-black/5"
                        />
                      ) : (
                        <div className="mb-3 h-24 w-full rounded-xl bg-[#f3ecdf] ring-1 ring-black/5" />
                      )}

                      <h3 className="truncate text-sm font-extrabold text-[#1f1f1f]">
                        {item.name}
                      </h3>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5a5348]">
                        {item.city_name ? <span className="font-medium">{item.city_name}</span> : null}
                        {item.category_name ? <span>{item.category_name}</span> : null}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {typeof item.rating === "number" ? (
                          <span className="jt-text-gradient inline-flex items-center gap-1">
                            <span>★</span>
                            <span className="font-semibold">{item.rating.toFixed(1)}</span>
                          </span>
                        ) : null}

                        {activePriceLevel > 0 ? (
                          <span
                            className="inline-flex items-center gap-0.5 font-semibold text-[#3b342b]"
                            aria-label={`Preisniveau ${activePriceLevel} von 4`}
                          >
                            {Array.from({ length: 4 }, (_, index) => (
                              <span
                                key={index}
                                className={
                                  index < activePriceLevel ? "text-[#3b342b]" : "text-[#3b342b]/30"
                                }
                              >
                                €
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
