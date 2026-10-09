export type ForYouRankableSpot = {
  id: string;
  category_id?: string | null;
  city_id?: string | null;
};

export type ForYouRankingInput<T extends ForYouRankableSpot> = {
  spots: readonly T[];
  likedSpotIds?: Iterable<string>;
  savedSpotIds?: Iterable<string>;
  viewedSpotIds?: Iterable<string>;
  globalLikeCounts?: Readonly<Record<string, number | null | undefined>>;
  globalSaveCounts?: Readonly<Record<string, number | null | undefined>>;
  seed: string;
};

export const FOR_YOU_RANKING_WEIGHTS = {
  likedCategoryPerInteraction: 5,
  likedCategoryMax: 20,
  savedCategoryPerInteraction: 8,
  savedCategoryMax: 32,
  likedCityPerInteraction: 1,
  likedCityMax: 4,
  savedCityPerInteraction: 1.5,
  savedCityMax: 6,
  globalLikeLogMultiplier: 2.5,
  globalLikeMax: 10,
  globalSaveLogMultiplier: 4,
  globalSaveMax: 16,
  stableRandomMax: 14,
  viewedPenalty: 22,
  knownSpotPenalty: 120,
  diversityMaxScoreDrop: 10,
} as const;

type PreferenceCounts = {
  likedCategories: Map<string, number>;
  savedCategories: Map<string, number>;
  likedCities: Map<string, number>;
  savedCities: Map<string, number>;
};

type RankedSpot<T> = {
  spot: T;
  score: number;
  stableRandom: number;
};

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createSeededRandom(seed: string) {
  let state = hashString(seed) || 0x6d2b79f5;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function increment(map: Map<string, number>, key?: string | null) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

function createPreferenceCounts<T extends ForYouRankableSpot>(
  spots: readonly T[],
  likedSpotIds: Set<string>,
  savedSpotIds: Set<string>
): PreferenceCounts {
  const counts: PreferenceCounts = {
    likedCategories: new Map(),
    savedCategories: new Map(),
    likedCities: new Map(),
    savedCities: new Map(),
  };

  spots.forEach((spot) => {
    if (likedSpotIds.has(spot.id)) {
      increment(counts.likedCategories, spot.category_id);
      increment(counts.likedCities, spot.city_id);
    }

    if (savedSpotIds.has(spot.id)) {
      increment(counts.savedCategories, spot.category_id);
      increment(counts.savedCities, spot.city_id);
    }
  });

  return counts;
}

export function calculatePreferenceScore(
  spot: ForYouRankableSpot,
  preferences: PreferenceCounts
) {
  const weights = FOR_YOU_RANKING_WEIGHTS;
  const likedCategoryCount = spot.category_id
    ? preferences.likedCategories.get(spot.category_id) ?? 0
    : 0;
  const savedCategoryCount = spot.category_id
    ? preferences.savedCategories.get(spot.category_id) ?? 0
    : 0;
  const likedCityCount = spot.city_id ? preferences.likedCities.get(spot.city_id) ?? 0 : 0;
  const savedCityCount = spot.city_id ? preferences.savedCities.get(spot.city_id) ?? 0 : 0;

  return (
    Math.min(
      weights.likedCategoryMax,
      likedCategoryCount * weights.likedCategoryPerInteraction
    ) +
    Math.min(
      weights.savedCategoryMax,
      savedCategoryCount * weights.savedCategoryPerInteraction
    ) +
    Math.min(weights.likedCityMax, likedCityCount * weights.likedCityPerInteraction) +
    Math.min(weights.savedCityMax, savedCityCount * weights.savedCityPerInteraction)
  );
}

function safeCount(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function calculatePopularityScore(likeCount?: number | null, saveCount?: number | null) {
  const weights = FOR_YOU_RANKING_WEIGHTS;
  const likeScore = Math.min(
    weights.globalLikeMax,
    Math.log1p(safeCount(likeCount)) * weights.globalLikeLogMultiplier
  );
  const saveScore = Math.min(
    weights.globalSaveMax,
    Math.log1p(safeCount(saveCount)) * weights.globalSaveLogMultiplier
  );

  return likeScore + saveScore;
}

export function calculateKnownSpotPenalty({
  isLiked,
  isSaved,
  isViewed,
}: {
  isLiked: boolean;
  isSaved: boolean;
  isViewed: boolean;
}) {
  if (isLiked || isSaved) return FOR_YOU_RANKING_WEIGHTS.knownSpotPenalty;
  if (isViewed) return FOR_YOU_RANKING_WEIGHTS.viewedPenalty;
  return 0;
}

function diversifyRankedSpots<T extends ForYouRankableSpot>(ranked: RankedSpot<T>[]) {
  const diversified = [...ranked];

  for (let index = 1; index < diversified.length; index += 1) {
    const previousCategory = diversified[index - 1].spot.category_id;
    if (!previousCategory || diversified[index].spot.category_id !== previousCategory) continue;

    const replacementIndex = diversified.findIndex((candidate, candidateIndex) => {
      if (candidateIndex <= index) return false;
      if (!candidate.spot.category_id || candidate.spot.category_id === previousCategory) return false;
      return diversified[index].score - candidate.score <= FOR_YOU_RANKING_WEIGHTS.diversityMaxScoreDrop;
    });

    if (replacementIndex > index) {
      const [replacement] = diversified.splice(replacementIndex, 1);
      diversified.splice(index, 0, replacement);
    }
  }

  return diversified;
}

export function rankForYouSpots<T extends ForYouRankableSpot>({
  spots,
  likedSpotIds = [],
  savedSpotIds = [],
  viewedSpotIds = [],
  globalLikeCounts = {},
  globalSaveCounts = {},
  seed,
}: ForYouRankingInput<T>): T[] {
  const liked = new Set(likedSpotIds);
  const saved = new Set(savedSpotIds);
  const viewed = new Set(viewedSpotIds);
  const preferences = createPreferenceCounts(spots, liked, saved);

  const ranked = spots.map((spot) => {
    const stableRandom = createSeededRandom(`${seed}:${spot.id}`)();
    const preferenceScore = calculatePreferenceScore(spot, preferences);
    const popularityScore = calculatePopularityScore(
      globalLikeCounts[spot.id],
      globalSaveCounts[spot.id]
    );
    const knownPenalty = calculateKnownSpotPenalty({
      isLiked: liked.has(spot.id),
      isSaved: saved.has(spot.id),
      isViewed: viewed.has(spot.id),
    });

    return {
      spot,
      stableRandom,
      score:
        preferenceScore +
        popularityScore +
        stableRandom * FOR_YOU_RANKING_WEIGHTS.stableRandomMax -
        knownPenalty,
    };
  });

  ranked.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (right.stableRandom !== left.stableRandom) return right.stableRandom - left.stableRandom;
    return left.spot.id.localeCompare(right.spot.id);
  });

  return diversifyRankedSpots(ranked).map(({ spot }) => spot);
}
