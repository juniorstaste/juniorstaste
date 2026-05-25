"use client";

type Props = {
  value: number | null | undefined; // z.B. 4.2
  size?: number; // px
  showNumber?: boolean; // zeigt "4.2" daneben
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function roundToHalf(n: number) {
  return Math.round(n * 2) / 2;
}

export default function StarRating({ value, size = 14, showNumber = true }: Props) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;

  const v = clamp(value, 0, 5);
  const r = roundToHalf(v);

  const full = Math.floor(r);
  const half = r % 1 === 0.5 ? 1 : 0;
  const empty = 5 - full - half;

  const starStyle: React.CSSProperties = {
    fontSize: size,
    lineHeight: 1,
    display: "inline-block",
  };

  const gradientTextStyle: React.CSSProperties = {
    background: "linear-gradient(90deg, rgb(255, 124, 144) 0%, rgb(255, 225, 164) 100%)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  };

  const emptyStarStyle: React.CSSProperties = {
    ...starStyle,
    color: "rgba(255,255,255,0.25)",
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
        {/* volle Sterne */}
        {Array.from({ length: full }).map((_, i) => (
          <span key={`f${i}`} style={{ ...starStyle, ...gradientTextStyle }}>★</span>
        ))}

        {/* halber Stern */}
        {half ? (
          <span
            style={{
              ...starStyle,
              position: "relative",
              width: size,
              display: "inline-block",
            }}
          >
            {/* grauer Stern */}
            <span style={emptyStarStyle}>★</span>

            {/* gradient Hälfte */}
            <span
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "50%",
                overflow: "hidden",
                ...gradientTextStyle,
              }}
            >
              ★
            </span>
          </span>
        ) : null}

        {/* leere Sterne */}
        {Array.from({ length: empty }).map((_, i) => (
          <span key={`e${i}`} style={emptyStarStyle}>★</span>
        ))}
      </span>

      {showNumber ? (
        <span style={{ fontSize: size - 1, ...gradientTextStyle }}>
          {v.toFixed(1)}
        </span>
      ) : null}
    </span>
  );
}
