type SpotWithName = {
  name?: string | null;
};

const PRIORITY_SPOT_NAME = "bun'n smash";

function normalizeApostrophes(value: string) {
  return value.replace(/['`´‘’]/g, "'");
}

export function normalizeSpotName(value?: string | null) {
  if (!value) return "";

  return normalizeApostrophes(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function isPrioritySpot(spot: SpotWithName) {
  return normalizeSpotName(spot.name) === PRIORITY_SPOT_NAME;
}

export function prioritizeSpots<T extends SpotWithName>(spots: T[]) {
  if (spots.length === 0) return spots;

  const priority: T[] = [];
  const rest: T[] = [];

  spots.forEach((spot) => {
    if (isPrioritySpot(spot)) {
      priority.push(spot);
      return;
    }

    rest.push(spot);
  });

  if (priority.length === 0) return spots;

  return [...priority, ...rest];
}
