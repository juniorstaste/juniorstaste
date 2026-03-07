"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  videoId: string;
  username?: string;
  height?: number; // optional override
};

export default function TikTokEmbed({ videoId, username, height }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [dynamicHeight, setDynamicHeight] = useState(760);

  useEffect(() => {
    if (height) return;

    function updateHeight() {
      if (!wrapRef.current) return;

      const width = wrapRef.current.offsetWidth;

      // ✅ Breiter auf Mobile, aber nicht unnötig hoch
      // Formel:
      // Video-Anteil + kompakter Caption-Zuschlag
      let nextHeight = Math.round(width * 1.62 + 105);

      // Kleine Sicherheitsgrenzen
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
        maxWidth: 420, // ✅ breiter als vorher
        margin: "0 auto",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <iframe
        src={src}
        width="100%"
        height={finalHeight}
        scrolling="no"
        style={{
          border: "none",
          display: "block",
          overflow: "hidden",
        }}
        allow="autoplay; encrypted-media"
        allowFullScreen
        title={`TikTok video ${videoId}`}
      />

      <div style={{ marginTop: 6, textAlign: "center" }}>
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 13,
            opacity: 0.8,
          }}
        >
          Auf TikTok öffnen
        </a>
      </div>
    </div>
  );
}