"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { BookmarkSimple, ChatCircle, Heart, PaperPlaneTilt } from "@phosphor-icons/react";
import DistanceLabel from "@/components/DistanceLabel";
import BottomTabs from "@/components/BottomTabs";
import TopRightMenu from "@/components/TopRightMenu";
import SaveSpotButton from "@/components/SaveSpotButton";
import ShareSpotButton from "@/components/ShareSpotButton";
import DeliveryButtons from "@/components/DeliveryButtons";
import { useAuth } from "@/components/AuthProvider";
import SpotCommentsSheet from "@/components/SpotCommentsSheet";
import { trackAndOpenExternalLink } from "@/lib/externalClickTracking";
import {
  getColorForCategory,
  labelFromCategorySlug,
} from "@/lib/cityMapCategories";
import {
  buildCityViewHref,
  isCityTabView,
  LAST_CITY_SLUG_KEY,
  LAST_CITY_VIEW_KEY,
} from "@/lib/lastCityNavigation";
import { prioritizeSpots } from "@/lib/prioritySpot";
import { getPriceLevelValue } from "@/lib/priceLevel";

const CityMap = dynamic(() => import("@/components/CityMap"), { ssr: false });

type Spot = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  city_id?: string | null;
  category_id?: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  tiktok_embed_id: string | null;
  tiktok_url?: string | null;
  video_url?: string | null;
  tiktok_like_count?: number | null;
  google_maps_link: string | null;

  rating: number | null;
  price_level: number | null;

  city_name?: string | null;
  city_slug?: string | null;

  category_slug?: string | null;
  category_name?: string | null;

  created_at?: string | null;

  wolt_url?: string | null;
  lieferando_url?: string | null;
  uber_eats_url?: string | null;
};

type City = { id: string; name: string; slug: string };
type ViewMode = "list" | "map" | "tasteDesMonats";

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

function hasDeliveryOption(spot: Spot) {
  return Boolean(
    spot.wolt_url ||
      spot.lieferando_url ||
      spot.uber_eats_url
  );
}

const TASTE_DES_MONATS_IDS = [
  "0f63bbc8-7050-4406-b512-3e133965a1e4",
  "4eb57f03-101e-4d80-98cc-42d3f148b57a",
];

function normalizeCategoryKey(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[/_-]+/g, " ")
    .replace(/&/g, " ")
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getCategoryEmoji(slug?: string | null, name?: string | null) {
  const key = normalizeCategoryKey(slug) || normalizeCategoryKey(name);

  if (!key || key === "all" || key === "alle") return "✨";
  if (key.includes("asian") || key.includes("asia") || key.includes("sushi")) return "🍣";
  if (key.includes("burger")) return "🍔";
  if (
    key.includes("doener") ||
    key.includes("doner") ||
    key.includes("doener") ||
    key.includes("kebab")
  ) {
    return "🥙";
  }
  if (
    key.includes("fried chicken") ||
    key.includes("chicken") ||
    key.includes("haehnchen") ||
    key.includes("hahnchen")
  ) {
    return "🍗";
  }
  if (
    key.includes("kaffee") ||
    key.includes("fruehstueck") ||
    key.includes("dessert") ||
    key.includes("coffee") ||
    key.includes("breakfast")
  ) {
    return "☕";
  }
  if (key.includes("pizza")) return "🍕";
  if (key.includes("sandwich")) return "🥪";
  if (
    key.includes("tacos burritos") ||
    key.includes("tacos") ||
    key.includes("burritos") ||
    key.includes("mexican")
  ) {
    return "🌮";
  }

  return null;
}

function getCategorySortOrder(slug?: string | null, name?: string | null) {
  const key = normalizeCategoryKey(slug) || normalizeCategoryKey(name);

  if (key.includes("burger")) return 1;
  if (key.includes("fried chicken") || key.includes("chicken") || key.includes("haehnchen") || key.includes("hahnchen")) return 2;
  if (key.includes("doener") || key.includes("doner") || key.includes("kebab")) return 3;
  if (
    key.includes("kaffee") ||
    key.includes("fruehstueck") ||
    key.includes("dessert") ||
    key.includes("coffee") ||
    key.includes("breakfast")
  ) {
    return 4;
  }
  if (key.includes("pizza")) return 5;
  if (key.includes("asian") || key.includes("asia") || key.includes("sushi")) return 6;
  if (key.includes("tacos burritos") || key.includes("tacos") || key.includes("burritos") || key.includes("mexican")) return 7;
  if (key.includes("orientalisch") || key.includes("oriental")) return 8;

  return 99;
}

