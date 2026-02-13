"use client";

type Props = {
  videoId: string;
  username?: string; // optional, nur für Direktlink
  height?: number;   // optional, default 520
};

export default function TikTokEmbed({
  videoId,
  username,
  height = 520,
}: Props) {
  if (!videoId) return null;

  const iframeSrc = `https://www.tiktok.com/embed/v2/${videoId}`;

  const tiktokUrl = username
    ? `https://www.tiktok.com/@${username}/video/${videoId}`
    : `https://www.tiktok.com/video/${videoId}`;

  return (
    <div style={{ width: "100%" }}>
      {/* Video */}
      <div
        style={{
          width: "100%",
          border: "1px solid #ddd",
          borderRadius: 12,
          overflow: "hidden",
          background: "#000",
        }}
      >
        <iframe
          src={iframeSrc}
          style={{
            width: "100%",
            height,
            border: "none",
            display: "block",
          }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          title={`TikTok video ${videoId}`}
        />
      </div>

      {/* Direktlink */}
      <div style={{ marginTop: 8 }}>
        <a
          href={tiktokUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 13,
            color: "#555",
            textDecoration: "none",
          }}
        >
          Auf TikTok öffnen
        </a>
      </div>
    </div>
  );
}