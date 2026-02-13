"use client";

type Props = {
  value: number | null | undefined; // 1..4 (oder null)
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function PriceLevel({ value }: Props) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;

  const v = clamp(Math.round(value), 1, 4);
  const euros = "€".repeat(v);

  return (
    <span
      style={{
        fontWeight: 800,
        letterSpacing: 0.2,
        color: "#111",
      }}
      aria-label={`Preisniveau ${v} von 4`}
      title={`Preisniveau: ${euros}`}
    >
      {euros}
    </span>
  );
}