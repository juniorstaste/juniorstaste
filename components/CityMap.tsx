"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import StarRating from "@/components/StarRating";
import PriceLevel from "@/components/PriceLevel";
import DeliveryButtons from "@/components/DeliveryButtons";
import {
  getColorForCategory,
  labelFromCategorySlug,
  normalizeCategorySlug,
} from "@/lib/cityMapCategories";

type MapSpot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  image_url?: string | null;
  rating?: number | null;
  price_level?: number | null;
  category_slug?: string | null;

  // ✅ Bestell-Links (optional)
  wolt_url?: string | null;
  lieferando_url?: string | null;
  uber_eats_url?: string | null;
};

type Props = {
  center: [number, number];
  spots: MapSpot[];
  onSpotClick?: (id: string) => void;
  userPos?: { lat: number; lng: number } | null;
  userRadiusKm?: number;

  activeSpotId?: string | null;
  onActiveChange?: (id: string) => void;
  selectedLegendSlug?: string | null;
  onLegendSelect?: (slug: string | null) => void;
};


// ✅ farbiger Punkt als Icon
function makeDotIcon(color: string) {
  const html = `
    <div style="
      width:18px;height:18px;border-radius:999px;
      background:${color};
      border:3px solid white;
      box-shadow:0 2px 8px rgba(0,0,0,.25);
    "></div>
  `;
  return L.divIcon({
    html,
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

// ✅ User Icon (blauer Punkt)
const userIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width:18px;height:18px;border-radius:999px;
      background:#2563eb;
      border:3px solid white;
      box-shadow:0 2px 10px rgba(0,0,0,.25);
    "></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// ✅ Auto-Zoom auf alle Spots
function getBoundsAroundUser(
  userPos: { lat: number; lng: number },
  radiusKm: number
): L.LatLngBounds {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((userPos.lat * Math.PI) / 180));

  return L.latLngBounds(
    [userPos.lat - latDelta, userPos.lng - lngDelta],
    [userPos.lat + latDelta, userPos.lng + lngDelta]
  );
}

function FitToSpots({
  spots,
  userPos,
  userRadiusKm = 15,
}: {
  spots: MapSpot[];
  userPos?: { lat: number; lng: number } | null;
  userRadiusKm?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (userPos && typeof userPos.lat === "number" && typeof userPos.lng === "number") {
      const userBounds = getBoundsAroundUser(userPos, userRadiusKm);
      map.flyToBounds(userBounds, {
        padding: [40, 40],
        duration: 0.8,
      });
      return;
    }

    const points: [number, number][] = [];

    // Spots
    (spots ?? []).forEach((s) => {
      points.push([s.lat, s.lng]);
    });

    // User position (wenn vorhanden)
    if (userPos && typeof userPos.lat === "number" && typeof userPos.lng === "number") {
      points.push([userPos.lat, userPos.lng]);
    }

    if (points.length === 0) return;

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40] });

    // Wenn nur 1 Punkt (z.B. nur Standort oder nur 1 Spot)
    if (points.length === 1) {
      map.setView(points[0], 15);
    }
  }, [spots, userPos, userRadiusKm, map]);

  return null;
}

