"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import TopRightMenu from "@/components/TopRightMenu";
import { geolocationErrorMessage } from "@/lib/geolocationError";

type City = { id: string; name: string; slug: string; spotCount: number };

export default function Home() {
  const [cities, setCities] = useState<City[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(30);
  const [radiusOpen, setRadiusOpen] = useState<boolean>(false);

  const router = useRouter();

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
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#cities") return;

    const scrollToCities = () => {
      document.getElementById("cities")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    };

    const timeoutId = window.setTimeout(scrollToCities, 80);

    return () => {
      window.clearTimeout(timeoutId);
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
      (error) => {
        setGeoError(geolocationErrorMessage(error));
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
    <main className="min-h-screen w-full overflow-x-hidden bg-[#0f3b2e] px-5 pb-10 pt-6 text-white">
      <div className="mx-auto w-full max-w-[560px]">
        <div className="fixed right-4 top-6 z-50">
          <TopRightMenu />
        </div>

        <section className="relative -mx-5 min-h-[320px] overflow-hidden px-5 pb-1 pt-0 sm:mx-0 sm:px-0">
          <div className="absolute inset-0">
            <img
              src="/logo-transparent.png"
              alt=""
              aria-hidden="true"
              className="absolute left-1/2 top-[-22%] w-[96%] max-w-[560px] -translate-x-1/2"
            />
          </div>

          <div className="relative z-10 pb-0 pt-[138px]" />
        </section>

        <section id="cities" className="mt-0">
          <div className="mb-4 flex w-full flex-col gap-4">
            <button
              onClick={requestLocation}
              disabled={geoLoading}
              className="jt-active-gradient h-[56px] w-full rounded-2xl text-lg font-semibold transition active:scale-[1.03] md:hover:scale-[1.03] disabled:opacity-70"
            >
              {geoLoading ? "Standort wird geladen…" : "📍 Standort verwenden"}
            </button>

            {/* Direkt am Button — unten unter der Städteliste wäre die
                Meldung außerhalb des Viewports */}
            {geoError ? <div className="text-sm text-red-400">{geoError}</div> : null}

            {radiusOpen && (
              <div className="w-full rounded-[24px] border border-white/12 bg-white/8 p-4 text-left shadow-sm backdrop-blur-sm">
                <div className="mb-3 font-semibold text-white">Umkreis wählen</div>

                <select
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="h-[48px] w-full rounded-xl bg-[#e8decc] px-3 font-semibold text-[#0f3b2e]"
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
                    className="h-[48px] flex-1 rounded-xl bg-[#e8decc] font-semibold text-[#0f3b2e] shadow-md transition active:scale-[1.02] md:hover:scale-[1.02]"
                  >
                    Weiter →
                  </button>

                  <button
                    onClick={() => {
                      setRadiusOpen(false);
                      setCoords(null);
                    }}
                    className="h-[48px] rounded-xl border border-white/20 bg-white/10 px-4 text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => router.push("/discover")}
              className="jt-active-gradient h-[56px] w-full rounded-2xl text-lg font-semibold transition active:scale-[1.03] md:hover:scale-[1.03]"
            >
              Ohne Stadt entdecken
            </button>
          </div>

          <div className="mb-4 flex items-center justify-between gap-3 px-1">
            <h2 className="text-[19px] font-extrabold text-white">Wähle deine Stadt</h2>
            <span className="text-sm text-white/45">{cities.length} Städte</span>
          </div>

          <div className="grid gap-3">
            {cities.map((city) => (
              <button
                key={city.slug}
                type="button"
                onClick={() => router.push(`/city/${city.slug}`)}
                className="flex w-full items-center justify-between rounded-[28px] border border-white/10 bg-white/5 px-5 py-4 text-left shadow-[0_10px_30px_rgba(5,18,14,0.16)] transition active:scale-[0.99] md:hover:bg-white/[0.07]"
              >
                <div className="min-w-0">
                  <div className="truncate text-[18px] font-extrabold text-white">
                    {city.name}
                  </div>
                  <div className="mt-1 text-sm text-white/50">{city.spotCount} Spots</div>
                </div>
                <span className="ml-4 shrink-0 text-xl text-white/35" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </div>
        </section>

        {errorMsg ? <div className="mt-4 text-sm text-red-400">{errorMsg}</div> : null}
      </div>
    </main>
  );
}
