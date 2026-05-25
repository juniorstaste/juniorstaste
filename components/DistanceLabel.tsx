"use client";

type Props = {
  km: number | null | undefined;
  className?: string;
};

export default function DistanceLabel({ km, className }: Props) {
  if (typeof km !== "number" || Number.isNaN(km)) return null;

  // 1 Dezimalstelle, deutsches Komma
  const text = km.toFixed(1).replace(".", ",");

  return (
    <span
      className={className}
      style={{ fontSize: 13, color: className ? undefined : "#666" }}
    >
      {text} km entfernt
    </span>
  );
}