export default function CityMap({
  center,
  spots,
  onSpotClick,
  userPos,
  userRadiusKm = 15,
  activeSpotId,
  onActiveChange,
  selectedLegendSlug,
  onLegendSelect,
}: Props) {
  const legendItems = useMemo(() => {
    const m = new Map<string, string>();

    spots.forEach((s) => {
      const slug = normalizeCategorySlug(s.category_slug);
      if (!m.has(slug)) m.set(slug, labelFromCategorySlug(slug));
    });

    return Array.from(m.entries())
      .map(([slug, name]) => ({ slug, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [spots]);

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #ddd" }}>
      <div style={{ height: 420, width: "100%" }}>
        <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitToSpots spots={spots} userPos={userPos} userRadiusKm={userRadiusKm} />

          {/* ✅ User Standort Marker (genau 1x) */}
          {userPos ? (
            <Marker position={[userPos.lat, userPos.lng]} icon={userIcon}>
              <Popup>Du bist hier</Popup>
            </Marker>
          ) : null}

          {/* ✅ Spot Marker */}
          {spots.map((s) => {
            const slug = normalizeCategorySlug(s.category_slug);
            const color = getColorForCategory(slug);

            const wolt = s.wolt_url ?? null;
            const lieferando = s.lieferando_url ?? null;
            const uberEats = s.uber_eats_url ?? null;

            // Optional: aktiver Spot etwas “kräftiger” anzeigen
            const isActive = activeSpotId === s.id;
            const icon = makeDotIcon(isActive ? color : color);

            return (
              <Marker
                key={s.id}
                position={[s.lat, s.lng]}
                icon={icon}
                eventHandlers={{
                  click: () => {
                    onActiveChange?.(s.id);
                    // Popup öffnet Leaflet automatisch
                  },
                }}
              >
                <Popup closeButton={true} autoPan={true}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", width: 260, maxWidth: 260 }}>
                    {/* Bild */}
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 12,
                        overflow: "hidden",
                        flexShrink: 0,
                        border: `3px solid ${color}`,
                        background: "#eee",
                      }}
                    >
                      {s.image_url ? (
                        <img
                          src={s.image_url}
                          alt={s.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : null}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      {/* Name */}
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 14,
                          lineHeight: 1.2,
                          marginBottom: 4,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={s.name}
                      >
                        {s.name}
                      </div>

                      {/* Meta */}
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          fontSize: 12,
                          color: "#555",
                          lineHeight: 1.2,
                          marginBottom: 10,
                          alignItems: "center",
                        }}
                      >
                        {s.rating != null ? <StarRating value={s.rating} size={13} showNumber={false} /> : null}
                        <PriceLevel value={s.price_level} />
                      </div>

                      {/* ✅ Zeile 1: Zum Spot */}
                      <div style={{ marginBottom: 8 }}>
                        <button
                          onClick={() => onSpotClick?.(s.id)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: "white",
                            cursor: "pointer",
                            fontWeight: 800,
                            fontSize: 12,
                            width: "100%",
                          }}
                        >
                          Zum Spot →
                        </button>
                      </div>

                      {/* ✅ Zeile 2: Lieferdienste */}
                      {wolt || lieferando || uberEats ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <DeliveryButtons
                            spotId={s.id}
                            woltUrl={wolt}
                            lieferandoUrl={lieferando}
                            uberEatsUrl={uberEats}
                            buttonStyle={{
                              padding: "7px 10px",
                              borderRadius: 10,
                              border: "1px solid #ddd",
                              background: "white",
                              textDecoration: "none",
                              fontWeight: 800,
                              fontSize: 12,
                              lineHeight: 1,
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* ✅ Legende */}
      <div style={{ padding: 12, background: "white" }}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Legende</div>

        {legendItems.length === 0 ? (
          <div style={{ fontSize: 13, color: "#666" }}>Keine Kategorien gefunden.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {legendItems.map((item) => (
              <button
                key={item.slug}
                type="button"
                onClick={() =>
                  onLegendSelect?.(selectedLegendSlug === item.slug ? null : item.slug)
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 999,
                  border:
                    selectedLegendSlug === item.slug
                      ? "1px solid #0f3b2e"
                      : "1px solid #e5e7eb",
                  background:
                    selectedLegendSlug === item.slug ? "#f6efe3" : "white",
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: getColorForCategory(item.slug),
                    border: "2px solid white",
                    boxShadow: "0 1px 4px rgba(0,0,0,.2)",
                    display: "inline-block",
                  }}
                />
                <span style={{ fontSize: 13, color: "#333", fontWeight: 700 }}>{item.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
