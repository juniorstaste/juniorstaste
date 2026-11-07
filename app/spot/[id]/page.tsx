"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ChatCircle, Heart } from "@phosphor-icons/react";
import StarRating from "@/components/StarRating";
import DistanceLabel from "@/components/DistanceLabel";
import TopRightMenu from "@/components/TopRightMenu";
import SaveSpotButton from "@/components/SaveSpotButton";
import ShareSpotButton from "@/components/ShareSpotButton";
import SpotCommentsSheet from "@/components/SpotCommentsSheet";
import DeliveryButtons from "@/components/DeliveryButtons";
import { useAuth } from "@/components/AuthProvider";
import { trackAndOpenExternalLink } from "@/lib/externalClickTracking";
import { logSupabaseError } from "@/lib/logSupabaseError";
import { getPriceLevelValue } from "@/lib/priceLevel";
import { prioritizeSpots } from "@/lib/prioritySpot";

const SpotMiniMap = dynamic(() => import("@/components/SpotMiniMap"), { ssr: false });

type Spot = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  city_id?: string | null;
  category_id?: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  tiktok_embed_id?: string | null;
  tiktok_url?: string | null;
  video_url?: string | null;
  google_maps_link: string | null;
  rating: number | null;
  price_level: number | null;
  city_name: string | null;
  city_slug: string | null;
  category_name?: string | null;
  category_slug?: string | null;
  wolt_url?: string | null;
  lieferando_url?: string | null;
  uber_eats_url?: string | null;
};

type SpotComment = {
  id: string;
  username: string;
  content: string;
  created_at: string;
  featured_order?: number | null;
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

function formatCommentTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `vor ${diffMinutes} Min.`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `vor ${diffHours} Std.`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `vor ${diffDays} Tagen`;

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(timestamp));
}

