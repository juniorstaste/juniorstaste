"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import TopRightMenu from "@/components/TopRightMenu";
import SaveSpotButton from "@/components/SaveSpotButton";
import ShareSpotButton from "@/components/ShareSpotButton";
import DeliveryButtons from "@/components/DeliveryButtons";
import { useRouter } from "next/navigation";
import { trackAndOpenExternalLink } from "@/lib/externalClickTracking";
import { logSupabaseError } from "@/lib/logSupabaseError";
import { prioritizeSpots } from "@/lib/prioritySpot";
import { LAST_CITY_FALLBACK_SLUG, LAST_CITY_SLUG_KEY } from "@/lib/lastCityNavigation";

const TASTE_DES_MONATS_IDS = [
  "0f63bbc8-7050-4406-b512-3e133965a1e4",
  "4eb57f03-101e-4d80-98cc-42d3f148b57a",
];

type Spot = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  image_url: string | null;
  city_id?: string | null;
  city_name?: string | null;
  city_slug?: string | null;
  tiktok_embed_id?: string | null;
  google_maps_link?: string | null;
  wolt_url?: string | null;
  lieferando_url?: string | null;
  uber_eats_url?: string | null;
  city?: {
    name?: string | null;
    slug?: string | null;
  } | null;
};

type CityOption = {
  id: string;
  name: string;
  slug: string;
};

type SavedViewMode = "saved" | "likes";

function SpotCard({ spot, onOpenSpot }: { spot: Spot; onOpenSpot: (spotId: string) => void }) {
  const wolt = spot.wolt_url ?? null;
  const lieferando = spot.lieferando_url ?? null;
  const uberEats = spot.uber_eats_url ?? null;

  return (
    <div
      key={spot.id}
      onClick={() => onOpenSpot(spot.id)}
      className="relative cursor-pointer rounded-2xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-3 shadow-sm transition-all duration-300 hover:shadow-lg"
    >
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <ShareSpotButton spotId={spot.id} spotName={spot.name} variant="list" />
          <SaveSpotButton spotId={spot.id} variant="list" />
        </div>
        {spot.google_maps_link ? (
          <a
            href={spot.google_maps_link}
            target="_blank"
            rel="noreferrer"
            onClick={(event) =>
              void trackAndOpenExternalLink({
                event,
                url: spot.google_maps_link!,
                spotId: spot.id,
                buttonType: "maps",
              })
            }
            className="inline-flex items-center justify-center"
            aria-label="Google Maps öffnen"
            title="Google Maps öffnen"
          >
            <img src="/icons/google-maps.svg" alt="Google Maps" className="h-6 w-6" />
          </a>
        ) : null}
      </div>

      <div className="min-w-0 flex gap-3">
        {spot.image_url ? (
          <img
            src={spot.image_url}
            alt={spot.name}
            className="h-16 w-16 rounded-xl object-cover ring-1 ring-black/5"
          />
        ) : (
          <div className="h-16 w-16 rounded-xl bg-[#f3ecdf] ring-1 ring-black/5" />
        )}

        <div className="min-w-0 flex-1 pr-14">
          <h2 className="truncate text-sm font-extrabold text-[#1f1f1f]">{spot.name}</h2>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5a5348]">
            {spot.city_name ? <span className="font-medium">{spot.city_name}</span> : null}
          </div>

          {spot.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-[#2f2a23]">{spot.description}</p>
          ) : null}

          {spot.address ? (
            <p className="mt-1 break-words text-xs text-[#6b6256]">{spot.address}</p>
          ) : null}
        </div>
      </div>

      <div className="ml-[76px] mt-3 flex flex-wrap gap-2">
        <DeliveryButtons
          spotId={spot.id}
          woltUrl={wolt}
          lieferandoUrl={lieferando}
          uberEatsUrl={uberEats}
        />
      </div>
    </div>
  );
}

