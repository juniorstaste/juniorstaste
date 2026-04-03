"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  videoId: string;
  username?: string;
  height?: number;
  loadMode?: "eager" | "nearby";
};

export default function TikTokEmbed({
  videoId,
  username,
  height,
  loadMode = "eager",
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [dynamicHeight, setDynamicHeight] = useState(760);
  const [shouldLoadIframe, setShouldLoadIframe] = useState(loadMode === "eager");

  useEffect(() => {
    if (height) return;

    function updateHeight() {
      if (!wrapRef.current) return;

      const width = wrapRef.current.offsetWidth;

      let nextHeight = Math.round(width * 1.62 + 105);

      if (nextHeight < 640) nextHeight = 640;
      if (nextHeight > 820) nextHeight = 820;

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
  }, [height]);

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
          setShouldLoadIframe(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "700px 0px",
        threshold: 0.01,
      }
    );

    observer.observe(wrapRef.current);

    return () => {
      observer.disconnect();
    };
  }, [loadMode, shouldLoadIframe]);

  const finalHeight = height ?? dynamicHeight;

  const src = `https://www.tiktok.com/embed/v2/${videoId}?autoplay=1`;

  const link = username
  ? `https://www.tiktok.com/@${username}/video/${videoId}`
  : `https://www.tiktok.com/video/${videoId}`;


  return (
    <div
      ref={wrapRef}
      style={{
        width: "100%",
        margin: "0 auto",
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: "#f6efe3",
        padding: 8,
        boxSizing: "border-box",
      }}
    >
      {shouldLoadIframe ? (
        <iframe
          src={src}
          width="100%"
          height={finalHeight}
          scrolling="no"
          loading={loadMode === "nearby" ? "lazy" : "eager"}
          style={{
            border: "none",
            display: "block",
            overflow: "hidden",
            background: "transparent",
            borderRadius: 12,
          }}
          allow="autoplay; encrypted-media"
          allowFullScreen
          title={`TikTok video ${videoId}`}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: finalHeight,
            borderRadius: 12,
            background:
              "linear-gradient(180deg, rgba(15,59,46,0.14) 0%, rgba(15,59,46,0.06) 100%)",
          }}
          aria-hidden="true"
        />
      )}

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
    </div>
  );
}
