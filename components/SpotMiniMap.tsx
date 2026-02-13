"use client";

import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import { useMemo } from "react";

type Props = {
  lat: number;
  lng: number;
  name: string;
  googleMapsLink?: string | null;
  userPos?: { lat: number; lng: number } | null;
};

export default function SpotMiniMap({ lat, lng, name, googleMapsLink, userPos }: Props) {
  const center: [number, number] = [lat, lng];

  // ✅ Icons erst im Browser erzeugen (stabiler in Next.js)
  const markerIcon = useMemo(() => {
    return new L.Icon({
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });
  }, []);

  const userIcon = useMemo(() => {
    return new L.DivIcon({
      className: "",
      html: `<div style="width:14px;height:14px;border-radius:999px;background:#2563eb;border:2px solid white;box-shadow:0 0 0 2px rgba(37,99,235,0.35)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }, []);

  return (
    <div
      style={{
        height: 220,
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #ddd",
        marginBottom: 12,
      }}
    >
      <MapContainer
        center={center}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Spot Marker */}
        <Marker position={[lat, lng]} icon={markerIcon}>
          <Popup>
            <b>{name}</b>
            {googleMapsLink ? (
              <div style={{ marginTop: 6 }}>
                <a href={googleMapsLink} target="_blank" rel="noreferrer">
                  In Google Maps öffnen
                </a>
              </div>
            ) : null}
          </Popup>
        </Marker>

        {/* Optional: User position */}
        {userPos ? (
          <>
            <Marker position={[userPos.lat, userPos.lng]} icon={userIcon}>
              <Popup>Du bist hier</Popup>
            </Marker>

            <Circle
              center={[userPos.lat, userPos.lng]}
              radius={60}
              pathOptions={{ weight: 2, opacity: 0.6, fillOpacity: 0.15 }}
            />
          </>
        ) : null}
      </MapContainer>
    </div>
  );
}