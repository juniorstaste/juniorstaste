"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookmarkSimple, ChatCircle, Heart, PaperPlaneTilt } from "@phosphor-icons/react";
import { useAuth } from "@/components/AuthProvider";
import DeliveryButtons from "@/components/DeliveryButtons";
import { supabase } from "@/lib/supabaseClient";
import { logSupabaseError } from "@/lib/logSupabaseError";
import { prioritizeSpots } from "@/lib/prioritySpot";

type FeedSpot = {
  id: string;
  name?: string | null;
  description?: string | null;
  address?: string | null;
  google_maps_link?: string | null;
  wolt_url?: string | null;
  lieferando_url?: string | null;
  uber_eats_url?: string | null;
  created_at?: string | null;
  video_url: string | null;
  tiktok_like_count?: number | null;
};

type LikeTrigger = "button" | "double-tap";

function FeedVideoSlide({
  spot,
  isActive,
  onToggleSound,
  isSoundEnabled,
  onActive,
  isLiked,
  likeCount,
  onLike,
  isSaved,
  onToggleSave,
  onRequireAuthForComment,
  onOpenSpot,
  setVideoRef,
}: {
  spot: FeedSpot;
  isActive: boolean;
  onToggleSound: () => void;
  isSoundEnabled: boolean;
  onActive: (id: string) => void;
  isLiked: boolean;
  likeCount: number;
  onLike: (spotId: string, trigger: LikeTrigger) => Promise<boolean>;
  isSaved: boolean;
  onToggleSave: (spotId: string) => Promise<boolean>;
  onRequireAuthForComment: () => void;
  onOpenSpot: (spotId: string) => void;
  setVideoRef: (spotId: string, node: HTMLVideoElement | null) => void;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const wasPlayingBeforeScrubRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSpeedHolding, setIsSpeedHolding] = useState(false);
  const [heartBurstVisible, setHeartBurstVisible] = useState(false);
  const [heartPopping, setHeartPopping] = useState(false);
  const [savePopping, setSavePopping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const holdTimeoutRef = useRef<number | null>(null);
  const singleTapTimeoutRef = useRef<number | null>(null);
  const suppressTapRef = useRef(false);
  const lastTapAtRef = useRef(0);
  const HOLD_THRESHOLD_MS = 220;
  const HOLD_SPEED_ZONE_START = 0.8;
  const DOUBLE_TAP_DELAY_MS = 240;

  useEffect(() => {
    setVideoRef(spot.id, videoRef.current);

    return () => {
      setVideoRef(spot.id, null);
    };
  }, [setVideoRef, spot.id]);

  function resetPlaybackRate() {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = 1;
    setIsSpeedHolding(false);
  }

  function clearHoldTimeout() {
    if (holdTimeoutRef.current == null) return;
    window.clearTimeout(holdTimeoutRef.current);
    holdTimeoutRef.current = null;
  }

  function clearSingleTapTimeout() {
    if (singleTapTimeoutRef.current == null) return;
    window.clearTimeout(singleTapTimeoutRef.current);
    singleTapTimeoutRef.current = null;
  }

  function updateProgressFromVideo() {
    const video = videoRef.current;
    if (!video) return;

    setScrubTime(video.currentTime || 0);
    setVideoDuration(
      video.duration && Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0
    );

    const nextProgress =
      video.duration && Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(1, Math.max(0, video.currentTime / video.duration))
        : 0;

    setProgress(nextProgress);
  }

  function scrubToClientX(clientX: number) {
    const video = videoRef.current;
    const progressBar = progressBarRef.current;

    if (!video || !progressBar || !video.duration || !Number.isFinite(video.duration)) return;

    const rect = progressBar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    video.currentTime = ratio * video.duration;
    setScrubTime(video.currentTime);
    setVideoDuration(video.duration);
    setProgress(ratio);
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        await video.play();
        setIsPaused(false);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[for-you] video resume failed", {
            id: spot.id,
            name: spot.name,
            error,
          });
        }
      }
      return;
    }

    video.pause();
    setIsPaused(true);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLElement>) {
    clearHoldTimeout();
    suppressTapRef.current = false;

    const isRightEdgeZone = event.clientX > window.innerWidth * HOLD_SPEED_ZONE_START;
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

  function handlePointerEnd() {
    clearHoldTimeout();
    if (isSpeedHolding) {
      suppressTapRef.current = true;
    }
    resetPlaybackRate();
  }

  function finishScrubbing() {
    const video = videoRef.current;

    setIsScrubbing(false);

    if (!video) return;

    if (wasPlayingBeforeScrubRef.current && isActive) {
      void video.play().catch(() => {
        // Resume can still be blocked by the browser.
      });
      setIsPaused(false);
      return;
    }

    setIsPaused(video.paused);
  }

  async function handlePointerUp() {
    const shouldSuppressTap = suppressTapRef.current;
    handlePointerEnd();
    if (shouldSuppressTap) {
      window.setTimeout(() => {
        suppressTapRef.current = false;
      }, 0);
      return;
    }

    const now = Date.now();
    const isDoubleTap = now - lastTapAtRef.current <= DOUBLE_TAP_DELAY_MS;

    if (isDoubleTap) {
      clearSingleTapTimeout();
      lastTapAtRef.current = 0;
      const liked = await onLike(spot.id, "double-tap");
      if (liked) {
        setHeartPopping(false);
        requestAnimationFrame(() => {
          setHeartPopping(true);
          window.setTimeout(() => setHeartPopping(false), 280);
        });
        setHeartBurstVisible(true);
        window.setTimeout(() => setHeartBurstVisible(false), 520);
      }
      return;
    }

    lastTapAtRef.current = now;
    clearSingleTapTimeout();
    singleTapTimeoutRef.current = window.setTimeout(() => {
      singleTapTimeoutRef.current = null;
      lastTapAtRef.current = 0;
      void togglePlayback();
    }, DOUBLE_TAP_DELAY_MS);
  }

  useEffect(() => {
    resetPlaybackRate();
    clearSingleTapTimeout();
    suppressTapRef.current = false;
    lastTapAtRef.current = 0;
  }, [isActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncProgress = () => {
      if (!isScrubbing) {
        updateProgressFromVideo();
      }
    };

    syncProgress();
    video.addEventListener("timeupdate", syncProgress);
    video.addEventListener("loadedmetadata", syncProgress);
    video.addEventListener("durationchange", syncProgress);
    video.addEventListener("seeked", syncProgress);

    return () => {
      video.removeEventListener("timeupdate", syncProgress);
      video.removeEventListener("loadedmetadata", syncProgress);
      video.removeEventListener("durationchange", syncProgress);
      video.removeEventListener("seeked", syncProgress);
    };
  }, [isScrubbing, spot.id]);

  useEffect(() => {
    if (!isScrubbing) return;

    function handlePointerMove(event: PointerEvent) {
      event.preventDefault();
      scrubToClientX(event.clientX);
    }

    function handlePointerUp(event: PointerEvent) {
      event.preventDefault();
      finishScrubbing();
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp, { passive: false });
    window.addEventListener("pointercancel", handlePointerUp, { passive: false });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isScrubbing, isActive]);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        if (entry.intersectionRatio >= 0.75) {
          onActive(spot.id);
        }
      },
      {
        threshold: [0.5, 0.75, 0.95],
      }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [onActive, spot.id]);

  useEffect(() => {
    return () => {
      clearHoldTimeout();
      clearSingleTapTimeout();
      resetPlaybackRate();
    };
  }, []);

  function swallowInteraction(event: React.SyntheticEvent) {
    event.stopPropagation();
  }

  function handleProgressPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    clearHoldTimeout();
    clearSingleTapTimeout();
    suppressTapRef.current = true;
    resetPlaybackRate();

    const video = videoRef.current;
    if (video) {
      wasPlayingBeforeScrubRef.current = !video.paused;
      video.pause();
      setIsPaused(true);
    } else {
      wasPlayingBeforeScrubRef.current = false;
    }

    setIsScrubbing(true);
    scrubToClientX(event.clientX);
  }

  async function handleHeartClick(event: React.SyntheticEvent) {
    swallowInteraction(event);
    const liked = await onLike(spot.id, "button");
    if (liked) {
      setHeartPopping(false);
      requestAnimationFrame(() => {
        setHeartPopping(true);
        window.setTimeout(() => setHeartPopping(false), 280);
      });
      setHeartBurstVisible(true);
      window.setTimeout(() => setHeartBurstVisible(false), 420);
    }
  }

  async function handleSaveClick(event: React.SyntheticEvent) {
    swallowInteraction(event);
    const changed = await onToggleSave(spot.id);
    if (changed && !isSaved) {
      setSavePopping(false);
      requestAnimationFrame(() => {
        setSavePopping(true);
        window.setTimeout(() => setSavePopping(false), 280);
      });
    }
  }

  return (
    <section
      ref={sectionRef}
      key={spot.id}
      className="relative h-[100dvh] w-screen snap-start overflow-hidden bg-black select-none touch-manipulation [-webkit-touch-callout:none] [-webkit-user-select:none]"
      onPointerDown={handlePointerDown}
      onPointerUp={() => {
        void handlePointerUp();
      }}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
    >
      <video
        ref={videoRef}
        src={spot.video_url ?? undefined}
        data-for-you-video="true"
        data-spot-id={spot.id}
        muted
        playsInline
        loop
        preload="auto"
        controls={false}
        className="absolute inset-0 h-full w-full object-cover bg-black"
        onPause={() => setIsPaused(true)}
        onPlay={() => setIsPaused(false)}
        onError={() => {
          console.error("[for-you] video failed to load", {
            id: spot.id,
            name: spot.name,
            video_url: spot.video_url,
          });
        }}
      />

      {isSpeedHolding ? (
        <div className="pointer-events-none absolute right-6 top-[calc(env(safe-area-inset-top)+1.25rem)] z-20">
          <div className="flex h-9 w-11 items-center justify-center rounded-full border border-white/20 bg-[linear-gradient(135deg,rgba(255,124,144,0.42),rgba(255,225,164,0.32))] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.24)]">
            <span className="flex h-full w-full items-center justify-center text-[11px] font-medium leading-none tracking-[-0.01em] text-white/88">
              1.75x
            </span>
          </div>
        </div>
      ) : null}

      {isPaused ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
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

      {heartBurstVisible ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="jt-like-heart-burst like-gradient-heart animate-[jt-like-heart-burst_420ms_ease-out]">
            <Heart size={104} weight="fill" aria-hidden="true" />
          </span>
        </div>
      ) : null}

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute h-0 w-0 overflow-hidden"
        focusable="false"
      >
        <defs>
          <linearGradient id="jt-like-heart-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff7c90" />
            <stop offset="100%" stopColor="#ffe1a4" />
          </linearGradient>
        </defs>
      </svg>

      <div className="absolute right-4 top-[64%] z-20 flex -translate-y-1/2 flex-col items-center gap-5 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col items-center">
          <button
            type="button"
            aria-label={isLiked ? "Like entfernen" : "Like setzen"}
            className={`inline-flex h-11 w-11 items-center justify-center transition-transform duration-200 ${
              heartPopping ? "save-bounce" : ""
            }`}
            onClick={(event) => {
              void handleHeartClick(event);
            }}
            onPointerDown={swallowInteraction}
            onPointerUp={swallowInteraction}
          >
            <span className={isLiked ? "like-gradient-heart" : "text-white"}>
              <Heart size={30} weight="fill" aria-hidden="true" />
            </span>
          </button>
          <span className="mt-1 text-xs font-semibold text-white/92">{formatCompactLikeCount(likeCount)}</span>
        </div>

        <button
          type="button"
          aria-label="Kommentare"
          className="inline-flex h-11 w-11 items-center justify-center"
          onClick={(event) => {
            swallowInteraction(event);
            onRequireAuthForComment();
          }}
          onPointerDown={swallowInteraction}
          onPointerUp={swallowInteraction}
        >
          <ChatCircle size={30} weight="fill" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label={isSaved ? "Spot aus Favoriten entfernen" : "Spot speichern"}
          className={`inline-flex h-11 w-11 items-center justify-center transition-transform duration-200 ${
            savePopping ? "save-bounce" : ""
          }`}
          onClick={(event) => {
            void handleSaveClick(event);
          }}
          onPointerDown={swallowInteraction}
          onPointerUp={swallowInteraction}
        >
          <span className={isSaved ? "jt-gradient-fill" : "text-white"}>
            <BookmarkSimple size={30} weight="fill" aria-hidden="true" />
          </span>
        </button>

        <button
          type="button"
          aria-label="Teilen"
          className="inline-flex h-11 w-11 items-center justify-center"
          onClick={swallowInteraction}
          onPointerDown={swallowInteraction}
          onPointerUp={swallowInteraction}
        >
          <PaperPlaneTilt size={30} weight="fill" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label={isSoundEnabled ? "Ton ausschalten" : "Ton einschalten"}
          className="inline-flex h-11 w-11 items-center justify-center"
          onClick={(event) => {
            swallowInteraction(event);
            onToggleSound();
          }}
          onPointerDown={swallowInteraction}
          onPointerUp={swallowInteraction}
        >
          {isSoundEnabled ? (
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
                d="m18 9 3 3m0-3-3 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>

      <div
        className={`pointer-events-none absolute bottom-[calc(7.85rem+env(safe-area-inset-bottom))] left-4 right-[6.5rem] z-20 transition-opacity duration-200 ease-out ${
          isScrubbing ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="max-w-[calc(100vw-7.5rem)] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
          <button
            type="button"
            onClick={() => onOpenSpot(spot.id)}
            className="pointer-events-auto line-clamp-1 cursor-pointer text-left text-[17px] font-extrabold leading-tight text-white"
          >
            {spot.name ?? "Spot"}
          </button>

          {spot.description ? (
            <p className="mt-1 line-clamp-3 text-sm font-medium leading-snug text-white/88">
              {spot.description}
            </p>
          ) : null}

          {spot.address ? (
            <p className="mt-2 line-clamp-1 text-sm leading-snug text-white/82">{spot.address}</p>
          ) : null}

          {spot.wolt_url || spot.lieferando_url || spot.uber_eats_url ? (
            <div className="pointer-events-auto mt-3 flex flex-wrap gap-2">
              <DeliveryButtons
                spotId={spot.id}
                woltUrl={spot.wolt_url}
                lieferandoUrl={spot.lieferando_url}
                uberEatsUrl={spot.uber_eats_url}
                buttonClassName="flex h-9 min-w-[92px] items-center justify-center rounded-2xl bg-[#e8decc] px-3 py-2 text-[#0f3b2e] shadow-sm transition active:scale-95"
              />
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={`pointer-events-none absolute bottom-[calc(7.15rem+env(safe-area-inset-bottom))] left-1/2 z-20 -translate-x-1/2 transition-all duration-200 ease-out ${
          isScrubbing ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <div className="flex items-center gap-2 text-[18px] font-semibold drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
          <span className="jt-text-gradient">{formatTime(scrubTime)}</span>
          <span className="text-white/75">/</span>
          <span className="text-white/85">{formatTime(videoDuration)}</span>
        </div>
      </div>

      <div
        ref={progressBarRef}
        className="absolute bottom-[calc(5.55rem+env(safe-area-inset-bottom))] left-4 right-4 z-20 touch-none"
        onPointerDown={handleProgressPointerDown}
        onPointerMove={(event) => {
          if (!isScrubbing) return;
          event.preventDefault();
          event.stopPropagation();
          scrubToClientX(event.clientX);
        }}
        onPointerUp={(event) => {
          if (!isScrubbing) return;
          event.preventDefault();
          event.stopPropagation();
          finishScrubbing();
        }}
        onPointerCancel={(event) => {
          if (!isScrubbing) return;
          event.preventDefault();
          event.stopPropagation();
          finishScrubbing();
        }}
      >
        <div
          className={`overflow-hidden rounded-full bg-white/20 transition-all duration-200 ease-out ${
            isScrubbing ? "h-2.5" : "h-1"
          }`}
        >
          <div
            className="h-full rounded-full bg-white transition-[width] duration-100 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      <style jsx>{`
        .save-bounce {
          animation: savePop 280ms ease-out;
        }

        .like-gradient-heart :global(svg),
        .like-gradient-heart :global(path),
        .jt-gradient-fill :global(svg),
        .jt-gradient-fill :global(path) {
          fill: url(#jt-like-heart-gradient);
          color: transparent;
        }

        @keyframes savePop {
          0% {
            transform: scale(1);
          }
          35% {
            transform: scale(1.22);
          }
          65% {
            transform: scale(0.94);
          }
          100% {
            transform: scale(1);
          }
        }
      `}</style>
    </section>
  );
}

function formatCompactLikeCount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  }

  return String(value);
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export default function ForYouPage() {
  const router = useRouter();
  const { user, openAuthPrompt, isSavedSpot, toggleSavedSpot } = useAuth();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [spots, setSpots] = useState<FeedSpot[]>([]);
  const [activeSpotId, setActiveSpotId] = useState<string | null>(null);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [likedSpotIds, setLikedSpotIds] = useState<Record<string, boolean>>({});
  const [appLikeCounts, setAppLikeCounts] = useState<Record<string, number>>({});
  const [videoRegistryVersion, setVideoRegistryVersion] = useState(0);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const previousThemeColor = themeColorMeta?.getAttribute("content");

    html.classList.add("for-you-page-active");
    body.classList.add("for-you-page-active");
    themeColorMeta?.setAttribute("content", "#000000");

    return () => {
      html.classList.remove("for-you-page-active");
      body.classList.remove("for-you-page-active");

      if (previousThemeColor) {
        themeColorMeta?.setAttribute("content", previousThemeColor);
      } else {
        themeColorMeta?.setAttribute("content", "#0f3b2e");
      }
    };
  }, []);

  useEffect(() => {
    async function loadFeedSpots() {
      let data: FeedSpot[] | null = null;
      let error: { message?: string } | null = null;

      const withTikTokLikes = await supabase
        .from("spots")
        .select(
          "id, name, description, address, google_maps_link, wolt_url, lieferando_url, uber_eats_url, video_url, created_at, tiktok_like_count"
        )
        .not("video_url", "is", null)
        .order("created_at", { ascending: false });

      if (withTikTokLikes.error) {
        const fallback = await supabase
          .from("spots")
          .select(
            "id, name, description, address, google_maps_link, wolt_url, lieferando_url, uber_eats_url, video_url, created_at"
          )
          .not("video_url", "is", null)
          .order("created_at", { ascending: false });

        data = (fallback.data ?? null) as FeedSpot[] | null;
        error = fallback.error;
      } else {
        data = (withTikTokLikes.data ?? null) as FeedSpot[] | null;
      }

      if (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[for-you] failed to load feed videos", error);
        }
        setSpots([]);
        return;
      }

      const normalized = ((data ?? []) as FeedSpot[]).filter(
        (spot) => typeof spot.video_url === "string" && spot.video_url.trim().length > 0
      );

      if (process.env.NODE_ENV !== "production") {
        console.log("[for-you] loaded spots:", (data ?? []).length);
        console.log(
          "[for-you] usable video spots:",
          normalized.map((spot) => ({ id: spot.id, name: spot.name, video_url: spot.video_url }))
        );
      }

      setSpots(prioritizeSpots<FeedSpot>(normalized));
      setActiveSpotId((current) => current ?? normalized[0]?.id ?? null);
    }

    loadFeedSpots();
  }, []);

  useEffect(() => {
    async function loadLikes() {
      if (spots.length === 0) {
        setLikedSpotIds({});
        setAppLikeCounts({});
        return;
      }

      const spotIds = spots.map((spot) => spot.id);
      const { data, error } = await supabase
        .from("spot_likes")
        .select("spot_id, user_id")
        .in("spot_id", spotIds);

      if (error) {
        logSupabaseError("Konnte Like-Daten fuer /for-you nicht laden:", error);
        setLikedSpotIds({});
        setAppLikeCounts({});
        return;
      }

      const nextCounts: Record<string, number> = {};
      const nextLiked: Record<string, boolean> = {};

      (data ?? []).forEach((row: { spot_id: string; user_id: string | null }) => {
        nextCounts[row.spot_id] = (nextCounts[row.spot_id] ?? 0) + 1;
        if (user?.id && row.user_id === user.id) {
          nextLiked[row.spot_id] = true;
        }
      });

      setAppLikeCounts(nextCounts);
      setLikedSpotIds(nextLiked);
    }

    void loadLikes();
  }, [spots, user?.id]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const SCROLL_DIRECTION_THRESHOLD = 6;
    let lastScrollTop = node.scrollTop;

    const emitCompactState = () => {
      const nextScrollTop = node.scrollTop;
      const delta = nextScrollTop - lastScrollTop;

      if (Math.abs(delta) <= SCROLL_DIRECTION_THRESHOLD) return;

      window.dispatchEvent(
        new CustomEvent("jt-bottom-tabs-compact", {
          detail: { compact: delta > 0 },
        })
      );

      lastScrollTop = nextScrollTop;
    };

    node.addEventListener("scroll", emitCompactState, { passive: true });

    return () => {
      node.removeEventListener("scroll", emitCompactState);
      window.dispatchEvent(
        new CustomEvent("jt-bottom-tabs-compact", {
          detail: { compact: false },
        })
      );
    };
  }, []);

  useEffect(() => {
    if (!spots.length || !activeSpotId) return;

    const activeVideo = videoRefs.current[activeSpotId] ?? null;

    Object.entries(videoRefs.current).forEach(([spotId, video]) => {
      if (!video) return;

      if (spotId !== activeSpotId) {
        video.pause();
        video.currentTime = 0;
        video.muted = true;
      }
    });

    if (!activeVideo) return;

    activeVideo.muted = !isSoundEnabled;

    void activeVideo.play().catch(async (error) => {
      if (isSoundEnabled) {
        activeVideo.muted = true;
        setIsSoundEnabled(false);

        try {
          await activeVideo.play();
          return;
        } catch (fallbackError) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[for-you] muted fallback play failed", {
              id: activeSpotId,
              error: fallbackError,
            });
          }
        }
      }

      if (process.env.NODE_ENV !== "production") {
        console.error("[for-you] active video play failed", {
          id: activeSpotId,
          error,
        });
      }
    });
  }, [activeSpotId, isSoundEnabled, spots, videoRegistryVersion]);

  const setVideoRef = useCallback((spotId: string, node: HTMLVideoElement | null) => {
    if (videoRefs.current[spotId] === node) return;
    videoRefs.current[spotId] = node;
    setVideoRegistryVersion((current) => current + 1);
  }, []);

  async function toggleLike(spotId: string, trigger: LikeTrigger) {
    const alreadyLiked = likedSpotIds[spotId] === true;

    if (!user) {
      openAuthPrompt({ type: "like-spot", spotId, returnTo: "/for-you" });
      return false;
    }

    if (trigger === "double-tap" && alreadyLiked) {
      return true;
    }

    setLikedSpotIds((current) => ({
      ...current,
      [spotId]: trigger === "double-tap" ? true : !alreadyLiked,
    }));
    setAppLikeCounts((current) => ({
      ...current,
      [spotId]:
        (current[spotId] ?? 0) +
        (trigger === "double-tap" ? (alreadyLiked ? 0 : 1) : alreadyLiked ? -1 : 1),
    }));

    if (trigger === "double-tap" && !alreadyLiked) {
      const { error } = await supabase.from("spot_likes").insert({
        user_id: user.id,
        spot_id: spotId,
      });

      if (error && error.code !== "23505") {
        logSupabaseError("Konnte Like per Double Tap nicht speichern:", error);
        setLikedSpotIds((current) => {
          const next = { ...current };
          delete next[spotId];
          return next;
        });
        setAppLikeCounts((current) => ({
          ...current,
          [spotId]: Math.max(0, (current[spotId] ?? 1) - 1),
        }));
        return false;
      }

      return true;
    }

    if (alreadyLiked) {
      const { error } = await supabase
        .from("spot_likes")
        .delete()
        .eq("user_id", user.id)
        .eq("spot_id", spotId);

      if (error) {
        logSupabaseError("Konnte Like nicht entfernen:", error);
        setLikedSpotIds((current) => ({ ...current, [spotId]: true }));
        setAppLikeCounts((current) => ({
          ...current,
          [spotId]: (current[spotId] ?? 0) + 1,
        }));
        return false;
      }

      return false;
    }

    const { error } = await supabase.from("spot_likes").insert({
      user_id: user.id,
      spot_id: spotId,
    });

    if (error && error.code !== "23505") {
      logSupabaseError("Konnte Like nicht speichern:", error);
      setLikedSpotIds((current) => {
        const next = { ...current };
        delete next[spotId];
        return next;
      });
      setAppLikeCounts((current) => ({
        ...current,
        [spotId]: Math.max(0, (current[spotId] ?? 1) - 1),
      }));
      return false;
    }

    return true;
  }

  async function toggleSaveFromForYou(spotId: string) {
    if (!user) {
      openAuthPrompt({ type: "save-spot", spotId, returnTo: "/for-you" });
      return false;
    }

    return toggleSavedSpot(spotId);
  }

  function requireAuthForComment() {
    if (!user) {
      openAuthPrompt();
    }
  }

  return (
    <main className="fixed inset-0 z-[1000] h-[100dvh] w-screen overflow-hidden bg-black text-white select-none touch-manipulation [-webkit-touch-callout:none] [-webkit-user-select:none]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1100] px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <div className="mx-auto flex w-full max-w-[560px] items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="pointer-events-auto flex items-center justify-start"
            aria-label="Zur Startseite"
          >
            <img
              src="/logos/citypage-logo.png"
              alt="Junior's Taste"
              className="h-auto w-[132px]"
            />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="no-scrollbar absolute inset-0 h-[100dvh] w-screen snap-y snap-mandatory overflow-y-scroll overscroll-y-contain bg-black"
      >
        {spots.length === 0 ? (
          <section className="flex h-[100dvh] w-screen snap-start items-center justify-center bg-black px-6 text-center">
            <p className="text-sm font-medium text-white/70">Noch keine Feed-Videos verf&uuml;gbar.</p>
          </section>
        ) : (
          spots.map((spot) => (
            <FeedVideoSlide
              key={spot.id}
              spot={spot}
              isActive={activeSpotId === spot.id}
              onToggleSound={() => setIsSoundEnabled((current) => !current)}
              isSoundEnabled={isSoundEnabled}
              onActive={setActiveSpotId}
              isLiked={likedSpotIds[spot.id] === true}
              likeCount={(appLikeCounts[spot.id] ?? 0) + (spot.tiktok_like_count ?? 0)}
              onLike={toggleLike}
              isSaved={isSavedSpot(spot.id)}
              onToggleSave={toggleSaveFromForYou}
              onRequireAuthForComment={requireAuthForComment}
              onOpenSpot={(spotId) => router.push(`/spot/${spotId}`)}
              setVideoRef={setVideoRef}
            />
          ))
        )}
      </div>
    </main>
  );
}
