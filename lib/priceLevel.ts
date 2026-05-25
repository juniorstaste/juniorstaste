export function getPriceLevelValue(value: number | string | null | undefined, max = 4) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(max, Math.round(value)));
  }

  if (typeof value === "string") {
    const euroCount = (value.match(/€/g) ?? []).length;
    if (euroCount > 0) return Math.max(0, Math.min(max, euroCount));

    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return Math.max(0, Math.min(max, Math.round(numeric)));
    }
  }

  return 0;
}
