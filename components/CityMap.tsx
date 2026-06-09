"use client";

import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import StarRating from "@/components/StarRating";
import PriceLevel from "@/components/PriceLevel";
import DeliveryButtons from "@/components/DeliveryButtons";
import { trackAndOpenExternalLink } from "@/lib/externalClickTracking";
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
  google_maps_link?: string | null;

  // ✅ Bestell-Links (optional)
  wolt_url?: string | null;
  lieferando_url?: string | null;
  uber_eats_url?: string | null;
};

type Props = {
  center: [number, number];
  spots: MapSpot[];
  categories?: { slug: string; name: string }[];
  onSpotClick?: (id: string) => void;
  userPos?: { lat: number; lng: number } | null;
  userRadiusKm?: number;

  activeSpotId?: string | null;
  onActiveChange?: (id: string) => void;
  selectedLegendSlug?: string | null;
  onLegendSelect?: (slug: string | null) => void;
  immersiveSheet?: boolean;
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


// ✅ Bildmarker mit Kategorien-Farbrahmen, Fallback auf Farbpunkt
function makeSpotIcon(color: string, imageUrl?: string | null, isActive = false) {
  const size = isActive ? 42 : 34;
  const innerSize = isActive ? 32 : 24;
  const borderSize = isActive ? 3 : 2.5;

  const html = imageUrl
    ? `
      <div style="
        width:${size}px;
        height:${size}px;
        border-radius:999px;
        background:${color};
        border:${borderSize}px solid rgba(255,255,255,.92);
        box-shadow:0 6px 16px rgba(0,0,0,.28);
        display:flex;
        align-items:center;
        justify-content:center;
        overflow:hidden;
      ">
        <img
          src="${imageUrl}"
          alt=""
          style="
            width:${innerSize}px;
            height:${innerSize}px;
            border-radius:999px;
            object-fit:cover;
            display:block;
          "
        />
      </div>
    `
    : `
      <div style="
        width:${size}px;
        height:${size}px;
        border-radius:999px;
        background:${color};
        border:${borderSize}px solid rgba(255,255,255,.92);
        box-shadow:0 6px 16px rgba(0,0,0,.28);
      "></div>
    `;

  return L.divIcon({
    html,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
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
  immersiveSheet = false,
}: {
  spots: MapSpot[];
  userPos?: { lat: number; lng: number } | null;
  userRadiusKm?: number;
  immersiveSheet?: boolean;
}) {
  const map = useMap();

  // Primitive statt Objekt-Identität: Seiten übergeben userPos teils als
  // Inline-Literal, das bei jedem Render eine neue Referenz bekommt.
  const userLat = typeof userPos?.lat === "number" ? userPos.lat : null;
  const userLng = typeof userPos?.lng === "number" ? userPos.lng : null;

  // Merken, was zuletzt gefittet wurde: Reine Spot-Änderungen (Suche/Filter
  // pro Tastendruck, neue Array-Identität bei jedem Render) dürfen das
  // manuelle Pan/Zoom des Users nicht verwerfen.
  const lastUserFitRef = useRef<string | null>(null);
  const hasInitialSpotsFitRef = useRef(false);

  useEffect(() => {
    if (userLat !== null && userLng !== null) {
      // Nur neu fliegen, wenn sich Position/Radius/Sheet wirklich geändert haben
      const fitSignature = `${userLat},${userLng},${userRadiusKm},${immersiveSheet}`;
      if (lastUserFitRef.current === fitSignature) return;
      lastUserFitRef.current = fitSignature;

      const userPosNow = { lat: userLat, lng: userLng };
      const nearbyPoints = spots
        .filter(
          (spot) => haversineKm(userPosNow, { lat: spot.lat, lng: spot.lng }) <= userRadiusKm
        )
        .map((spot) => [spot.lat, spot.lng] as [number, number]);

      if (immersiveSheet && nearbyPoints.length > 0) {
        const nearbyBounds = L.latLngBounds([[userLat, userLng], ...nearbyPoints]);
        map.flyToBounds(nearbyBounds, {
          padding: [40, 40],
          duration: 0.8,
        });
        return;
      }

      const userBounds = getBoundsAroundUser(userPosNow, userRadiusKm);
      map.flyToBounds(userBounds, {
        padding: [40, 40],
        duration: 0.8,
      });
      return;
    }

    lastUserFitRef.current = null;

    // Ohne Standort: nur einmal initial auf die Spots fitten (sobald welche
    // geladen sind) — danach behält der User die Kontrolle über die Karte.
    if (hasInitialSpotsFitRef.current) return;

    const points = (spots ?? []).map((s) => [s.lat, s.lng] as [number, number]);

    if (points.length === 0) return;

    hasInitialSpotsFitRef.current = true;

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40] });

    // Wenn nur 1 Punkt (z.B. nur 1 Spot)
    if (points.length === 1) {
      map.setView(points[0], 15);
    }
  }, [spots, userLat, userLng, userRadiusKm, immersiveSheet, map]);

  return null;
}

