"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import StarRating from "@/components/StarRating";
import PriceLevel from "@/components/PriceLevel";

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
  wolt_link?: string | null;
  lieferando_link?: string | null;
};

type Props = {
  center: [number, number];
  spots: MapSpot[];
  onSpotClick?: (id: string) => void;
  userPos?: { lat: number; lng: number } | null;

  activeSpotId?: string | null;
  onActiveChange?: (id: string) => void;
};

const CATEGORY_COLORS: Record<string, string> = {
  burger: "#e11d48",
  pizza: "#f97316",
  coffee: "#a16207",
  dessert: "#db2777",
  chicken: "#ca8a04",
  doener: "#0f766e",
  döner: "#0f766e",
  doner: "#0f766e",
  kebab: "#0f766e",
  vegan: "#22c55e",
  asian: "#2563eb",
  italian: "#16a34a",
  other: "#6b7280",
};

function normalizeSlug(slug?: string | null) {
  return (slug ?? "other").toString().trim().toLowerCase();
}

function getColorForCategory(slug?: string | null) {
  const s = normalizeSlug(slug);
  return CATEGORY_COLORS[s] ?? CATEGORY_COLORS.other;
}

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
function FitToSpots({ spots, userPos }: { spots: MapSpot[]; userPos?: { lat: number; lng: number } | null }) {
  const map = useMap();

  useEffect(() => {
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
  }, [spots, userPos, map]);

  return null;
}

// ✅ Label für Legende
function labelFromSlug(slug: string) {
  if (!slug) return "Other";
  if (["döner", "doner", "doener", "kebab"].includes(slug)) return "Döner/Kebab";
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

export default function CityMap({
  center,
  spots,
  onSpotClick,
  userPos,
  activeSpotId,
  onActiveChange,
}: Props) {
  const legendItems = useMemo(() => {
    const m = new Map<string, string>();

    spots.forEach((s) => {
      const slug = normalizeSlug(s.category_slug);
      if (!m.has(slug)) m.set(slug, labelFromSlug(slug));
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

          <FitToSpots spots={spots} userPos={userPos} />

          {/* ✅ User Standort Marker (genau 1x) */}
          {userPos ? (
            <Marker position={[userPos.lat, userPos.lng]} icon={userIcon}>
              <Popup>Du bist hier</Popup>
            </Marker>
          ) : null}

          {/* ✅ Spot Marker */}
          {spots.map((s) => {
            const slug = normalizeSlug(s.category_slug);
            const color = getColorForCategory(slug);

            const wolt = s.wolt_url ?? s.wolt_link ?? null;
            const lieferando = s.lieferando_url ?? s.lieferando_link ?? null;

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

                      {/* ✅ Zeile 2: Wolt / Lieferando */}
                      {wolt || lieferando ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {wolt ? (
                            <a
                              href={wolt}
                              target="_blank"
                              rel="noreferrer"
                              style={{
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
                            >
                              Lieferando
                            </a>
                          ) : null}
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
              <div key={item.slug} style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                <span style={{ fontSize: 13, color: "#333" }}>{item.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}