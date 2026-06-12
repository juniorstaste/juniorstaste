"use client";

import { memo, useEffect, useRef, useState } from "react";

type Props = {
  videoId: string;
  embedInstanceId?: string;
  username?: string;
  height?: number;
  loadMode?: "eager" | "nearby";
  variant?: "card" | "fullscreen";
};

const PRELOAD_ROOT_MARGIN = "1200px 0px";
const NEARBY_WARMUP_LIMIT = 3;
const ACTIVE_THRESHOLD_STEPS = [0, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 1];
const MIN_ACTIVE_RATIO = 0.2;
const INACTIVE_UNLOAD_RATIO = 0.35;
const warmedVideoIds = new Set<string>();
const embedVisibilityRatios = new Map<string, number>();
const activeEmbedSubscribers = new Set<(videoId: string | null) => void>();
let nearbyWarmupCount = 0;
let globalActiveEmbedId: string | null = null;

function getInitialShouldLoadIframe(videoId: string, loadMode: "eager" | "nearby") {
  if (loadMode === "eager") return true;
  if (warmedVideoIds.has(videoId)) return true;
  if (nearbyWarmupCount < NEARBY_WARMUP_LIMIT) {
    nearbyWarmupCount += 1;
    warmedVideoIds.add(videoId);
    return true;
  }
  return false;
}

function notifyActiveEmbedChange(videoId: string | null) {
  activeEmbedSubscribers.forEach((listener) => listener(videoId));
}

function setGlobalActiveEmbed(videoId: string | null) {
  if (globalActiveEmbedId === videoId) return;
  globalActiveEmbedId = videoId;
  notifyActiveEmbedChange(videoId);
}

function recomputeGlobalActiveEmbed() {
  let nextActiveId: string | null = null;
  let highestRatio = MIN_ACTIVE_RATIO;

  embedVisibilityRatios.forEach((ratio, videoId) => {
    if (ratio > highestRatio) {
      highestRatio = ratio;
      nextActiveId = videoId;
    }
  });

  setGlobalActiveEmbed(nextActiveId);
}

