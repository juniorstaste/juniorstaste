"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import SiteHeader from "@/components/SiteHeader";
import { useRouter } from "next/navigation";
import TopRightMenu from "@/components/TopRightMenu";


type City = { id: string; name: string; slug: string; spotCount: number };

export default function Home() {
  const [cities, setCities] = useState<City[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [geoLoading, setGeoLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(30);
  const [radiusOpen, setRadiusOpen] = useState<boolean>(false);
  const [cityOpen, setCityOpen] = useState<boolean>(false);

  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadCities() {
      const { data: cityRows, error: citiesError } = await supabase
        .from("cities")
        .select("id, name, slug");

      if (citiesError) {
        setErrorMsg(citiesError.message);
        return;
      }

      const { data: spotRows, error: spotsError } = await supabase
        .from("spots")
        .select("city_id");

      if (spotsError) {
        setErrorMsg(spotsError.message);
        return;
      }

      const spotCounts = new Map<string, number>();

      (spotRows ?? []).forEach((spot: { city_id: string | null }) => {
        if (!spot.city_id) return;
        spotCounts.set(spot.city_id, (spotCounts.get(spot.city_id) ?? 0) + 1);
      });

      const sortedCities = ((cityRows ?? []) as Array<{ id: string; name: string; slug: string }>)
        .map((city) => ({
          ...city,
          spotCount: spotCounts.get(city.id) ?? 0,
        }))
        .sort((a, b) => {
          if (b.spotCount !== a.spotCount) return b.spotCount - a.spotCount;
          return a.name.localeCompare(b.name);
        });

      setCities(sortedCities);
    }

    loadCities();
  }, []);

    useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setCityOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function requestLocation() {
    setGeoError(null);
    setGeoLoading(true);

    if (!navigator.geolocation) {
      setGeoError("Standort wird von deinem Browser nicht unterstützt.");
      setGeoLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setRadiusOpen(true);
        setGeoLoading(false);
      },
      () => {
        setGeoError("Standort konnte nicht abgerufen werden.");
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function goToNearPage() {
    if (!coords) return;
    router.push(`/near?lat=${coords.lat}&lng=${coords.lng}&r=${radiusKm}`);
  }

  return (
<main className="relative min-h-screen w-full overflow-x-hidden bg-[#0f3b2e] flex flex-col items-center justify-center text-center px-6">
  <div className="w-full max-w-[560px]">
    <div className="fixed right-4 top-6 z-50">
      <TopRightMenu />
    </div>

      {/* Logo */}
      <div className="relative z-0 mx-auto w-full max-w-[420px] mb-14 -mt-8 overflow-hidden">
  

  <div className="origin-top text-center scale-150">
  <SiteHeader />
</div>
</div>

      <h1 className="mx-auto mt-8 mb-6 w-full max-w-[420px] text-center text-3xl md:text-4xl font-extrabold italic text-white tracking-wide fade-up">
  Wähle deine Stadt  
</h1>

      <div className="mx-auto mt-2 flex w-full max-w-sm flex-col gap-4">

        {/* 🔥 Standort Button GANZ OBEN */}
        <button
          onClick={requestLocation}
          disabled={geoLoading}
          className="w-full h-[56px] rounded-2xl bg-[#e8decc] text-lg font-semibold text-[#0f3b2e] shadow-md transition active:scale-[1.03] md:hover:scale-[1.03] disabled:opacity-70"
        >
          {geoLoading ? "Standort wird geladen…" : "📍 Standort verwenden"}
        </button>

        {/* Radius Auswahl klappt hier auf */}
        {radiusOpen && (
          <div className="w-full rounded-2xl border border-white/20 p-4 text-left">
            <div className="text-white font-semibold mb-3">
              Umkreis wählen
            </div>

            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-full h-[48px] rounded-xl bg-[#e8decc] text-[#0f3b2e] font-semibold px-3"
            >
              <option value={2}>2 km</option>
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
              <option value={15}>15 km</option>
              <option value={20}>20 km</option>
              <option value={25}>25 km</option>
              <option value={30}>30 km</option>
            </select>

            <div className="mt-4 flex gap-3">
              <button
                onClick={goToNearPage}
                className="flex-1 h-[48px] rounded-xl bg-[#e8decc] text-[#0f3b2e] font-semibold shadow-md transition active:scale-[1.02] md:hover:scale-[1.02]"
              >
                Weiter →
              </button>

              <button
                onClick={() => {
                  setRadiusOpen(false);
                  setCoords(null);
                }}
                className="h-[48px] px-4 rounded-xl bg-white/10 text-white border border-white/20"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Städte Dropdown (Custom) */}
<div ref={dropdownRef} className="relative w-full">
  <button
    onClick={() => setCityOpen(!cityOpen)}
    className="w-full h-[56px] rounded-2xl bg-[#e8decc] text-lg font-semibold text-[#0f3b2e] shadow-md transition active:scale-[1.03] md:hover:scale-[1.03]"
  >
    Stadt auswählen
  </button>

  {cityOpen && (
    <div className="absolute top-[64px] left-0 w-full rounded-2xl bg-[#e8decc] shadow-lg overflow-hidden z-20">
      {cities.map((city) => (
        <button
  key={city.slug}
  onClick={() => {
    setCityOpen(false);
    router.push(`/city/${city.slug}`);
  }}
  className="w-full px-4 py-3 text-center font-semibold text-[#0f3b2e] transition active:bg-[#ded3be] md:hover:bg-[#ded3be]"
>
          {city.name}
        </button>
      ))}
    </div>
  )}
</div>
      </div>

      {geoError && (
        <div className="mt-4 text-sm text-red-400">
          {geoError}
        </div>
      )}

      {errorMsg && (
        <div className="mt-4 text-sm text-red-400">
          {errorMsg}
        </div>
      )}
    </div>
    </main>
  );
}