export default function SavedPage() {
  const [savedSpots, setSavedSpots] = useState<Spot[]>([]);
  const [likedSpots, setLikedSpots] = useState<Spot[]>([]);
  const [tasteDesMonatsSpots, setTasteDesMonatsSpots] = useState<Spot[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [loadingLikes, setLoadingLikes] = useState(true);
  const [selectedCitySlug, setSelectedCitySlug] = useState<string>(LAST_CITY_FALLBACK_SLUG);
  const [cityMenuOpen, setCityMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<SavedViewMode>("saved");
  const router = useRouter();
  const { authLoading, user, savedSpotIds, openAuthPrompt } = useAuth();

  useEffect(() => {
    async function loadTasteDesMonatsSpots() {
      const { data, error } = await supabase
        .from("spots_with_city")
        .select(
          "id, name, description, address, image_url, city_id, city_name, city_slug, tiktok_embed_id, google_maps_link, wolt_url, lieferando_url, uber_eats_url"
        )
        .in("id", TASTE_DES_MONATS_IDS);

      if (error) {
        logSupabaseError("Konnte Taste-des-Monats-Spots nicht laden:", error);
        setTasteDesMonatsSpots([]);
        return;
      }

      const ordered =
        ((data ?? []) as Spot[]).sort(
          (a, b) => TASTE_DES_MONATS_IDS.indexOf(a.id) - TASTE_DES_MONATS_IDS.indexOf(b.id)
        ) ?? [];

      setTasteDesMonatsSpots(prioritizeSpots(ordered));
    }

    void loadTasteDesMonatsSpots();
  }, []);

  useEffect(() => {
    async function loadCities() {
      const { data, error } = await supabase.from("cities").select("id, name, slug").order("name");

      if (error) {
        logSupabaseError("Konnte Städte für Saved nicht laden:", error);
        setCities([]);
        return;
      }

      const nextCities = ((data ?? []) as CityOption[]).filter(
        (city) => typeof city.slug === "string" && city.slug.length > 0
      );

      setCities(nextCities);

      const storedCitySlug =
        typeof window !== "undefined"
          ? window.localStorage.getItem(LAST_CITY_SLUG_KEY) ?? LAST_CITY_FALLBACK_SLUG
          : LAST_CITY_FALLBACK_SLUG;

      const fallbackCitySlug =
        nextCities.find((city) => city.slug === storedCitySlug)?.slug ??
        nextCities.find((city) => city.slug === LAST_CITY_FALLBACK_SLUG)?.slug ??
        nextCities[0]?.slug ??
        LAST_CITY_FALLBACK_SLUG;

      setSelectedCitySlug(fallbackCitySlug);
    }

    void loadCities();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedCitySlug) return;
    window.localStorage.setItem(LAST_CITY_SLUG_KEY, selectedCitySlug);
  }, [selectedCitySlug]);

  useEffect(() => {
    async function loadSavedSpots() {
      if (!user) {
        setSavedSpots([]);
        setLoadingSaved(false);
        return;
      }

      const { data: savedRows, error: savedError } = await supabase
        .from("saved_spots")
        .select("spot_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (savedError) {
        logSupabaseError("Konnte saved_spots nicht laden:", savedError);
        setSavedSpots([]);
        setLoadingSaved(false);
        return;
      }

      const savedIds = (savedRows ?? []).map((row: { spot_id: string }) => row.spot_id);

      if (savedIds.length === 0) {
        setSavedSpots([]);
        setLoadingSaved(false);
        return;
      }

      setLoadingSaved(true);

      const { data, error } = await supabase
        .from("spots")
        .select(
          "id, name, description, address, image_url, city_id, tiktok_embed_id, google_maps_link, wolt_url, lieferando_url, uber_eats_url"
        )
        .in("id", savedIds);

      if (error) {
        logSupabaseError("Konnte Spot-Daten für gespeicherte Spots nicht laden:", error);
        setSavedSpots([]);
        setLoadingSaved(false);
        return;
      }

      const normalizedData = await enrichSpotsWithCity((data ?? []) as Spot[]);
      const ordered = savedIds
        .map((id) => normalizedData.find((spot) => spot.id === id))
        .filter(Boolean) as Spot[];

      setSavedSpots(prioritizeSpots(ordered));
      setLoadingSaved(false);
    }

    void loadSavedSpots();
  }, [savedSpotIds, user]);

  useEffect(() => {
    async function loadLikedSpots() {
      if (!user) {
        setLikedSpots([]);
        setLoadingLikes(false);
        return;
      }

      setLoadingLikes(true);

      const { data: likedRows, error: likedError } = await supabase
        .from("spot_likes")
        .select("spot_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (likedError) {
        logSupabaseError("Konnte spot_likes nicht laden:", likedError);
        setLikedSpots([]);
        setLoadingLikes(false);
        return;
      }

      const likedIds = (likedRows ?? []).map((row: { spot_id: string }) => row.spot_id);

      if (likedIds.length === 0) {
        setLikedSpots([]);
        setLoadingLikes(false);
        return;
      }

      const { data, error } = await supabase
        .from("spots")
        .select(
          "id, name, description, address, image_url, city_id, tiktok_embed_id, google_maps_link, wolt_url, lieferando_url, uber_eats_url"
        )
        .in("id", likedIds);

      if (error) {
        logSupabaseError("Konnte Spot-Daten für Likes nicht laden:", error);
        setLikedSpots([]);
        setLoadingLikes(false);
        return;
      }

      const normalizedData = await enrichSpotsWithCity((data ?? []) as Spot[]);
      const ordered = likedIds
        .map((id) => normalizedData.find((spot) => spot.id === id))
        .filter(Boolean) as Spot[];

      setLikedSpots(prioritizeSpots(ordered));
      setLoadingLikes(false);
    }

    void loadLikedSpots();
  }, [user]);

  async function enrichSpotsWithCity(baseSpots: Spot[]) {
    const cityIds = Array.from(
      new Set(
        baseSpots
          .map((spot) => spot.city_id)
          .filter((cityId): cityId is string => typeof cityId === "string" && cityId.length > 0)
      )
    );

    let cityMap = new Map<string, { name: string | null; slug: string | null }>();

    if (cityIds.length > 0) {
      const { data: cityRows, error: cityError } = await supabase
        .from("cities")
        .select("id, name, slug")
        .in("id", cityIds);

      if (cityError) {
        logSupabaseError("Konnte Stadt-Daten für Saved-Spots nicht laden:", cityError);
      } else {
        cityMap = new Map(
          (cityRows ?? []).map((city: { id: string; name: string | null; slug: string | null }) => [
            city.id,
            { name: city.name, slug: city.slug },
          ])
        );
      }
    }

    return baseSpots.map((spot) => ({
      ...spot,
      city_name: spot.city_id ? (cityMap.get(spot.city_id)?.name ?? null) : null,
      city_slug: spot.city_id ? (cityMap.get(spot.city_id)?.slug ?? null) : null,
    }));
  }

  const selectedCity = useMemo(
    () =>
      cities.find((city) => city.slug === selectedCitySlug) ??
      cities.find((city) => city.slug === LAST_CITY_FALLBACK_SLUG) ??
      cities[0] ??
      null,
    [cities, selectedCitySlug]
  );

  const filteredSavedSpots = useMemo(
    () =>
      prioritizeSpots(
        savedSpots.filter((spot) => !selectedCitySlug || spot.city_slug === selectedCitySlug)
      ),
    [savedSpots, selectedCitySlug]
  );

  const filteredLikedSpots = useMemo(
    () =>
      prioritizeSpots(
        likedSpots.filter((spot) => !selectedCitySlug || spot.city_slug === selectedCitySlug)
      ),
    [likedSpots, selectedCitySlug]
  );

  const visibleSpots = viewMode === "saved" ? filteredSavedSpots : filteredLikedSpots;
  const isCurrentViewLoading = viewMode === "saved" ? loadingSaved : loadingLikes;

  return (
    <main className="min-h-screen bg-[#0f3b2e]">
      <div className="mx-auto max-w-[560px] p-4 pb-28">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center justify-start transition active:scale-[1.03]"
            aria-label="Zur Startseite"
          >
            <img
              src="/logos/citypage-logo.png"
              alt="Junior's Taste"
              className="h-auto w-[148px]"
            />
          </button>

          <TopRightMenu />
        </div>

        {tasteDesMonatsSpots.length > 0 ? (
          <section className="mb-6">
            <h2 className="jt-text-gradient text-[30px] font-extrabold italic leading-none tracking-wide">
              Taste des Monats
            </h2>
            <p className="mt-2 text-sm font-medium text-white/60">
              Diese Spots feiere ich diesen Monat besonders.
            </p>

            <div className="no-scrollbar -mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-1">
              {tasteDesMonatsSpots.map((spot) => (
                <button
                  key={spot.id}
                  type="button"
                  onClick={() => router.push(`/spot/${spot.id}`)}
                  className="w-[320px] shrink-0 rounded-2xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-3 text-left shadow-sm transition-all duration-300 hover:shadow-lg"
                >
                  <div className="min-w-0 flex gap-3">
                    {spot.image_url ? (
                      <img
                        src={spot.image_url}
                        alt={spot.name}
                        className="h-16 w-16 rounded-xl object-cover ring-1 ring-black/5"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-xl bg-[#f3ecdf] ring-1 ring-black/5" />
                    )}

                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-extrabold text-[#1f1f1f]">
                        {spot.name}
                      </h2>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5a5348]">
                        {spot.city_name ? <span className="font-medium">{spot.city_name}</span> : null}
                      </div>

                      {spot.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-[#2f2a23]">
                          {spot.description}
                        </p>
                      ) : null}

                      {spot.address ? (
                        <p className="mt-1 line-clamp-1 break-words text-xs text-[#6b6256]">
                          {spot.address}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mb-5 text-left">
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => setCityMenuOpen((current) => !current)}
              className="inline-flex items-center gap-2 text-[30px] font-extrabold italic leading-none tracking-wide text-white"
              aria-haspopup="listbox"
              aria-expanded={cityMenuOpen}
            >
              <span>{selectedCity?.name ?? "Stuttgart"}</span>
              <span
                aria-hidden="true"
                className={`mt-1 text-base text-white/70 transition-transform duration-200 ${
                  cityMenuOpen ? "rotate-180" : ""
                }`}
              >
                ▼
              </span>
            </button>

            {cityMenuOpen ? (
              <div className="absolute left-0 top-full z-20 mt-3 w-[220px] rounded-2xl border border-white/10 bg-[#e8decc] p-2 text-[#0f3b2e] shadow-2xl">
                <div className="no-scrollbar max-h-[280px] overflow-y-auto">
                  {cities.map((city) => (
                    <button
                      key={city.slug}
                      type="button"
                      onClick={() => {
                        setSelectedCitySlug(city.slug);
                        setCityMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                        city.slug === selectedCitySlug ? "bg-white/65" : "hover:bg-white/40"
                      }`}
                    >
                      <span>{city.name}</span>
                      {city.slug === selectedCitySlug ? <span aria-hidden="true">✓</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex justify-center">
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 p-1 shadow-sm backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setViewMode("saved")}
                className={`min-w-[136px] rounded-full px-5 py-2 text-sm font-semibold transition ${
                  viewMode === "saved" ? "jt-active-gradient" : "text-white/80"
                }`}
              >
                Gespeichert
              </button>
              <button
                type="button"
                onClick={() => setViewMode("likes")}
                className={`min-w-[136px] rounded-full px-5 py-2 text-sm font-semibold transition ${
                  viewMode === "likes" ? "jt-active-gradient" : "text-white/80"
                }`}
              >
                Likes
              </button>
            </div>
          </div>
        </div>

        {authLoading ? (
          <p className="text-white/80">Prüfe Login…</p>
        ) : !user ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
            <div className="mb-2 font-semibold">Bitte melde dich an</div>
            <p className="text-sm text-white/80">
              Melde dich an oder erstelle ein Konto, um deine gespeicherten Spots und Likes zu
              sehen.
            </p>

            <button
              type="button"
              onClick={() => openAuthPrompt({ type: "open-saved" })}
              className="mt-4 rounded-2xl bg-[#e8decc] px-4 py-3 font-semibold text-[#0f3b2e]"
            >
              Einloggen / Konto erstellen
            </button>
          </div>
        ) : isCurrentViewLoading ? (
          <p className="text-white/80">
            {viewMode === "saved" ? "Lade gespeicherte Spots…" : "Lade gelikte Spots…"}
          </p>
        ) : viewMode === "saved" && savedSpots.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
            <div className="mb-2 font-semibold">Noch nichts gespeichert</div>
            <p className="text-sm text-white/80">
              Speichere Spots über das Bookmark auf der Detailseite oder in der Listenansicht,
              dann erscheinen sie hier.
            </p>
          </div>
        ) : viewMode === "likes" && likedSpots.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
            <div className="mb-2 font-semibold">Noch keine gelikten Spots.</div>
            <p className="text-sm text-white/80">
              Like Spots im For-You-Feed, dann erscheinen sie hier.
            </p>
          </div>
        ) : visibleSpots.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
            <div className="mb-2 font-semibold">Keine Spots in dieser Stadt</div>
            <p className="text-sm text-white/80">
              Für {selectedCity?.name ?? "diese Stadt"} gibt es in dieser Ansicht aktuell keine
              Spots.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {visibleSpots.map((spot) => (
              <SpotCard key={spot.id} spot={spot} onOpenSpot={(spotId) => router.push(`/spot/${spotId}`)} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