function TikTokEmbed({
  videoId,
  embedInstanceId,
  username,
  height,
  loadMode = "eager",
  variant = "card",
}: Props) {
  const instanceId = embedInstanceId ?? videoId;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [dynamicHeight, setDynamicHeight] = useState(760);
  const [visibilityRatio, setVisibilityRatio] = useState(0);
  const [activeEmbedId, setActiveEmbedId] = useState<string | null>(globalActiveEmbedId);
  const [hasBeenActive, setHasBeenActive] = useState(false);
  const [shouldLoadIframe, setShouldLoadIframe] = useState(() =>
    getInitialShouldLoadIframe(videoId, loadMode)
  );

  useEffect(() => {
    setVisibilityRatio(0);
    setHasBeenActive(false);
    setShouldLoadIframe(getInitialShouldLoadIframe(videoId, loadMode));
  }, [instanceId, videoId, loadMode]);

  useEffect(() => {
    if (shouldLoadIframe) {
      warmedVideoIds.add(videoId);
    }
  }, [shouldLoadIframe, videoId]);

  useEffect(() => {
    if (height) return;

    function updateHeight() {
      if (!wrapRef.current) return;

      let nextHeight = 760;

      if (variant === "fullscreen") {
        nextHeight = wrapRef.current.offsetHeight || window.innerHeight;
      } else {
        const width = wrapRef.current.offsetWidth;
        nextHeight = Math.round(width * 1.62 + 105);

        if (nextHeight < 640) nextHeight = 640;
        if (nextHeight > 820) nextHeight = 820;
      }

      setDynamicHeight(nextHeight);
    }

    updateHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    if (wrapRef.current) {
      resizeObserver.observe(wrapRef.current);
    }

    window.addEventListener("resize", updateHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [height, variant]);

  useEffect(() => {
    function handleActiveEmbedChange(nextActiveEmbedId: string | null) {
      setActiveEmbedId(nextActiveEmbedId);
    }

    activeEmbedSubscribers.add(handleActiveEmbedChange);

    return () => {
      activeEmbedSubscribers.delete(handleActiveEmbedChange);
    };
  }, []);

  useEffect(() => {
    if (!wrapRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry) return;

        const nextRatio = entry.isIntersecting ? entry.intersectionRatio : 0;
        setVisibilityRatio(nextRatio);
        embedVisibilityRatios.set(instanceId, nextRatio);
        recomputeGlobalActiveEmbed();
      },
      {
        threshold: ACTIVE_THRESHOLD_STEPS,
      }
    );

    observer.observe(wrapRef.current);

    return () => {
      observer.disconnect();
      embedVisibilityRatios.delete(instanceId);
      recomputeGlobalActiveEmbed();
    };
  }, [instanceId]);

  useEffect(() => {
    if (activeEmbedId === instanceId) {
      setHasBeenActive(true);
    }
  }, [activeEmbedId, instanceId]);

  useEffect(() => {
    if (loadMode === "eager") {
      setShouldLoadIframe(true);
      return;
    }

    if (shouldLoadIframe || !wrapRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry) return;

        if (entry.isIntersecting) {
          warmedVideoIds.add(videoId);
          setShouldLoadIframe(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: PRELOAD_ROOT_MARGIN,
        threshold: 0.01,
      }
    );

    observer.observe(wrapRef.current);

    return () => {
      observer.disconnect();
    };
  }, [loadMode, shouldLoadIframe, videoId]);

  const finalHeight = height ?? dynamicHeight;
  const isActiveEmbed = activeEmbedId === instanceId;
  const shouldRenderIframe =
    shouldLoadIframe &&
    (!hasBeenActive || isActiveEmbed || visibilityRatio >= INACTIVE_UNLOAD_RATIO);

  const src = `https://www.tiktok.com/embed/v2/${videoId}?autoplay=1`;

  const link = username
  ? `https://www.tiktok.com/@${username}/video/${videoId}`
  : `https://www.tiktok.com/video/${videoId}`;


  const isFullscreen = variant === "fullscreen";

  return (
    <div
      ref={wrapRef}
      className={isFullscreen ? "for-you-tiktok-embed h-full w-full" : undefined}
      style={{
        width: "100%",
        height: isFullscreen ? "100%" : undefined,
        margin: isFullscreen ? "0" : "0 auto",
        borderRadius: isFullscreen ? 0 : 16,
        overflow: "hidden",
        backgroundColor: isFullscreen ? "transparent" : "#f6efe3",
        padding: isFullscreen ? 0 : 8,
        boxSizing: "border-box",
      }}
    >
      {shouldRenderIframe ? (
        <iframe
          key={instanceId}
          src={src}
          width="100%"
          height={finalHeight}
          scrolling="no"
          loading="eager"
          style={{
            border: "none",
            display: "block",
            overflow: "hidden",
            background: "transparent",
            borderRadius: isFullscreen ? 0 : 12,
            width: "100%",
            height: isFullscreen ? "100%" : finalHeight,
            maxWidth: "none",
          }}
          allow="autoplay; encrypted-media"
          allowFullScreen
          title={`TikTok video ${instanceId}`}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: finalHeight,
            borderRadius: isFullscreen ? 0 : 12,
            background:
              variant === "fullscreen"
                ? "linear-gradient(180deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.92) 100%)"
                : "linear-gradient(180deg, rgba(15,59,46,0.18) 0%, rgba(15,59,46,0.08) 100%)",
            position: "relative",
          }}
          aria-hidden="true"
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.16) 50%, transparent 100%)",
              transform: "translateX(-100%)",
              animation: "jt-tiktok-shimmer 1.3s ease-in-out infinite",
            }}
          />
        </div>
      )}

      {!isFullscreen ? (
        <div
          style={{
            marginTop: 8,
            textAlign: "center",
            backgroundColor: "#0f3b2e",
            borderRadius: 12,
            padding: "10px 12px",
          }}
        >
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 13,
              opacity: 1,
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Auf TikTok öffnen
          </a>
        </div>
      ) : null}
    </div>
  );
}

export default memo(TikTokEmbed);
