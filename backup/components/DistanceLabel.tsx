"use client";

type Props = {
  km: number | null | undefined;
};

export default function DistanceLabel({ km }: Props) {
  if (typeof km !== "number" || Number.isNaN(km)) return null;

  // 1 Dezimalstelle, deutsches Komma
  const text = km.toFixed(1).replace(".", ",");

  return (
    <span style={{ fontSize: 13, color: "#666" }}>
      {text} km entfernt
    </span>
  );
}