export default function CityMap({
  center,
  spots,
  categories = [],
  onSpotClick,
  userPos,
  userRadiusKm = 20,
  activeSpotId,
  onActiveChange,
  selectedLegendSlug,
  onLegendSelect,
  immersiveSheet = false,
}: Props) {
  const legendItems = useMemo(() => {
    return [
      { slug: "all", label: "Alle" },
      ...categories.map((category) => ({
        slug: category.slug,
        label: category.name,
      })),
    ];
  }, [categories]);

  const nearbySpots = useMemo(() => {
    if (!immersiveSheet || !userPos) return [];

    return [...spots]
      .map((spot) => ({
        ...spot,
        distanceKm: haversineKm(userPos, { lat: spot.lat, lng: spot.lng }),
      }))
      .filter((spot) => spot.distanceKm <= 10)
      .sort((a, b) => {
        const aRating = typeof a.rating === "number" ? a.rating : -1;
        const bRating = typeof b.rating === "number" ? b.rating : -1;

        if (bRating !== aRating) return bRating - aRating;
        return a.distanceKm - b.distanceKm;
      })
      .slice(0, 12);
  }, [immersiveSheet, spots, userPos]);

  return (
    <div
      style={{
        position: "relative",
        borderRadius: immersiveSheet ? 0 : 24,
        overflow: "hidden",
        border: immersiveSheet ? "none" : "1px solid rgba(255,255,255,0.12)",
        boxShadow: immersiveSheet ? "none" : "0 18px 48px rgba(6, 24, 19, 0.28)",
      }}
    >
      <div
        style={{
          height: immersiveSheet ? "calc(100vh - 168px)" : 520,
          minHeight: immersiveSheet ? 620 : undefined,
          width: "100%",
        }}
      >
        <MapContainer
          center={center}
          zoom={12}
          zoomControl={!immersiveSheet}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitToSpots
            spots={spots}
            userPos={userPos}
            userRadiusKm={userRadiusKm}
            immersiveSheet={immersiveSheet}
          />

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
            const googleMapsLink = s.google_maps_link ?? null;

            const isActive = activeSpotId === s.id;
            const icon = makeSpotIcon(color, s.image_url, isActive);

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
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
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
                            flex: 1,
                          }}
                        >
                          Zum Spot →
                        </button>

                        {googleMapsLink ? (
                          <a
                            href={googleMapsLink}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) =>
                              void trackAndOpenExternalLink({
                                event: e,
                                url: googleMapsLink,
                                spotId: s.id,
                                buttonType: "maps",
                              })
                            }
                            style={{
                              padding: "8px 10px",
                              borderRadius: 10,
                              border: "1px solid #ddd",
                              background: "white",
                              cursor: "pointer",
                              fontWeight: 800,
                              fontSize: 12,
                              textDecoration: "none",
                              color: "#111827",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              whiteSpace: "nowrap",
                            }}
                            aria-label="Google Maps öffnen"
                            title="Google Maps öffnen"
                          >
                            <img
                              src="/icons/google-maps.svg"
                              alt="Google Maps"
                              width="20"
                              height="20"
                              style={{ display: "block" }}
                            />
                          </a>
                        ) : null}
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

      <div
        style={{
          pointerEvents: "none",
          position: immersiveSheet ? "absolute" : "relative",
          inset: immersiveSheet ? "auto 0 -10px 0" : "auto",
          zIndex: immersiveSheet ? 500 : "auto",
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            borderRadius: immersiveSheet ? "28px 28px 0 0" : 26,
            background: immersiveSheet ? "rgba(15, 59, 46, 0.84)" : "white",
            border: immersiveSheet
              ? "1px solid rgba(255,255,255,0.1)"
              : "1px solid rgba(229, 231, 235, 1)",
            backdropFilter: immersiveSheet ? "blur(16px)" : "none",
            WebkitBackdropFilter: immersiveSheet ? "blur(16px)" : "none",
            boxShadow: immersiveSheet ? "0 16px 40px rgba(6, 24, 19, 0.32)" : "none",
            padding: immersiveSheet ? "10px 16px 14px" : "12px 14px 14px",
          }}
        >
          <div
            style={{
              margin: "0 auto 12px",
              width: 42,
              height: 5,
              borderRadius: 999,
              background: immersiveSheet ? "rgba(255,255,255,0.25)" : "rgba(15,59,46,0.16)",
            }}
          />

          {immersiveSheet ? (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontWeight: 800,
                  marginBottom: 10,
                  color: "white",
                  fontSize: 16,
                }}
              >
                In deiner Nähe
              </div>

              {userPos ? (
                nearbySpots.length > 0 ? (
                  <div
                    className="no-scrollbar"
                    style={{
                      display: "flex",
                      gap: 10,
                      overflowX: "auto",
                      paddingBottom: 2,
                      WebkitOverflowScrolling: "touch",
                    }}
                  >
                    {nearbySpots.map((spot) => (
                      <button
                        key={`nearby-${spot.id}`}
                        type="button"
                        onClick={() => onSpotClick?.(spot.id)}
                        style={{
                          minWidth: 156,
                          maxWidth: 156,
                          borderRadius: 18,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: "rgba(255,255,255,0.08)",
                          padding: 8,
                          boxShadow: "0 8px 18px rgba(6, 24, 19, 0.18)",
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          textAlign: "left",
                          color: "white",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        {spot.image_url ? (
                          <img
                            src={spot.image_url}
                            alt={spot.name}
                            style={{
                              width: 46,
                              height: 46,
                              borderRadius: 12,
                              objectFit: "cover",
                              display: "block",
                              flexShrink: 0,
                              border: "1px solid rgba(255,255,255,0.12)",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 46,
                              height: 46,
                              borderRadius: 12,
                              background: "rgba(255,255,255,0.12)",
                              flexShrink: 0,
                              border: "1px solid rgba(255,255,255,0.12)",
                            }}
                          />
                        )}

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              lineHeight: 1.2,
                              fontWeight: 800,
                              color: "white",
                              marginBottom: 3,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={spot.name}
                          >
                            {spot.name}
                          </div>

                          <div
                            style={{
                              fontSize: 11,
                              color: "rgba(255,255,255,0.72)",
                              marginBottom: 3,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {labelFromCategorySlug(normalizeCategorySlug(spot.category_slug))}
                          </div>

                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              color: "rgba(255,255,255,0.58)",
                            }}
                          >
                            <span>{spot.distanceKm.toFixed(1).replace(".", ",")} km</span>
                            {typeof spot.rating === "number"
                              ? (
                                <>
                                  <span>{` · `}</span>
                                  <span className="jt-text-gradient">{`★ ${spot.rating.toFixed(1)}`}</span>
                                </>
                              )
                              : ""}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.72)",
                    }}
                  >
                    Keine Spots im Umkreis von 10 km gefunden.
                  </div>
                )
              ) : (
                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.72)",
                  }}
                >
                  Standort aktivieren, um Spots in deiner Nähe zu sehen.
                </div>
              )}
            </div>
          ) : null}

          <div
            style={{
              fontWeight: 800,
              marginBottom: 10,
              color: immersiveSheet ? "white" : "#111827",
              fontSize: 16,
            }}
          >
            Worauf hast du Lust?
          </div>

          {legendItems.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: immersiveSheet ? "rgba(255,255,255,0.72)" : "#666",
              }}
            >
              Keine Kategorien gefunden.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {legendItems.map((item) => (
                (() => {
                  const isAllItem = item.slug === "all";
                  const isSelected = selectedLegendSlug === item.slug;

                  return (
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
                      isSelected
                        ? immersiveSheet
                          ? "1px solid rgba(255,255,255,0.14)"
                          : "1px solid #0f3b2e"
                        : immersiveSheet
                        ? "1px solid rgba(255,255,255,0.1)"
                        : "1px solid #e5e7eb",
                    background:
                      isSelected
                        ? immersiveSheet
                          ? "linear-gradient(90deg, rgba(255, 124, 144, 0.72) 0%, rgba(255, 225, 164, 0.72) 100%)"
                          : "#f6efe3"
                        : immersiveSheet
                        ? "rgba(255,255,255,0.08)"
                        : "white",
                    color: isSelected ? "#0f3b2e" : immersiveSheet ? "white" : "#333",
                    padding: "9px 12px",
                    cursor: "pointer",
                    boxShadow:
                      isSelected
                        ? immersiveSheet
                          ? "0 10px 22px rgba(255, 124, 144, 0.18)"
                          : "none"
                        : "none",
                      }}
                    >
                      <span
                        style={{
                      width: 12,
                      height: 12,
                      borderRadius: 999,
                      background: isAllItem ? "#ffffff" : getColorForCategory(item.slug),
                      border: immersiveSheet
                        ? "2px solid rgba(255,255,255,0.9)"
                        : "2px solid white",
                      boxShadow: "0 1px 4px rgba(0,0,0,.2)",
                      display: "inline-block",
                        }}
                      />
                      <span
                        style={{
                      fontSize: 13,
                      color: isSelected ? "#0f3b2e" : immersiveSheet ? "white" : "#333",
                      fontWeight: 700,
                        }}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })()
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
