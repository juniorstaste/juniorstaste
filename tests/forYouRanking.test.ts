import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateKnownSpotPenalty,
  calculatePopularityScore,
  FOR_YOU_RANKING_WEIGHTS,
  rankForYouSpots,
} from "../lib/forYouRanking";

type Spot = { id: string; category_id?: string | null; city_id?: string | null };

const mixedSpots: Spot[] = Array.from({ length: 12 }, (_, index) => ({
  id: `spot-${index}`,
  category_id: `category-${index % 4}`,
  city_id: `city-${index % 3}`,
}));

test("cold start is stable for the same seed and mixed for another seed", () => {
  const first = rankForYouSpots({ spots: mixedSpots, seed: "session-a" }).map(({ id }) => id);
  const repeated = rankForYouSpots({ spots: mixedSpots, seed: "session-a" }).map(({ id }) => id);
  const other = rankForYouSpots({ spots: mixedSpots, seed: "session-b" }).map(({ id }) => id);

  assert.deepEqual(repeated, first);
  assert.notDeepEqual(other, first);
  assert.notDeepEqual(first, mixedSpots.map(({ id }) => id));
});

test("liked and saved spots are moved below unknown spots", () => {
  const ranked = rankForYouSpots({
    spots: mixedSpots,
    likedSpotIds: ["spot-0"],
    savedSpotIds: ["spot-1"],
    seed: "known-penalty",
  });
  const ids = ranked.map(({ id }) => id);

  assert.ok(ids.indexOf("spot-0") >= mixedSpots.length - 2);
  assert.ok(ids.indexOf("spot-1") >= mixedSpots.length - 2);
});

test("liked and saved together use one bounded known penalty", () => {
  const liked = calculateKnownSpotPenalty({ isLiked: true, isSaved: false, isViewed: false });
  const both = calculateKnownSpotPenalty({ isLiked: true, isSaved: true, isViewed: false });

  assert.equal(liked, FOR_YOU_RANKING_WEIGHTS.knownSpotPenalty);
  assert.equal(both, liked);
});

test("matching categories receive a bonus while the known source stays low", () => {
  const spots: Spot[] = [
    { id: "liked-source", category_id: "burger" },
    { id: "burger-match", category_id: "burger" },
    { id: "pizza", category_id: "pizza" },
  ];
  const ranked = rankForYouSpots({ spots, likedSpotIds: ["liked-source"], seed: "category" });

  assert.equal(ranked[0].id, "burger-match");
  assert.equal(ranked.at(-1)?.id, "liked-source");
});

test("multiple saves are a stronger category signal than one like", () => {
  const spots: Spot[] = [
    { id: "liked-source", category_id: "pizza" },
    { id: "saved-a", category_id: "burger" },
    { id: "saved-b", category_id: "burger" },
    { id: "pizza-match", category_id: "pizza" },
    { id: "burger-match", category_id: "burger" },
  ];
  const ranked = rankForYouSpots({
    spots,
    likedSpotIds: ["liked-source"],
    savedSpotIds: ["saved-a", "saved-b"],
    seed: "preference-strength",
  });

  assert.ok(ranked.findIndex(({ id }) => id === "burger-match") < ranked.findIndex(({ id }) => id === "pizza-match"));
});

test("global popularity is moderate, bounded and saves weigh more than likes", () => {
  assert.ok(calculatePopularityScore(0, 3) > calculatePopularityScore(3, 0));
  assert.ok(calculatePopularityScore(100, 100) > calculatePopularityScore(0, 0));
  assert.equal(
    calculatePopularityScore(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
    FOR_YOU_RANKING_WEIGHTS.globalLikeMax + FOR_YOU_RANKING_WEIGHTS.globalSaveMax
  );
});

test("popularity cannot lift a personally known spot above unknown spots", () => {
  const ranked = rankForYouSpots({
    spots: [{ id: "known" }, { id: "unknown-a" }, { id: "unknown-b" }],
    likedSpotIds: ["known"],
    globalLikeCounts: { known: 1_000_000 },
    globalSaveCounts: { known: 1_000_000 },
    seed: "popular-known",
  });

  assert.equal(ranked.at(-1)?.id, "known");
});

test("stable randomness still gives less popular spots a chance near the top", () => {
  const spots = Array.from({ length: 10 }, (_, index) => ({ id: `discovery-${index}` }));
  const popularId = "discovery-0";
  const foundSeed = Array.from({ length: 200 }, (_, index) => `discovery-seed-${index}`).find((seed) => {
    const ranked = rankForYouSpots({
      spots,
      globalLikeCounts: { [popularId]: 1 },
      seed,
    });
    return ranked[0].id !== popularId;
  });

  assert.ok(foundSeed);
});

test("missing optional data is safe and the input list is not mutated", () => {
  const spots: Spot[] = [{ id: "a" }, { id: "b", category_id: null }, { id: "c" }];
  const before = [...spots];

  assert.doesNotThrow(() => rankForYouSpots({ spots, seed: "missing-data" }));
  assert.deepEqual(spots, before);
});

test("diversification avoids an unnecessary same-category run", () => {
  const spots: Spot[] = [
    { id: "burger-a", category_id: "burger" },
    { id: "burger-b", category_id: "burger" },
    { id: "burger-c", category_id: "burger" },
    { id: "pizza-a", category_id: "pizza" },
    { id: "pizza-b", category_id: "pizza" },
  ];
  const ranked = rankForYouSpots({ spots, seed: "diversity" });

  assert.notEqual(ranked[0].category_id, ranked[1].category_id);
});