function VideoSpotCard({
  spot,
  distanceKm,
  isLiked,
  onToggleLike,
  onOpenComments,
  onOpenSpot,
}: {
  spot: Spot;
  distanceKm?: number;
  isLiked: boolean;
  onToggleLike: (spotId: string) => Promise<boolean>;
  onOpenComments: (spot: Spot) => void;
  onOpenSpot: (spotId: string) => void;
}) {
  const { isSavedSpot, toggleSavedSpot } = useAuth();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSpeedHolding, setIsSpeedHolding] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [likePopping, setLikePopping] = useState(false);
  const [savePopping, setSavePopping] = useState(false);
  const holdTimeoutRef = useRef<number | null>(null);
  const suppressTapRef = useRef(false);
  const saved = isSavedSpot(spot.id);
  const videoUrl = spot.video_url?.trim() ?? "";
  const hasDeliveryOptions = Boolean(spot.wolt_url || spot.lieferando_url || spot.uber_eats_url);
  const gradientId = `city-video-card-gradient-${spot.id}`;
  const HOLD_THRESHOLD_MS = 220;
  const HOLD_SPEED_ZONE_START = 0.8;

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setIsVisible(entry.isIntersecting && entry.intersectionRatio >= 0.6);
      },
      { threshold: [0.25, 0.6, 0.9] }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isVisible) {
      video.pause();
      video.currentTime = 0;
      video.playbackRate = 1;
      queueMicrotask(() => {
        setIsPaused(false);
        setIsSpeedHolding(false);
      });
      return;
    }

    video.muted = isMuted;
    void video.play().catch(() => {
      // Mobile autoplay can still be blocked in some edge cases.
    });
  }, [isMuted, isVisible]);

  function clearHoldTimeout() {
    if (holdTimeoutRef.current == null) return;
    window.clearTimeout(holdTimeoutRef.current);
    holdTimeoutRef.current = null;
  }

  function resetPlaybackRate() {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = 1;
    setIsSpeedHolding(false);
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        await video.play();
        setIsPaused(false);
      } catch (error) {
        console.error("CityPage-Video konnte nicht fortgesetzt werden:", error);
      }
      return;
    }

    video.pause();
    setIsPaused(true);
  }

  function handleVideoPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    clearHoldTimeout();
    suppressTapRef.current = false;

    const rect = event.currentTarget.getBoundingClientRect();
    const isRightEdgeZone = event.clientX > rect.left + rect.width * HOLD_SPEED_ZONE_START;
    if (!isRightEdgeZone) return;

    event.preventDefault();

    holdTimeoutRef.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = 1.75;
      setIsSpeedHolding(true);
      suppressTapRef.current = true;
    }, HOLD_THRESHOLD_MS);
  }

  async function handleVideoPointerUp() {
    const shouldSuppressTap = suppressTapRef.current;
    clearHoldTimeout();
    if (isSpeedHolding) {
      suppressTapRef.current = true;
    }
    resetPlaybackRate();

    if (shouldSuppressTap) {
      window.setTimeout(() => {
        suppressTapRef.current = false;
      }, 0);
      return;
    }

    await togglePlayback();
  }

  function handleVideoPointerCancel() {
    clearHoldTimeout();
    if (isSpeedHolding) {
      suppressTapRef.current = true;
    }
    resetPlaybackRate();
  }

  function handleToggleMuted(event: React.SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();

    const video = videoRef.current;
    const nextMuted = !isMuted;

    setIsMuted(nextMuted);
    if (video) video.muted = nextMuted;
  }

  async function handleLike(event: React.SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();

    const likedAfterToggle = await onToggleLike(spot.id);
    if (!likedAfterToggle) return;

    setLikePopping(false);
    requestAnimationFrame(() => {
      setLikePopping(true);
      window.setTimeout(() => setLikePopping(false), 280);
    });
  }

  async function handleSave(event: React.SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();

    const wasSaved = saved;
    const changed = await toggleSavedSpot(spot.id);

    if (!changed || wasSaved) return;

    setSavePopping(false);
    requestAnimationFrame(() => {
      setSavePopping(true);
      window.setTimeout(() => setSavePopping(false), 280);
    });
  }

  async function handleShare(event: React.SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (typeof window === "undefined") return;

    const url = `${window.location.origin}/spot/${spot.id}`;
    const shareData = {
      title: spot.name,
      text: `Schau dir ${spot.name} bei Junior's Taste an.`,
      url,
    };

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        if (typeof navigator.canShare !== "function" || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        return;
      }

      window.prompt("Link kopieren:", url);
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      console.error("Teilen fehlgeschlagen:", error);
    }
  }

  return (
    <div
      ref={cardRef}
      className="relative min-h-[34rem] cursor-pointer overflow-hidden rounded-[28px] border border-white/10 bg-[#0f3b2e] shadow-[0_20px_45px_rgba(0,0,0,0.22)] select-none touch-manipulation [-webkit-touch-callout:none] [-webkit-user-select:none]"
    >
      <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff7c90" />
            <stop offset="100%" stopColor="#ffe1a4" />
          </linearGradient>
        </defs>
      </svg>

      <video
        ref={videoRef}
        src={videoUrl}
        muted
        loop
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-cover"
        onPause={() => setIsPaused(true)}
        onPlay={() => setIsPaused(false)}
      />

      <button
        type="button"
        aria-label={isPaused ? "Video abspielen" : "Video pausieren"}
        className="absolute inset-0 z-[1] block touch-manipulation select-none [-webkit-touch-callout:none] [-webkit-user-select:none]"
        onPointerDown={handleVideoPointerDown}
        onPointerUp={(event) => {
          event.preventDefault();
          void handleVideoPointerUp();
        }}
        onPointerCancel={handleVideoPointerCancel}
        onPointerLeave={handleVideoPointerCancel}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/10 to-black/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/35 to-transparent" />

      {isSpeedHolding ? (
        <div className="pointer-events-none absolute right-6 top-5 z-20">
          <div className="flex h-9 w-11 items-center justify-center rounded-full border border-white/20 bg-[linear-gradient(135deg,rgba(255,124,144,0.42),rgba(255,225,164,0.32))] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.24)]">
            <span className="flex h-full w-full items-center justify-center text-[11px] font-medium leading-none tracking-[-0.01em] text-white/88">
              1.75x
            </span>
          </div>
        </div>
      ) : null}

      {isPaused ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="animate-[jt-play-icon-in_220ms_ease-out] text-white/88"
          >
            <path
              d="M8 6.5v11l9-5.5-9-5.5Z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      ) : null}

      <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-4 pt-4">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpenSpot(spot.id);
          }}
          className="flex min-w-0 items-start gap-3 text-left"
        >
          {spot.image_url ? (
            <img
              src={spot.image_url}
              alt={spot.name}
              className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-white/20"
            />
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-2xl bg-white/10 ring-1 ring-white/20" />
          )}

          <div className="min-w-0 pt-1 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
            {spot.city_name ? (
              <p className="line-clamp-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">
                {spot.city_name}
              </p>
            ) : null}

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/90">
              {typeof spot.rating === "number" ? (
                <span className="jt-text-gradient inline-flex items-center gap-1">
                  <span>★</span>
                  <span className="font-semibold">{spot.rating.toFixed(1)}</span>
                </span>
              ) : null}

              {typeof spot.price_level === "number" ? (
                <span
                  className="inline-flex items-center gap-0.5 font-semibold text-white"
                  aria-label={`Preisniveau ${getPriceLevelValue(spot.price_level, 4)} von 4`}
                >
                  {Array.from({ length: 4 }, (_, index) => (
                    <span
                      key={index}
                      className={
                        index < getPriceLevelValue(spot.price_level, 4)
                          ? "text-white"
                          : "text-white/30"
                      }
                    >
                      €
                    </span>
                  ))}
                </span>
              ) : null}

              {typeof distanceKm === "number" ? (
                <span className="text-white/80">{distanceKm.toFixed(1).replace(".", ",")} km</span>
              ) : null}
            </div>
          </div>
        </button>
      </div>

      <div className="absolute right-3 top-[74%] z-20 flex -translate-y-1/2 flex-col items-center gap-4 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
        <button
          type="button"
          aria-label={isLiked ? "Like entfernen" : "Like setzen"}
          className={`inline-flex h-10 w-10 items-center justify-center transition-transform duration-200 ${
            likePopping ? "save-bounce" : ""
          }`}
          onClick={(event) => {
            void handleLike(event);
          }}
        >
          <Heart
            size={26}
            weight="fill"
            aria-hidden="true"
            className={isLiked ? "" : "text-white"}
            style={isLiked ? { fill: `url(#${gradientId})` } : undefined}
          />
        </button>

        <button
          type="button"
          aria-label="Kommentare"
          className="inline-flex h-10 w-10 items-center justify-center text-white"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpenComments(spot);
          }}
        >
          <ChatCircle size={26} weight="fill" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label={saved ? "Spot aus Favoriten entfernen" : "Spot speichern"}
          className={`inline-flex h-10 w-10 items-center justify-center text-white transition-transform duration-200 ${
            savePopping ? "save-bounce" : ""
          }`}
          onClick={(event) => {
            void handleSave(event);
          }}
        >
          <BookmarkSimple
            size={26}
            weight="fill"
            aria-hidden="true"
            className={saved ? "" : "text-white"}
            style={saved ? { fill: `url(#${gradientId})` } : undefined}
          />
        </button>

        <button
          type="button"
          aria-label="Teilen"
          className="inline-flex h-10 w-10 items-center justify-center text-white"
          onClick={(event) => {
            void handleShare(event);
          }}
        >
          <PaperPlaneTilt size={26} weight="fill" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label={isMuted ? "Ton einschalten" : "Ton ausschalten"}
          className="inline-flex h-10 w-10 items-center justify-center text-white"
          onClick={handleToggleMuted}
        >
          {isMuted ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 10h4l5-4v12l-5-4H5v-4Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="m18 9 3 3m0-3-3 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 10h4l5-4v12l-5-4H5v-4Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M18 9a4 4 0 0 1 0 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-4">
        <div className="max-w-[calc(100%-4.5rem)] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenSpot(spot.id);
            }}
            className="line-clamp-2 text-left text-[22px] font-extrabold leading-tight text-white"
          >
            {spot.name}
          </button>

          {spot.description ? (
            <p className="mt-2 line-clamp-3 text-sm font-medium leading-snug text-white/88">
              {spot.description}
            </p>
          ) : null}

          {spot.address ? (
            <p className="mt-2 line-clamp-2 text-sm leading-snug text-white/82">{spot.address}</p>
          ) : null}

          {hasDeliveryOptions ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <DeliveryButtons
                spotId={spot.id}
                woltUrl={spot.wolt_url ?? null}
                lieferandoUrl={spot.lieferando_url ?? null}
                uberEatsUrl={spot.uber_eats_url ?? null}
                buttonClassName="flex h-9 min-w-[92px] items-center justify-center rounded-2xl bg-[#e8decc] px-3 py-2 text-[#0f3b2e] shadow-sm transition active:scale-95"
              />
            </div>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        .save-bounce {
          animation: savePop 280ms ease-out;
        }

        @keyframes savePop {
          0% {
            transform: scale(1);
          }
          35% {
            transform: scale(1.18);
          }
          65% {
            transform: scale(0.94);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes jt-play-icon-in {
          0% {
            opacity: 0;
            transform: scale(0.88);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

export default function CityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ slug?: string | string[] }>();
  const { user, profile, openAuthPrompt } = useAuth();

  const citySlug = useMemo(() => {
    const raw = params?.slug;
    if (!raw) return null;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const initialView = useMemo<ViewMode>(() => {
    const requestedView = searchParams.get("view");
    return isCityTabView(requestedView) ? requestedView : "list";
  }, [searchParams]);

  const [spots, setSpots] = useState<Spot[]>([]);
  const [tasteDesMonatsSpots, setTasteDesMonatsSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [cities, setCities] = useState<City[]>([]);
  const [citySelectValue, setCitySelectValue] = useState<string>(() => citySlug ?? "");

  const [category, setCategory] = useState<string>("all");
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);

  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>(initialView);
  const [sort, setSort] = useState<"newest" | "rating" | "price" | "distance">("newest");
  const [deliveryFilter, setDeliveryFilter] = useState<"all" | "with">("all");

  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(30);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isRadiusFilterOpen, setIsRadiusFilterOpen] = useState(false);

  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);
  const [likedVideoSpotIds, setLikedVideoSpotIds] = useState<Record<string, boolean>>({});
  const [selectedMapLegendSlug, setSelectedMapLegendSlug] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [commentSpot, setCommentSpot] = useState<Spot | null>(null);
  const legendListRef = useRef<HTMLDivElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const mapLocationRequestedRef = useRef(false);

  const chipButtonBase =
    "shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10 p-1 text-sm font-semibold shadow-sm transition-all duration-150 active:scale-[1.03]";
  const chipInnerBase =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold transition-all duration-150";
  const insetFilterShellBase =
    "rounded-full border border-white/10 bg-white/10 p-1 shadow-sm transition-all duration-150";
  const insetFilterInnerBase =
    "w-full appearance-none rounded-full px-4 py-2 text-center text-sm font-semibold text-white transition-all duration-150 focus:outline-none";

  useEffect(() => {
    if (typeof window === "undefined" || !citySlug) return;
    window.localStorage.setItem(LAST_CITY_SLUG_KEY, citySlug);
    window.localStorage.setItem(LAST_CITY_VIEW_KEY, view);
  }, [citySlug, view]);

  useEffect(() => {
    if (!isFilterMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!filterMenuRef.current) return;
      if (filterMenuRef.current.contains(event.target as Node)) return;
      setIsFilterMenuOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFilterMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isFilterMenuOpen]);

  useEffect(() => {
    async function loadCities() {
      const { data, error } = await supabase
        .from("cities")
        .select("id, name, slug")
        .order("name", { ascending: true });

      if (!error) setCities((data as City[]) ?? []);
    }

    loadCities();
  }, []);

  async function handleCitySelectChange(next: string) {
    setCitySelectValue(next);

    if (next === "__near__") {
      setGeoError(null);

      if (!navigator.geolocation) {
        setGeoError("Dein Browser unterstützt Standort nicht.");
        if (citySlug) setCitySelectValue(citySlug);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          router.push(`/near?lat=${lat}&lng=${lng}&r=30`);
        },
        () => {
          setGeoError("Standort konnte nicht abgerufen werden. Bitte Standort erlauben.");
          if (citySlug) setCitySelectValue(citySlug);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );

      return;
    }

    if (next) router.push(buildCityViewHref(next, view === "map" ? "map" : "list"));
  }

  function requestNearbySpots() {
    setGeoError(null);

    if (!navigator.geolocation) {
      setGeoError("Dein Browser unterstützt Standort nicht.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserPos({ lat, lng });
        setIsRadiusFilterOpen(true);
        setSort("distance");
      },
      () => setGeoError("Standort konnte nicht abgerufen werden. Bitte Standort erlauben."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  useEffect(() => {
    if (!citySlug) return;

    async function loadSpots() {
      setLoading(true);
      setErrorMsg(null);

      const { data: cityData, error: cityError } = await supabase
        .from("cities")
        .select("id, name, slug")
        .eq("slug", citySlug)
        .maybeSingle();

      if (cityError || !cityData) {
        setErrorMsg(cityError?.message ?? "Stadt konnte nicht geladen werden.");
        setSpots([]);
        setLoading(false);
        return;
      }

      let categoryId: string | null = null;

      if (category !== "all") {
        const { data: categoryData, error: categoryError } = await supabase
          .from("categories")
          .select("id, name, slug")
          .eq("slug", category)
          .maybeSingle();

        if (categoryError) {
          setErrorMsg(categoryError.message);
          setSpots([]);
          setLoading(false);
          return;
        }

        if (!categoryData) {
          setSpots([]);
          setLoading(false);
          return;
        }

        categoryId = categoryData.id;
      }

      let query = supabase
        .from("spots")
        .select("*")
        .eq("city_id", cityData.id)
        .order("created_at", { ascending: false });

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      }

      const { data, error } = await query;

      if (error) {
        setErrorMsg(error.message);
        setSpots([]);
        setLoading(false);
        return;
      }
      const baseSpots = (data as Spot[]) ?? [];
      const categoryIds = Array.from(
        new Set(
          baseSpots
            .map((spot) => spot.category_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0)
        )
      );

      let categoryMap = new Map<string, { name: string | null; slug: string | null }>();

      if (categoryIds.length > 0) {
        const { data: categoryRows } = await supabase
          .from("categories")
          .select("id, name, slug")
          .in("id", categoryIds);

        categoryMap = new Map(
          ((categoryRows as { id: string; name: string | null; slug: string | null }[] | null) ?? []).map(
            (row) => [row.id, { name: row.name, slug: row.slug }]
          )
        );
      }

      setSpots(
        baseSpots.map((spot) => {
          const categoryEntry =
            spot.category_id && categoryMap.has(spot.category_id)
              ? categoryMap.get(spot.category_id)
              : null;

          return {
            ...spot,
            city_name: cityData.name,
            city_slug: cityData.slug,
            category_name: categoryEntry?.name ?? spot.category_name ?? null,
            category_slug: categoryEntry?.slug ?? spot.category_slug ?? null,
          };
        })
      );
      setLoading(false);
    }

    loadSpots();
  }, [citySlug, category]);

  useEffect(() => {
    if (!citySlug) return;

    async function loadCategories() {
      const { data: cityData, error: cityError } = await supabase
        .from("cities")
        .select("id")
        .eq("slug", citySlug)
        .maybeSingle();

      if (cityError || !cityData) return;

      const { data: citySpots, error: spotsError } = await supabase
        .from("spots")
        .select("category_id")
        .eq("city_id", cityData.id);

      if (spotsError) return;

      const categoryIds = Array.from(
        new Set(
          ((citySpots as { category_id: string | null }[] | null) ?? [])
            .map((row) => row.category_id)
            .filter((value): value is string => typeof value === "string" && value.length > 0)
        )
      );

      if (categoryIds.length === 0) {
        setCategories([]);
        return;
      }

      const { data, error } = await supabase
        .from("categories")
        .select("slug, name")
        .in("id", categoryIds);

      if (error) return;

      const map = new Map<string, string>();
      ((data as { slug: string | null; name: string | null }[] | null) ?? []).forEach((row) => {
        if (row.slug) map.set(row.slug, row.name ?? row.slug);
      });

      const list = Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setCategories(list);
    }

    loadCategories();
  }, [citySlug]);

  useEffect(() => {
    async function loadTasteDesMonats() {
      const { data, error } = await supabase
        .from("spots_with_city")
        .select("*")
        .in("id", TASTE_DES_MONATS_IDS);

      if (error) return;

      const ordered =
        (data as Spot[] | null)?.sort(
          (a, b) =>
            TASTE_DES_MONATS_IDS.indexOf(a.id) - TASTE_DES_MONATS_IDS.indexOf(b.id)
        ) ?? [];

      setTasteDesMonatsSpots(prioritizeSpots(ordered));
    }

    loadTasteDesMonats();
  }, []);

  const filteredSpots = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = !q
      ? [...spots]
      : spots.filter((s) => {
          const haystack = [s.name, s.description ?? "", s.address ?? ""].join(" ").toLowerCase();
          return haystack.includes(q);
        });

    if (userPos) {
      list = list.filter((s) => {
        if (typeof s.lat !== "number" || typeof s.lng !== "number") return false;
        const d = haversineKm(userPos, { lat: s.lat as number, lng: s.lng as number });
        return d <= radiusKm;
      });
    }

    if (deliveryFilter === "with") {
      list = list.filter((s) => hasDeliveryOption(s));
    }

    if (sort === "rating") {
      list.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    } else if (sort === "price") {
      list.sort((a, b) => (a.price_level ?? 999) - (b.price_level ?? 999));
    } else if (sort === "distance" && userPos) {
      list.sort((a, b) => {
        if (typeof a.lat !== "number" || typeof a.lng !== "number") return 1;
        if (typeof b.lat !== "number" || typeof b.lng !== "number") return -1;
        const da = haversineKm(userPos, { lat: a.lat as number, lng: a.lng as number });
        const db = haversineKm(userPos, { lat: b.lat as number, lng: b.lng as number });
        return da - db;
      });
    } else {
      list.sort((a, b) => {
        const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bd - ad;
      });
    }

    return prioritizeSpots(list);
  }, [spots, search, sort, userPos, radiusKm, deliveryFilter]);

  useEffect(() => {
    let cancelled = false;

    async function loadLikedVideoSpots() {
      const videoSpotIds = filteredSpots
        .filter((spot) => Boolean(spot.video_url?.trim()))
        .map((spot) => spot.id);

      if (!user || videoSpotIds.length === 0) {
        if (!cancelled) {
          setLikedVideoSpotIds({});
        }
        return;
      }

      const activeUser = user;
      const { data, error } = await supabase
        .from("spot_likes")
        .select("spot_id")
        .eq("user_id", activeUser.id)
        .in("spot_id", videoSpotIds);

      if (error) {
        console.error("Konnte Likes fuer CityPage-Video-Spots nicht laden:", error);
        return;
      }

      if (cancelled) return;

      setLikedVideoSpotIds(
        Object.fromEntries(
          ((data as { spot_id: string }[] | null) ?? []).map((row) => [row.spot_id, true])
        )
      );
    }

    void loadLikedVideoSpots();

    return () => {
      cancelled = true;
    };
  }, [filteredSpots, user]);

  async function toggleVideoSpotLike(spotId: string) {
    const alreadyLiked = likedVideoSpotIds[spotId] === true;
    const returnTo = citySlug ? buildCityViewHref(citySlug, "list") : "/";

    if (!user) {
      openAuthPrompt({ type: "like-spot", spotId, returnTo });
      return alreadyLiked;
    }

    const activeUser = user;

    setLikedVideoSpotIds((current) => {
      const next = { ...current };
      if (alreadyLiked) {
        delete next[spotId];
      } else {
        next[spotId] = true;
      }
      return next;
    });

    if (alreadyLiked) {
      const { error } = await supabase
        .from("spot_likes")
        .delete()
        .eq("user_id", activeUser.id)
        .eq("spot_id", spotId);

      if (error) {
        console.error("Konnte Like in der CityPage nicht entfernen:", error);
        setLikedVideoSpotIds((current) => ({ ...current, [spotId]: true }));
        return true;
      }

      return false;
    }

    const { error } = await supabase.from("spot_likes").insert({
      user_id: activeUser.id,
      spot_id: spotId,
    });

    if (error && error.code !== "23505") {
      console.error("Konnte Like in der CityPage nicht speichern:", error);
      setLikedVideoSpotIds((current) => {
        const next = { ...current };
        delete next[spotId];
        return next;
      });
      return false;
    }

    return true;
  }

  function handleVideoCommentIntent(spot: Spot) {
    if (!user) {
      openAuthPrompt();
      return;
    }

    setCommentSpot(spot);
  }

  const distanceById = useMemo(() => {
    const map = new Map<string, number>();
    if (!userPos) return map;

    filteredSpots.forEach((s) => {
      if (typeof s.lat !== "number" || typeof s.lng !== "number") return;
      const d = haversineKm(userPos, { lat: s.lat as number, lng: s.lng as number });
      map.set(s.id, d);
    });

    return map;
  }, [filteredSpots, userPos]);

  const mapSpots = useMemo(() => {
    const categoryFilteredSpots =
      !selectedMapLegendSlug || selectedMapLegendSlug === "all"
        ? filteredSpots
        : filteredSpots.filter((spot) => spot.category_slug === selectedMapLegendSlug);

    return categoryFilteredSpots
      .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
      .map((s) => {
        const wolt = s.wolt_url ?? null;
        const lieferando = s.lieferando_url ?? null;
        const uberEats = s.uber_eats_url ?? null;

        return {
          id: s.id,
          name: s.name,
          lat: s.lat as number,
          lng: s.lng as number,
          image_url: s.image_url ?? null,
          rating: s.rating ?? null,
          price_level: s.price_level ?? null,
          category_slug: (s.category_slug ?? "other").toString().trim().toLowerCase(),
          google_maps_link: s.google_maps_link ?? null,
          wolt_url: wolt,
          lieferando_url: lieferando,
          uber_eats_url: uberEats,
        };
      });
  }, [filteredSpots, selectedMapLegendSlug]);

  const mapCenter = useMemo<[number, number]>(() => {
    const first = mapSpots[0];
    if (first) return [first.lat, first.lng];
    return [52.52, 13.405];
  }, [mapSpots]);

  const legendCategorySpots = useMemo(() => {
    if (!selectedMapLegendSlug) return [];

    const categoryFilteredSpots =
      selectedMapLegendSlug === "all"
        ? [...filteredSpots]
        : filteredSpots.filter((spot) => spot.category_slug === selectedMapLegendSlug);

    return [...prioritizeSpots(categoryFilteredSpots)].sort((a, b) => {
      if (userPos) {
        const aHasCoords = typeof a.lat === "number" && typeof a.lng === "number";
        const bHasCoords = typeof b.lat === "number" && typeof b.lng === "number";

        if (aHasCoords && bHasCoords) {
          const distanceDiff =
            haversineKm(userPos, { lat: a.lat as number, lng: a.lng as number }) -
            haversineKm(userPos, { lat: b.lat as number, lng: b.lng as number });

          if (Math.abs(distanceDiff) > 0.05) return distanceDiff;
        } else if (aHasCoords !== bHasCoords) {
          return aHasCoords ? -1 : 1;
        }

        return (b.rating ?? -1) - (a.rating ?? -1);
      }

      return (b.rating ?? -1) - (a.rating ?? -1);
    });
  }, [filteredSpots, selectedMapLegendSlug, userPos]);

  useEffect(() => {
    if (!selectedMapLegendSlug || !legendListRef.current) return;

    const timeoutId = window.setTimeout(() => {
      legendListRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectedMapLegendSlug, legendCategorySpots.length]);

  useEffect(() => {
    if (view !== "map") return;
    if (userPos) return;
    if (mapLocationRequestedRef.current) return;
    if (typeof window === "undefined" || !navigator.geolocation) return;

    mapLocationRequestedRef.current = true;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        // Ohne Berechtigung oder Standort bleibt die Karte beim bisherigen Verhalten.
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [userPos, view]);

  if (!citySlug) return <main className="p-4">Lade Stadt…</main>;

  const currentCityName =
    cities.find((c) => c.slug === citySelectValue)?.name ??
    citySlug
      ?.split("-")
      .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") ??
    "Stadt";

  function getSelectWidth(label: string, min = 140) {
    return `${Math.max(min, label.length * 9 + 48)}px`;
  }

  const isSearchExpanded = isSearchFocused || search.trim().length > 0;
  const isListView = view === "list";
  const isMapView = view === "map";
  const isTasteDesMonatsView = view === "tasteDesMonats";
  const sharedContentWidthClass = "w-[94%] max-w-[500px]";
  const searchWidthClass = isSearchExpanded ? "w-full" : "w-full";
  const headerTitle = isTasteDesMonatsView ? "Taste des Monats" : "Entdecken";
  const headerSubtitle =
    isTasteDesMonatsView
      ? "Drei Spots, die ich diesen Monat besonders feiere."
      : `JuniorsTaste's Favorites aus ${currentCityName}`;
  const orderedCategories = [...categories].sort((a, b) => {
    const orderDiff =
      getCategorySortOrder(a.slug, a.name) - getCategorySortOrder(b.slug, b.name);

    if (orderDiff !== 0) return orderDiff;

    return a.name.localeCompare(b.name, "de");
  });

  return (
    <main className="mx-auto max-w-[560px] p-4 pb-28">
      <div className="mb-5">
        <div className="relative mb-10 mt-3 h-10">
          {isTasteDesMonatsView ? (
            <button
              type="button"
              onClick={() => router.push("/")}
              className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
              aria-label="Zur Startseite"
            >
              <img
                src="/logos/citypage-logo.png"
                alt="Junior's Taste"
                className="h-auto w-[148px]"
              />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center justify-start"
                aria-label="Zur Startseite"
              >
                <img
                  src="/logos/citypage-logo.png"
                  alt="Junior's Taste"
                  className="h-auto w-[148px]"
                />
              </button>

              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ width: getSelectWidth(currentCityName, 84) }}
              >
                <select
                  value={citySelectValue}
                  onChange={(e) => handleCitySelectChange(e.target.value)}
                  className="w-full appearance-none rounded-full border border-white/10 bg-white/10 bg-gradient-to-r from-[#ff7c90] to-[#ffe1a4] bg-clip-text px-4 py-1.5 text-center text-sm font-semibold text-transparent shadow-sm transition-all duration-150 hover:bg-white/15 active:scale-[1.03] focus:outline-none"
                  style={{ textAlignLast: "center" }}
                >
                  <option value="__near__">📍 In meiner Nähe suchen…</option>
                  <option disabled>──────────</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center">
            <TopRightMenu onOpenChange={setMenuOpen} />
          </div>
        </div>

        {!isMapView ? (
          <div className="mb-4">
            <div className={sharedContentWidthClass}>
              <h1 className="text-[30px] font-extrabold leading-none text-white">{headerTitle}</h1>
              <p className="mt-2 text-sm font-medium text-white/70">
                {headerSubtitle}
              </p>
            </div>
          </div>
        ) : null}

        {isListView && (
          <div className="mb-4">
            <div className="flex flex-col gap-3">
              <div className="relative w-full" ref={filterMenuRef}>
                <div className="relative w-full pr-12">
                  <div
                    className={`min-w-0 transition-all duration-300 ease-out ${searchWidthClass}`}
                  >
                    <div className="relative flex h-10 items-center rounded-full border border-white/10 bg-white/10 px-3 shadow-sm transition-all duration-300 ease-out">
                      <span
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white transition-all duration-300 ease-out"
                        aria-hidden="true"
                      >
                        🔍
                      </span>
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onFocus={() => setIsSearchFocused(true)}
                        onBlur={() => setIsSearchFocused(false)}
                        placeholder="Foodspots, Burrito, Burger ..."
                        className="h-full min-w-0 flex-1 border-0 bg-transparent pl-5 text-sm font-medium text-white placeholder:text-xs placeholder:font-normal placeholder:text-white/35 focus:outline-none"
                      />
                    </div>
                  </div>

                </div>

                <button
                  type="button"
                  onClick={() => setIsFilterMenuOpen((current) => !current)}
                  className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white shadow-sm transition-all duration-150 hover:bg-white/15 active:scale-[1.03] focus:outline-none"
                  aria-label="Filter öffnen"
                  aria-expanded={isFilterMenuOpen}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    className="text-white"
                  >
                    <path
                      d="M4 7h16M7 12h10M10 17h4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>

                {isFilterMenuOpen ? (
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[220px] rounded-[22px] border border-white/10 bg-[#124433]/92 p-3 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                    <div className="flex flex-col gap-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                        Filter
                      </div>

                      <div className={insetFilterShellBase}>
                        <select
                          value={sort}
                          onChange={(e) => {
                            const nextSort = e.target.value as "newest" | "rating" | "price" | "distance";
                            if (nextSort === "distance") {
                              requestNearbySpots();
                              setIsFilterMenuOpen(false);
                              return;
                            }

                            setSort(nextSort);
                            setIsFilterMenuOpen(false);
                          }}
                          className={`${insetFilterInnerBase} jt-active-gradient-soft`}
                          style={{ textAlignLast: "center" }}
                        >
                          <option value="newest">Sortierung: Neueste</option>
                          <option value="rating">Best bewertet</option>
                          <option value="price">Preis</option>
                          <option value="distance">Nähe (GPS)</option>
                        </select>
                      </div>

                      <div className={insetFilterShellBase}>
                        <select
                          value={deliveryFilter}
                          onChange={(e) => {
                            setDeliveryFilter(e.target.value as "all" | "with");
                            setIsFilterMenuOpen(false);
                          }}
                          className={`${insetFilterInnerBase} ${
                            deliveryFilter === "all"
                              ? "bg-transparent hover:bg-white/10"
                              : "jt-active-gradient-soft"
                          }`}
                          style={{ textAlignLast: "center" }}
                        >
                          <option value="all">Alle</option>
                          <option value="with">Mit Lieferung</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className={sharedContentWidthClass}>
                <div className="w-full max-w-full overflow-x-auto no-scrollbar">
                  <div className="flex min-w-max gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCategory("all");
                        setSearch("");
                      }}
                      className={chipButtonBase}
                    >
                      <span
                        className={`${chipInnerBase} ${
                          category === "all"
                            ? "jt-active-gradient-soft"
                            : "text-white/85 hover:bg-white/10"
                        }`}
                      >
                        <span aria-hidden="true">{getCategoryEmoji("all", "Alle")}</span>
                        <span>Alle</span>
                      </span>
                    </button>
                    {orderedCategories.map((c) => (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => {
                          setCategory(c.slug);
                          setSearch("");
                        }}
                        className={chipButtonBase}
                      >
                        <span
                          className={`${chipInnerBase} ${
                            category === c.slug
                              ? "jt-active-gradient-soft"
                              : "text-white/85 hover:bg-white/10"
                          }`}
                        >
                          {getCategoryEmoji(c.slug, c.name) ? (
                            <span aria-hidden="true">{getCategoryEmoji(c.slug, c.name)}</span>
                          ) : null}
                          <span>{c.name}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isListView && geoError ? (
        <div className="mb-3 text-sm text-red-200">{geoError}</div>
      ) : null}

      {/* ✅ Umkreis */}
      {isListView && isRadiusFilterOpen && userPos ? (
        <div className="mb-4 rounded-[20px] border border-white/10 bg-white/10 p-3 text-white shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold">Umkreis</div>
            <button
              type="button"
              onClick={() => {
                setUserPos(null);
                setRadiusKm(30);
                setIsRadiusFilterOpen(false);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-medium text-white/85 transition hover:bg-white/15"
              title="Standort zurücksetzen"
              aria-label="Standort zurücksetzen"
            >
              ✕
            </button>
          </div>

          <div className="mt-2.5">
            <select
              value={radiusKm}
              onChange={(e) => {
                setRadiusKm(Number(e.target.value));
                setSort("distance");
              }}
              className="w-full appearance-none rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-white/15 active:scale-[1.03] focus:outline-none"
            >
              <option value={2}>2 km</option>
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
              <option value={15}>15 km</option>
              <option value={20}>20 km</option>
              <option value={25}>25 km</option>
              <option value={30}>30 km</option>
            </select>

            <div className="mt-1.5 text-[11px] text-white/75">
              {`Zeige Spots im Umkreis von ${radiusKm} km.`}
            </div>
          </div>
        </div>
      ) : null}

      {/* ✅ Content */}
      {loading ? (
        <p className="text-[#f6efe3]">Lade Spots…</p>
      ) : errorMsg ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900">
          <b>Supabase-Fehler:</b> {errorMsg}
        </div>
      ) : isMapView ? (
        <div className="relative z-0 -mx-4 -mb-6 mt-2 sm:mx-0">
          <div className="pointer-events-none absolute inset-x-4 top-4 z-[1200]">
            <div className="pointer-events-auto mx-auto max-w-[500px]">
              <div className="relative flex h-11 items-center rounded-full border border-white/10 bg-[#0f3b2e]/78 px-4 shadow-lg backdrop-blur-md transition-all duration-300 ease-out">
                <span
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white"
                  aria-hidden="true"
                >
                  🔍
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  placeholder="Foodspots, Burrito, Burger ..."
                  className="h-full min-w-0 flex-1 border-0 bg-transparent pl-7 text-sm font-medium text-white placeholder:text-sm placeholder:font-normal placeholder:text-white/40 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden sm:rounded-[28px]">
            <CityMap
              center={mapCenter}
              spots={mapSpots}
              categories={orderedCategories}
              userPos={userPos}
              userRadiusKm={15}
              activeSpotId={activeSpotId}
              onActiveChange={(id: string) => setActiveSpotId(id)}
              onSpotClick={(id: string) => router.push(`/spot/${id}`)}
              selectedLegendSlug={selectedMapLegendSlug}
              onLegendSelect={setSelectedMapLegendSlug}
              immersiveSheet
            />
          </div>

          {selectedMapLegendSlug ? (
            <div
              ref={legendListRef}
              className="mx-auto mt-4 grid w-[calc(100%-24px)] max-w-[520px] gap-3 scroll-mt-4"
            >
              <div className="mb-1 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-white">
                    {selectedMapLegendSlug === "all"
                      ? "Alle"
                      : orderedCategories.find((c) => c.slug === selectedMapLegendSlug)?.name ??
                        labelFromCategorySlug(selectedMapLegendSlug)}
                  </h2>
                  <p className="mt-1 text-sm text-white/75">
                    {legendCategorySpots.length}{" "}
                    {selectedMapLegendSlug === "all"
                      ? "Spots in dieser Auswahl."
                      : "Spots in dieser Kategorie."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedMapLegendSlug(null)}
                  className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Auswahl aufheben
                </button>
              </div>

              <div className="grid gap-3">
                {legendCategorySpots.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => router.push(`/spot/${s.id}`)}
                    className="relative min-w-0 cursor-pointer rounded-2xl border border-[#efe7da]/45 bg-[#fffaf2]/90 p-3 shadow-sm backdrop-blur-sm transition-all duration-300 hover:bg-[#fffaf2]/94 hover:shadow-lg"
                  >
                    <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                      <ShareSpotButton spotId={s.id} spotName={s.name} variant="list" />
                      <SaveSpotButton spotId={s.id} variant="list" />
                    </div>

                    <div className="min-w-0 flex gap-3">
                      {s.image_url ? (
                        <img
                          src={s.image_url}
                          alt={s.name}
                          className="h-16 w-16 rounded-xl object-cover ring-1 ring-black/5"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-xl bg-[#f3ecdf] ring-1 ring-black/5" />
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ backgroundColor: getColorForCategory(s.category_slug) }}
                          />
                          <h3 className="truncate text-sm font-extrabold text-[#1f1f1f]">
                            {s.name}
                          </h3>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5a5348]">
                          {s.city_name ? <span className="font-medium">{s.city_name}</span> : null}

                          {typeof s.rating === "number" ? (
                            <span className="jt-text-gradient inline-flex items-center gap-1">
                              <span>★</span>
                              <span className="font-semibold">
                                {s.rating.toFixed(1)}
                              </span>
                            </span>
                          ) : null}

                          {typeof s.price_level === "number" ? (
                            <span
                              className="inline-flex items-center gap-0.5 font-semibold text-[#3b342b]"
                              aria-label={`Preisniveau ${getPriceLevelValue(s.price_level, 4)} von 4`}
                            >
                              {Array.from({ length: 4 }, (_, index) => (
                                <span
                                  key={index}
                                  className={
                                    index < getPriceLevelValue(s.price_level, 4)
                                      ? "text-[#3b342b]"
                                      : "text-[#3b342b]/30"
                                  }
                                >
                                  €
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </div>

                        {s.address ? (
                          <p className="mt-1 break-words text-xs text-[#6b6256]">{s.address}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
            ) : isTasteDesMonatsView ? (
        <div className="grid gap-3">
          {tasteDesMonatsSpots.length === 0 ? (
            <p className="text-[#f6efe3]">Keine Spots für Taste des Monats hinterlegt.</p>
          ) : (
            tasteDesMonatsSpots.map((s) => (
  <div
  key={s.id}
  onClick={() => router.push(`/spot/${s.id}`)}
  className="relative min-w-0 cursor-pointer rounded-2xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-3 shadow-sm transition-all duration-300 hover:shadow-lg"
>
  <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
    <ShareSpotButton spotId={s.id} spotName={s.name} variant="list" />
    <SaveSpotButton spotId={s.id} variant="list" />
  </div>

  <div className="min-w-0 flex gap-3">
                  {s.image_url ? (
                    <img
                      src={s.image_url}
                      alt={s.name}
                      className="h-16 w-16 rounded-xl object-cover ring-1 ring-black/5"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-[#f3ecdf] ring-1 ring-black/5" />
                  )}

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-extrabold text-[#1f1f1f]">{s.name}</h2>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5a5348]">
                      {s.city_name ? <span className="font-medium">{s.city_name}</span> : null}

                      {typeof s.rating === "number" ? (
                        <span className="jt-text-gradient inline-flex items-center gap-1">
                          <span>★</span>
                          <span className="font-semibold">{s.rating.toFixed(1)}</span>
                        </span>
                      ) : null}

                      {typeof s.price_level === "number" ? (
                        <span
                          className="inline-flex items-center gap-0.5 font-semibold text-[#3b342b]"
                          aria-label={`Preisniveau ${getPriceLevelValue(s.price_level, 4)} von 4`}
                        >
                          {Array.from({ length: 4 }, (_, index) => (
                            <span
                              key={index}
                              className={
                                index < getPriceLevelValue(s.price_level, 4)
                                  ? "text-[#3b342b]"
                                  : "text-[#3b342b]/30"
                              }
                            >
                              €
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>

                    {s.address ? (
                      <p className="mt-1 break-words text-xs text-[#6b6256]">{s.address}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : filteredSpots.length === 0 ? (
        <p className="text-[#f6efe3]">Keine Spots gefunden für diese Stadt.</p>
      ) : (
        <div className="grid gap-3">
          {filteredSpots.map((s) => {
            const wolt = s.wolt_url ?? null;
            const lieferando = s.lieferando_url ?? null;
            const uberEats = s.uber_eats_url ?? null;
            const hasNativeVideo = Boolean(s.video_url?.trim());

            if (hasNativeVideo) {
              return (
                <VideoSpotCard
                  key={s.id}
                  spot={s}
                  distanceKm={distanceById.get(s.id)}
                  isLiked={likedVideoSpotIds[s.id] === true}
                  onToggleLike={toggleVideoSpotLike}
                  onOpenComments={handleVideoCommentIntent}
                  onOpenSpot={(spotId) => router.push(`/spot/${spotId}`)}
                />
              );
            }

            return (
  <div
    key={s.id}
    onClick={() => router.push(`/spot/${s.id}`)}
    className="relative min-w-0 cursor-pointer rounded-2xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-4 shadow-sm transition-all duration-300 hover:shadow-lg"
  >
    <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <ShareSpotButton spotId={s.id} spotName={s.name} variant="list" />
        <SaveSpotButton spotId={s.id} variant="list" />
      </div>
      {s.google_maps_link ? (
        <a
          href={s.google_maps_link}
          target="_blank"
          rel="noreferrer"
          onClick={(e) =>
            void trackAndOpenExternalLink({
              event: e,
              url: s.google_maps_link!,
              spotId: s.id,
              buttonType: "maps",
            })
          }
          className="inline-flex items-center justify-center"
          aria-label="Google Maps öffnen"
          title="Google Maps öffnen"
        >
          <img
            src="/icons/google-maps.svg"
            alt="Google Maps"
            className="h-6 w-6"
          />
        </a>
      ) : null}
    </div>

    {/* Oberer Infobereich */}
    <div className="min-w-0 flex gap-3">
      {s.image_url ? (
        <img
          src={s.image_url}
          alt={s.name}
          className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-black/5"
        />
      ) : (
        <div className="h-20 w-20 shrink-0 rounded-xl bg-[#f3ecdf] ring-1 ring-black/5" />
      )}

      <div className="min-w-0 flex-1 pr-8">
        <h2 className="break-words text-base font-extrabold text-[#1f1f1f] sm:truncate">{s.name}</h2>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#5a5348]">
          {s.city_name ? <span className="font-medium">{s.city_name}</span> : null}

          {typeof s.rating === "number" ? (
            <span className="jt-text-gradient inline-flex items-center gap-1">
              <span>★</span>
              <span className="font-semibold">{s.rating.toFixed(1)}</span>
            </span>
          ) : null}

          {typeof s.price_level === "number" ? (
            <span
              className="inline-flex items-center gap-0.5 font-semibold text-[#3b342b]"
              aria-label={`Preisniveau ${getPriceLevelValue(s.price_level, 4)} von 4`}
            >
              {Array.from({ length: 4 }, (_, index) => (
                <span
                  key={index}
                  className={
                    index < getPriceLevelValue(s.price_level, 4)
                      ? "text-[#3b342b]"
                      : "text-[#3b342b]/30"
                  }
                >
                  €
                </span>
              ))}
            </span>
          ) : null}
        </div>

        {userPos && distanceById.has(s.id) ? (
          <div className="mt-1">
            <DistanceLabel km={distanceById.get(s.id)!} />
          </div>
        ) : null}

        {s.description ? (
          <p className="mt-2 line-clamp-2 text-sm text-[#2f2a23]">{s.description}</p>
        ) : null}

        {s.address ? <p className="mt-1 break-words text-sm text-[#6b6256]">{s.address}</p> : null}

              </div>
    </div>

    <div className="mt-4 min-w-0 flex flex-wrap gap-2">
      <DeliveryButtons
        spotId={s.id}
        woltUrl={wolt}
        lieferandoUrl={lieferando}
        uberEatsUrl={uberEats}
      />

    
    </div>
  </div>
);
          })}
        </div>
      )}

      <SpotCommentsSheet
        key={commentSpot?.id ?? "city-comments-closed"}
        open={commentSpot !== null}
        onClose={() => setCommentSpot(null)}
        spotId={commentSpot?.id ?? null}
        spotName={commentSpot?.name ?? null}
        spotImageUrl={commentSpot?.image_url ?? null}
        user={user}
        profile={profile}
        onRequireAuth={() => openAuthPrompt()}
      />

      {!menuOpen ? <BottomTabs view={isMapView ? "map" : "list"} onChange={setView} /> : null}
    </main>
  );
}
