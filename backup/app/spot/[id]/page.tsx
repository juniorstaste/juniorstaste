"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import TikTokEmbed from "@/components/TikTokEmbed";
import StarRating from "@/components/StarRating";
import PriceLevel from "@/components/PriceLevel";
import DistanceLabel from "@/components/DistanceLabel";

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
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

export default function SpotDetailPage() {
  const params = useParams();

  const spotId = useMemo(() => {
    const raw = (params as any)?.id;
    if (!raw) return null;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [spot, setSpot] = useState<Spot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!spotId) return;

    async function load() {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase.from("spots_with_city").select("*").eq("id", spotId).maybeSingle();

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setErrorMsg("Spot nicht gefunden.");
        setLoading(false);
        return;
      }

      setSpot(data as Spot);
      setLoading(false);
    }

    load();
  }, [spotId]);

  if (!spotId) return <main style={{ padding: 16 }}>Lade Spot…</main>;

  const wolt = spot?.wolt_url ?? spot?.wolt_link ?? null;
  const lieferando = spot?.lieferando_url ?? spot?.lieferando_link ?? null;

  return (
    <main style={{ padding: 16, fontFamily: "Arial, sans-serif", maxWidth: 560, margin: "0 auto" }}>
      <a
        href={spot?.city_slug ? `/city/${spot.city_slug}` : "/"}
        style={{ display: "inline-block", marginBottom: 12, textDecoration: "none" }}
      >
        ← Zurück
      </a>
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
  <button
    onClick={() => {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // optional: kannst du später eine Meldung anzeigen
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }}
    style={{
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #ddd",
      background: "white",
      cursor: "pointer",
      fontWeight: 800,
    }}
  >
    📍 Entfernung anzeigen
  </button>

  <button
    onClick={() => setUserPos(null)}
    style={{
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #ddd",
      background: "white",
      cursor: "pointer",
      fontWeight: 800,
    }}
    title="Standort zurücksetzen"
  >
    ✕
  </button>
</div>

      {loading ? (
        <p>Lade Spot…</p>
      ) : errorMsg ? (
        <div style={{ padding: 12, border: "1px solid red" }}>
          <b>Fehler:</b> {errorMsg}
        </div>
      ) : !spot ? null : (
        <>
          {/* Mini-Map oben */}
          {typeof spot.lat === "number" && typeof spot.lng === "number" ? (
            <SpotMiniMap lat={spot.lat} lng={spot.lng} name={spot.name} googleMapsLink={spot.google_maps_link} />
          ) : null}

          <h1 style={{ fontSize: 28, marginBottom: 6 }}>{spot.name}</h1>

          <div style={{ marginBottom: 12, color: "#666", fontSize: 15, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {spot.city_name ? <span>{spot.city_name}</span> : null}
            {spot.rating != null ? <StarRating value={spot.rating} size={15} showNumber={true} /> : null}
            <PriceLevel value={spot.price_level} />
          </div>
          {/* ✅ Action-Buttons direkt unter City/Rating/Preis */}
<div style={{ margin: "0 0 12px", display: "flex", gap: 10, flexWrap: "wrap" }}>
  {spot.google_maps_link ? (
    <a
      href={spot.google_maps_link}
      target="_blank"
      rel="noreferrer"
      style={{
        padding: "10px 12px",
        border: "1px solid #ddd",
        borderRadius: 10,
        textDecoration: "none",
        fontWeight: 700,
      }}
    >
      Google Maps
    </a>
  ) : null}

  {wolt ? (
    <a
      href={wolt}
      target="_blank"
      rel="noreferrer"
      style={{
        padding: "10px 12px",
        border: "1px solid #ddd",
        borderRadius: 10,
        textDecoration: "none",
        fontWeight: 700,
      }}
    >
      Wolt
    </a>
  ) : null}

  {lieferando ? (
    <a
      href={lieferando}
      target="_blank"
      rel="noreferrer"
      style={{
        padding: "10px 12px",
        border: "1px solid #ddd",
        borderRadius: 10,
        textDecoration: "none",
        fontWeight: 700,
      }}
    >
      Lieferando
    </a>
  ) : null}
</div>
          {userPos && typeof spot.lat === "number" && typeof spot.lng === "number" ? (
  <DistanceLabel km={haversineKm(userPos, { lat: spot.lat, lng: spot.lng })} />
) : null}

          {spot.image_url ? (
            <img src={spot.image_url} alt={spot.name} style={{ width: "100%", borderRadius: 12, marginBottom: 12 }} />
          ) : null}

          {spot.description ? <p style={{ marginTop: 0 }}>{spot.description}</p> : null}
          {spot.address ? <p style={{ color: "#666" }}>{spot.address}</p> : null}


          {/* TikTok Embed auf der Detailseite */}
          {spot.tiktok_embed_id ? (
            <div style={{ marginTop: 16 }}>
              <TikTokEmbed username="juniorstaste" videoId={spot.tiktok_embed_id} />
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}