export default function SpotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile, openAuthPrompt } = useAuth();

  const spotId = useMemo(() => {
    const raw = (params as any)?.id;
    if (!raw) return null;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params]);

  const [spot, setSpot] = useState<Spot | null>(null);
  const [recommendations, setRecommendations] = useState<Spot[]>([]);
  const [communityComments, setCommunityComments] = useState<SpotComment[]>([]);
  const [commentLikeCounts, setCommentLikeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [likedSpot, setLikedSpot] = useState<{
    spotId: string;
    userId: string;
    liked: boolean;
  } | null>(null);
  const [likePending, setLikePending] = useState(false);
  const [likePopping, setLikePopping] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const manuallyPausedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoFrameRef = useRef<HTMLDivElement | null>(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const [videoFrameHeight, setVideoFrameHeight] = useState<number | null>(null);
  const hasNativeVideo = Boolean(spot?.video_url?.trim());
  const isLiked = Boolean(
    spot && user && likedSpot?.spotId === spot.id && likedSpot.userId === user.id && likedSpot.liked
  );

  // Spot laden
  useEffect(() => {
    if (!spotId) return;

    async function load() {
      const { data, error } = await supabase
        .from("spots")
        .select("*")
        .eq("id", spotId)
        .maybeSingle();

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      const baseSpot = data as Spot | null;

      if (!baseSpot) {
        setSpot(null);
        setLoading(false);
        return;
      }

      const [cityResult, categoryResult] = await Promise.all([
        baseSpot.city_id
          ? supabase.from("cities").select("name, slug").eq("id", baseSpot.city_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        baseSpot.category_id
          ? supabase
              .from("categories")
              .select("name, slug")
              .eq("id", baseSpot.category_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (process.env.NODE_ENV !== "production") {
        console.log("[spot-detail] loaded spot media", {
          id: baseSpot.id,
          name: baseSpot.name,
          video_url: baseSpot.video_url,
          tiktok_url: baseSpot.tiktok_url,
          tiktok_embed_id: baseSpot.tiktok_embed_id,
        });
      }

      setSpot({
        ...baseSpot,
        city_name: cityResult.data?.name ?? null,
        city_slug: cityResult.data?.slug ?? null,
        category_name: categoryResult.data?.name ?? null,
        category_slug: categoryResult.data?.slug ?? null,
      });
      setLoading(false);
    }

    void load();
  }, [spotId]);

  useEffect(() => {
    const currentSpot = spot;

    if (!currentSpot?.id) {
      setRecommendations([]);
      return;
    }

    async function loadRecommendations(spotData: Spot) {
      const recommendationFields =
        "id, name, image_url, city_name, city_slug, category_name, category_slug, rating, price_level";

      const seenIds = new Set<string>([spotData.id]);
      let categoryRecommendations: Spot[] = [];
      let cityFallbackRecommendations: Spot[] = [];

      if (spotData.category_slug) {
        const { data, error } = await supabase
          .from("spots_with_city")
          .select(recommendationFields)
          .eq("category_slug", spotData.category_slug)
          .neq("id", spotData.id)
          .limit(12);

        if (!error) {
          categoryRecommendations = prioritizeSpots((data as Spot[]) ?? []).filter((item) => {
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return true;
          });
        }
      }

      if (categoryRecommendations.length < 6 && spotData.city_slug) {
        const { data, error } = await supabase
          .from("spots_with_city")
          .select(recommendationFields)
          .eq("city_slug", spotData.city_slug)
          .neq("id", spotData.id)
          .limit(18);

        if (!error) {
          cityFallbackRecommendations = prioritizeSpots((data as Spot[]) ?? []).filter((item) => {
            if (seenIds.has(item.id)) return false;
            seenIds.add(item.id);
            return true;
          });
        }
      }

      setRecommendations([...categoryRecommendations, ...cityFallbackRecommendations].slice(0, 6));
    }

    void loadRecommendations(currentSpot);
  }, [spot]);

  useEffect(() => {
    const currentSpotId = spot?.id;

    if (!currentSpotId) {
      setCommunityComments([]);
      setCommentLikeCounts({});
      return;
    }

    let cancelled = false;

    async function loadCommunityComments() {
      const { data, error } = await supabase
        .from("spot_comments")
        .select("id, username, content, created_at, featured_order")
        .eq("spot_id", currentSpotId)
        .is("parent_id", null)
        .eq("featured_on_spot_page", true)
        .order("featured_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
        .limit(3);

      if (cancelled || error) {
        if (!cancelled) {
          setCommunityComments([]);
          setCommentLikeCounts({});
        }
        return;
      }

      const nextComments = ((data as SpotComment[] | null) ?? []).filter((comment) =>
        comment.content?.trim()
      );

      setCommunityComments(nextComments);

      if (nextComments.length === 0) {
        setCommentLikeCounts({});
        return;
      }

      const commentIds = nextComments.map((comment) => comment.id);
      const { data: likesData, error: likesError } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .in("comment_id", commentIds);

      if (cancelled || likesError) {
        if (!cancelled) {
          setCommentLikeCounts({});
        }
        return;
      }

      const nextCounts: Record<string, number> = {};
      for (const like of ((likesData as Array<{ comment_id: string }> | null) ?? [])) {
        nextCounts[like.comment_id] = (nextCounts[like.comment_id] ?? 0) + 1;
      }

      setCommentLikeCounts(nextCounts);
    }

    void loadCommunityComments();

    return () => {
      cancelled = true;
    };
  }, [spot?.id]);

  useEffect(() => {
    if (!spot?.id || !user?.id) return;

    const activeSpotId = spot.id;
    const activeUserId = user.id;
    let cancelled = false;

    async function loadSpotLike() {
      const { data, error } = await supabase
        .from("spot_likes")
        .select("spot_id")
        .eq("user_id", activeUserId)
        .eq("spot_id", activeSpotId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        logSupabaseError("Konnte Spot-Like auf der Detailseite nicht laden:", error);
        return;
      }

      setLikedSpot({
        spotId: activeSpotId,
        userId: activeUserId,
        liked: Boolean(data),
      });
    }

    void loadSpotLike();

    return () => {
      cancelled = true;
    };
  }, [spot?.id, user?.id]);

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

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !hasNativeVideo) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (!entry) return;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          if (manuallyPausedRef.current) return;

          void video.play().catch(() => {
            // Mobile browsers may still block autoplay in some cases.
          });
          return;
        }

        video.pause();
      },
      {
        threshold: [0, 0.6, 1],
      }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [hasNativeVideo, spot?.video_url]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = !soundEnabled;
    }
  }, [soundEnabled]);

  useEffect(() => {
    const frame = videoFrameRef.current;
    if (!frame || !videoAspectRatio) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setVideoFrameHeight(Math.max(0, (entry.contentRect.width - 16) / videoAspectRatio + 8));
    });

    resizeObserver.observe(frame);
    return () => resizeObserver.disconnect();
  }, [videoAspectRatio]);

  async function toggleVideoPlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      manuallyPausedRef.current = false;
      try {
        await video.play();
      } catch (error) {
        console.error("Spot-Detail-Video konnte nicht abgespielt werden:", error);
      }
      return;
    }

    manuallyPausedRef.current = true;
    video.pause();
  }

  async function handleToggleVideoLike(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!spot || likePending) return;

    if (!user) {
      openAuthPrompt({
        type: "like-spot",
        spotId: spot.id,
        returnTo: `/spot/${spot.id}`,
      });
      return;
    }

    const wasLiked = isLiked;
    const nextLiked = !wasLiked;
    setLikePending(true);
    setLikedSpot({ spotId: spot.id, userId: user.id, liked: nextLiked });

    const result = wasLiked
      ? await supabase
          .from("spot_likes")
          .delete()
          .eq("user_id", user.id)
          .eq("spot_id", spot.id)
      : await supabase.from("spot_likes").insert({
          user_id: user.id,
          spot_id: spot.id,
        });

    if (result.error && !(result.error.code === "23505" && nextLiked)) {
      logSupabaseError("Konnte Spot-Like auf der Detailseite nicht aktualisieren:", result.error);
      setLikedSpot({ spotId: spot.id, userId: user.id, liked: wasLiked });
      setLikePending(false);
      return;
    }

    if (nextLiked) {
      setLikePopping(false);
      requestAnimationFrame(() => {
        setLikePopping(true);
        window.setTimeout(() => setLikePopping(false), 280);
      });
    }

    setLikePending(false);
  }

  function handleToggleVideoSound(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    const nextSoundEnabled = !soundEnabled;
    setSoundEnabled(nextSoundEnabled);
    if (videoRef.current) {
      videoRef.current.muted = !nextSoundEnabled;
    }
  }

  function handleOpenComments() {
    if (!user) {
      openAuthPrompt();
      return;
    }

    setCommentsOpen(true);
  }

  if (!spotId) return null;

  const tiktokOpenUrl = spot?.tiktok_url?.trim()
    ? spot.tiktok_url.trim()
    : spot?.tiktok_embed_id?.trim()
      ? `https://www.tiktok.com/@juniorstaste/video/${spot.tiktok_embed_id.trim()}`
      : null;
  return (
    <main className="mx-auto min-h-screen max-w-xl bg-[#0f3b2e] px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top,0px)+1.75rem)] text-white sm:px-6 sm:pt-[calc(env(safe-area-inset-top,0px)+2rem)]">

      <div className="flex items-center justify-between mb-6">

<button
  onClick={() => {
    if (spot?.city_slug) {
      router.push(`/city/${spot.city_slug}`);
      return;
    }

    router.push("/for-you");
  }}
className="flex items-center justify-start transition active:scale-[1.03]"
  aria-label="Zur For You Page"
>
  <img
    src="/logos/citypage-logo.png"
    alt="Junior's Taste"
    className="h-auto w-[132px] sm:w-[148px]"
  />
</button>

  <div className="flex items-center gap-2">
    {spot?.id && <ShareSpotButton spotId={spot.id} spotName={spot.name} />}
    {spot?.id && <SaveSpotButton spotId={spot.id} />}
    <TopRightMenu />
  </div>

</div>

      {loading ? (
        <p>Lade Spot…</p>
      ) : errorMsg ? (
        <div className="text-red-400">{errorMsg}</div>
      ) : !spot ? null : (
        <>
          {/* Titelzeile mit Spot-Bild */}
          <div className="mb-3 flex items-center gap-3 sm:gap-4">
            {spot.image_url ? (
              <img
                src={spot.image_url}
                alt={spot.name}
                className="h-24 w-24 shrink-0 rounded-2xl object-cover ring-1 ring-black/5 sm:h-32 sm:w-32"
              />
            ) : null}

            <div className="min-w-0 flex-1">
              <h1 className="text-[2rem] font-extrabold leading-tight sm:text-3xl">{spot.name}</h1>
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-4 items-center mb-4">
            {spot.city_name && <span>{spot.city_name}</span>}
            {spot.rating != null && <StarRating value={spot.rating} />}
            {(() => {
              const activePriceLevel = getPriceLevelValue(spot.price_level, 4);

              if (activePriceLevel <= 0) return null;

              return (
                <div
                  className="flex items-center gap-0.5 text-base font-semibold"
                  aria-label={`Preisniveau ${activePriceLevel} von 4`}
                >
                  {Array.from({ length: 4 }, (_, index) => (
                    <span
                      key={index}
                      className={index < activePriceLevel ? "text-white" : "text-white/30"}
                    >
                      €
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Mini Map */}
          {spot.lat && spot.lng ? (
            <div className="mb-3 rounded-2xl overflow-hidden">
              <SpotMiniMap
                lat={spot.lat}
                lng={spot.lng}
                name={spot.name}
                googleMapsLink={spot.google_maps_link}
                spotId={spot.id}
                userPos={userPos}
              />
            </div>
          ) : null}

          {/* ✅ Entfernung DIREKT unter Karte */}
          {userPos && spot.lat && spot.lng && (
            <div className="mb-4 flex justify-end">
              <DistanceLabel
                km={haversineKm(userPos, { lat: spot.lat, lng: spot.lng })}
                className="text-right text-white/65"
              />
            </div>
          )}

          {/* Video / Placeholder */}
          <div className="mt-4 w-full">
            {hasNativeVideo ? (
              <div
                ref={videoFrameRef}
                style={videoFrameHeight === null ? undefined : { height: `${videoFrameHeight}px` }}
                className="relative w-full overflow-hidden rounded-xl bg-black"
              >
                <video
                  ref={videoRef}
                  src={spot.video_url!}
                  controls={false}
                  muted={!soundEnabled}
                  playsInline
                  loop
                  preload="metadata"
                  poster={spot.image_url ?? undefined}
                  onLoadedMetadata={(event) => {
                    const { videoWidth, videoHeight } = event.currentTarget;
                    if (videoWidth > 0 && videoHeight > 0) {
                      setVideoAspectRatio(videoWidth / videoHeight);
                    }
                  }}
                  onPause={() => setIsVideoPaused(true)}
                  onPlay={() => setIsVideoPaused(false)}
                  className={
                    videoFrameHeight === null
                      ? "block h-auto w-full object-cover"
                      : "absolute inset-0 h-full w-full object-cover"
                  }
                />
                <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/20 via-transparent to-black/35" />
                {spot.wolt_url || spot.lieferando_url || spot.uber_eats_url ? (
                  <div className="pointer-events-auto absolute bottom-4 left-4 right-[6.5rem] z-20 flex flex-wrap gap-2">
                    <DeliveryButtons
                      spotId={spot.id}
                      woltUrl={spot.wolt_url}
                      lieferandoUrl={spot.lieferando_url}
                      uberEatsUrl={spot.uber_eats_url}
                      variant="for-you"
                      buttonClassName="flex h-9 min-w-[92px] items-center justify-center rounded-2xl bg-[#e8decc] px-3 py-2 text-[#0f3b2e] shadow-sm transition active:scale-95"
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  aria-label={isVideoPaused ? "Video abspielen" : "Video pausieren"}
                  className="absolute inset-0 z-[2] flex touch-manipulation items-center justify-center"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void toggleVideoPlayback();
                  }}
                >
                  {isVideoPaused ? (
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
                  ) : null}
                </button>

                <svg className="absolute h-0 w-0" aria-hidden="true" focusable="false">
                  <defs>
                    <linearGradient id={`spot-detail-video-like-${spot.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff7c90" />
                      <stop offset="100%" stopColor="#ffe1a4" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute right-2.5 top-[72%] z-20 flex -translate-y-1/2 flex-col items-center gap-4 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
                  <button
                    type="button"
                    aria-label={isLiked ? "Like entfernen" : "Like setzen"}
                    disabled={likePending}
                    className={`inline-flex h-10 w-10 items-center justify-center transition-transform duration-200 ${
                      likePopping ? "detail-video-like-pop" : ""
                    }`}
                    onClick={(event) => void handleToggleVideoLike(event)}
                  >
                    <Heart
                      size={26}
                      weight="fill"
                      aria-hidden="true"
                      className={isLiked ? "" : "text-white"}
                      style={
                        isLiked
                          ? { fill: `url(#spot-detail-video-like-${spot.id})` }
                          : undefined
                      }
                    />
                  </button>
                  <button
                    type="button"
                    aria-label="Kommentare"
                    className="inline-flex h-10 w-10 items-center justify-center text-white"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleOpenComments();
                    }}
                  >
                    <ChatCircle size={26} weight="fill" aria-hidden="true" />
                  </button>
                  <SaveSpotButton spotId={spot.id} variant="video" />
                  <ShareSpotButton spotId={spot.id} spotName={spot.name} variant="video" />
                  <button
                    type="button"
                    aria-label={soundEnabled ? "Ton ausschalten" : "Ton einschalten"}
                    className="inline-flex h-10 w-10 items-center justify-center text-white"
                    onClick={handleToggleVideoSound}
                  >
                    {!soundEnabled ? (
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
              </div>
            ) : (
              <div className="flex min-h-[360px] items-center justify-center rounded-xl bg-[#0f3b2e] px-6 text-center sm:min-h-[420px]">
                <p className="text-sm font-semibold text-white/70">Video folgt</p>
              </div>
            )}

            {tiktokOpenUrl ? (
              <div className="mt-2 rounded-xl bg-[#f6efe3] px-3 py-2 text-center">
                <a
                  href={tiktokOpenUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[13px] font-semibold text-[#0f3b2e] no-underline"
                >
                  Auf TikTok öffnen
                </a>
              </div>
            ) : null}
          </div>

          {/* Adresse / Maps */}
          {spot.address || spot.google_maps_link ? (
            <div className="mt-8 mb-6 flex items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-white/5 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Adresse
                </div>
                {spot.address ? (
                  <p className="break-words text-sm font-semibold text-white">
                    {spot.address}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-white/70">Adresse nicht verfügbar</p>
                )}
              </div>

              {spot.google_maps_link ? (
                <a
                  href={spot.google_maps_link}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) =>
                    void trackAndOpenExternalLink({
                      event: e,
                      url: spot.google_maps_link!,
                      spotId: spot.id,
                      buttonType: "maps",
                    })
                  }
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e8decc] text-[#0f3b2e] shadow-sm transition active:scale-95"
                  aria-label="Adresse in Google Maps öffnen"
                  title="Adresse in Google Maps öffnen"
                >
                  <img
                    src="/icons/google-maps.svg"
                    alt="Google Maps"
                    className="h-5 w-5"
                  />
                </a>
              ) : null}
            </div>
          ) : null}

          {recommendations.length > 0 ? (
            <section className="mt-8">
              <h2 className="mb-4 text-xl font-extrabold text-white">
                K&ouml;nnte dir auch gefallen
              </h2>

              <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {recommendations.map((item) => {
                  const activePriceLevel = getPriceLevelValue(item.price_level, 4);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => router.push(`/spot/${item.id}`)}
                      className="w-[min(188px,calc(100vw-6rem))] shrink-0 rounded-2xl border border-[#efe7da] bg-gradient-to-b from-[#fffaf2] to-[#fff6ea] p-3 text-left shadow-sm transition-all duration-300 hover:shadow-lg"
                    >
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="mb-3 h-24 w-full rounded-xl object-cover ring-1 ring-black/5"
                        />
                      ) : (
                        <div className="mb-3 h-24 w-full rounded-xl bg-[#f3ecdf] ring-1 ring-black/5" />
                      )}

                      <h3 className="truncate text-sm font-extrabold text-[#1f1f1f]">
                        {item.name}
                      </h3>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5a5348]">
                        {item.city_name ? <span className="font-medium">{item.city_name}</span> : null}
                        {item.category_name ? <span>{item.category_name}</span> : null}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {typeof item.rating === "number" ? (
                          <span className="jt-text-gradient inline-flex items-center gap-1">
                            <span>★</span>
                            <span className="font-semibold">{item.rating.toFixed(1)}</span>
                          </span>
                        ) : null}

                        {activePriceLevel > 0 ? (
                          <span
                            className="inline-flex items-center gap-0.5 font-semibold text-[#3b342b]"
                            aria-label={`Preisniveau ${activePriceLevel} von 4`}
                          >
                            {Array.from({ length: 4 }, (_, index) => (
                              <span
                                key={index}
                                className={
                                  index < activePriceLevel ? "text-[#3b342b]" : "text-[#3b342b]/30"
                                }
                              >
                                €
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {communityComments.length > 0 ? (
            <section className="mt-8">
              <h2 className="mb-4 text-xl font-extrabold text-white">
                Was die Community sagt
              </h2>

              <svg width="0" height="0" className="absolute">
                <defs>
                  <linearGradient id="spot-testimonial-like-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgb(255, 124, 144)" />
                    <stop offset="100%" stopColor="rgb(255, 225, 164)" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {communityComments.map((comment) => {
                  const likeCount = commentLikeCounts[comment.id] ?? 0;

                  return (
                    <article
                      key={comment.id}
                      className="w-[min(250px,calc(100vw-5rem))] shrink-0 rounded-2xl border border-white/10 bg-white/6 p-4 shadow-[0_10px_28px_rgba(0,0,0,0.16)] backdrop-blur-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-white">
                            {comment.username}
                          </p>
                          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/45">
                            Community
                          </p>
                        </div>

                        <div className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/8 px-2 py-1 text-xs font-semibold text-white/80">
                          <Heart
                            size={18}
                            weight="fill"
                            aria-hidden="true"
                            style={{ fill: "url(#spot-testimonial-like-gradient)" }}
                          />
                          {likeCount > 0 ? <span>{likeCount}</span> : null}
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-5 text-sm leading-relaxed text-white/88">
                        {comment.content}
                      </p>

                      <p className="mt-4 text-xs font-medium text-white/50">
                        {formatCommentTime(comment.created_at)}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      )}
      <SpotCommentsSheet
        key={spot?.id ?? "spot-detail-comments-closed"}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        spotId={spot?.id ?? null}
        spotName={spot?.name ?? null}
        spotImageUrl={spot?.image_url ?? null}
        user={user}
        profile={profile}
        onRequireAuth={() => openAuthPrompt()}
        variant="for-you"
      />
      <style jsx>{`
        .detail-video-like-pop {
          animation: detailVideoLikePop 280ms ease-out;
        }

        @keyframes detailVideoLikePop {
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
      `}</style>
    </main>
  );
}
