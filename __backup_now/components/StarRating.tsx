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

  const GOLD = "#facc15";   // ⭐ gold
  const EMPTY = "#d1d5db";  // grau

  const starStyle: React.CSSProperties = {
    fontSize: size,
    lineHeight: 1,
    display: "inline-block",
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
        {/* volle Sterne */}
        {Array.from({ length: full }).map((_, i) => (
          <span key={`f${i}`} style={{ ...starStyle, color: GOLD }}>★</span>
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
            <span style={{ color: EMPTY }}>★</span>

            {/* goldene Hälfte */}
            <span
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "50%",
                overflow: "hidden",
                color: GOLD,
              }}
            >
              ★
            </span>
          </span>
        ) : null}

        {/* leere Sterne */}
        {Array.from({ length: empty }).map((_, i) => (
          <span key={`e${i}`} style={{ ...starStyle, color: EMPTY }}>★</span>
        ))}
      </span>

      {showNumber ? (
        <span style={{ fontSize: size - 1, color: "#555" }}>
          {v.toFixed(1)}
        </span>
      ) : null}
    </span>
  );
}