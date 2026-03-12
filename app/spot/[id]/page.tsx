"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import StarRating from "@/components/StarRating";
import PriceLevel from "@/components/PriceLevel";
import DistanceLabel from "@/components/DistanceLabel";
import TikTokEmbed from "@/components/TikTokEmbed";
import ProfileButton from "@/components/ProfileButton";
import SaveSpotButton from "@/components/SaveSpotButton";

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
  wolt_url?: string | null;
  lieferando_url?: string | null;
  wolt_link?: string | null;
  lieferando_link?: string | null;
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
    const raw = (params as any)?.id;
    if (!raw) return null;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [spot, setSpot] = useState<Spot | null>(null);
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

  const wolt = spot?.wolt_url ?? spot?.wolt_link ?? null;
  const lieferando = spot?.lieferando_url ?? spot?.lieferando_link ?? null;

  return (
    <main className="min-h-screen bg-[#0f3b2e] text-white px-6 py-8 max-w-xl mx-auto">

      <div className="flex items-center justify-between mb-6">

  <button
  onClick={() => router.push(spot?.city_slug ? `/city/${spot.city_slug}` : "/")}
  className="text-[28px] leading-none text-white font-semibold hover:opacity-70 transition"
  aria-label="Zurück"
>
  ‹
</button>

  <div className="flex items-center gap-2">
    {spot?.id && <SaveSpotButton spotId={spot.id} />}
    <ProfileButton />
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
                userPos={userPos}
              />
            </div>
          ) : null}

          {/* ✅ Entfernung DIREKT unter Karte */}
          {userPos && spot.lat && spot.lng && (
            <div className="mb-4">
              <DistanceLabel
                km={haversineKm(userPos, { lat: spot.lat, lng: spot.lng })}
              />
            </div>
          )}

          {/* Titel */}
          <h1 className="text-3xl font-extrabold mb-3">{spot.name}</h1>

          {/* Meta */}
          <div className="flex flex-wrap gap-4 items-center mb-4">
            {spot.city_name && <span>{spot.city_name}</span>}
            {spot.rating != null && <StarRating value={spot.rating} />}
            <PriceLevel value={spot.price_level} />
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            {spot.google_maps_link && (
              <a
                href={spot.google_maps_link}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-[#e8decc] px-4 py-2 font-semibold text-[#0f3b2e]"
              >
                Google Maps
              </a>
            )}

            {wolt && (
              <a
                href={wolt}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-[#e8decc] px-4 py-2 font-semibold text-[#0f3b2e]"
              >
                Wolt
              </a>
            )}

            {lieferando && (
              <a
                href={lieferando}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-[#e8decc] px-4 py-2 font-semibold text-[#0f3b2e]"
              >
                Lieferando
              </a>
            )}
          </div>

          {/* Bild */}
          {spot.image_url && (
            <img
              src={spot.image_url}
              alt={spot.name}
              className="w-full rounded-2xl"
            />
          )}

          {/* Beschreibung */}
          {spot.description && (
            <p className="mt-6 text-sm text-white/90">{spot.description}</p>
          )}

          {/* Adresse */}
          {spot.address && (
            <p className="mt-2 text-sm text-white/70">{spot.address}</p>
          )}

          {/* TikTok */}
          {spot.tiktok_embed_id && (
  <div className="mt-8 flex justify-center">
    <div className="w-full w-full rounded-2xl overflow-hidden shadow-lg">
      <TikTokEmbed
        username="juniorstaste"
        videoId={spot.tiktok_embed_id}
        height={760}
      />
    </div>
  </div>
)}
        </>
      )}
    </main>
  );
}