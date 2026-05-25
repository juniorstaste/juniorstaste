const CATEGORY_COLORS: Record<string, string> = {
  burger: "#e11d48",
  pizza: "#f97316",
  coffee: "#a16207",
  "fruehstueck-kaffee": "#b45309",
  breakfast: "#b45309",
  dessert: "#db2777",
  chicken: "#ca8a04",
  "fried-chicken": "#ca8a04",
  doener: "#0f766e",
  "döner": "#0f766e",
  doner: "#0f766e",
  kebab: "#0f766e",
  vegan: "#22c55e",
  asian: "#2563eb",
  italian: "#16a34a",
  sushi: "#0891b2",
  mexican: "#ea580c",
  pasta: "#15803d",
  bakery: "#c2410c",
  sandwiches: "#7c3aed",
  bowls: "#0d9488",
  icecream: "#ec4899",
  other: "#475569",
};

const FALLBACK_CATEGORY_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
];

export function normalizeCategorySlug(slug?: string | null) {
  return (slug ?? "other").toString().trim().toLowerCase();
}

export function getCategoryGroupKey(slug?: string | null) {
  const normalizedSlug = normalizeCategorySlug(slug);

  if (["döner", "doner", "doener", "kebab", "doener-kebab"].includes(normalizedSlug)) {
    return "doener";
  }
  if (
    [
      "kaffee-fruehstueck-dessert",
      "kaffee-fruhstuck-dessert",
      "fruehstueck-kaffee",
      "fruhstuck-kaffee",
      "coffee",
      "breakfast",
      "dessert",
    ].includes(normalizedSlug)
  ) {
    return "kaffee-fruehstueck-dessert";
  }
  if (["tacos-burrito", "tacos-burritos", "mexican"].includes(normalizedSlug)) {
    return "tacos-burritos";
  }
  if (["fried-chicken", "chicken"].includes(normalizedSlug)) {
    return "fried-chicken";
  }

  return normalizedSlug;
}

export function categorySlugsMatch(a?: string | null, b?: string | null) {
  return getCategoryGroupKey(a) === getCategoryGroupKey(b);
}

export function getCategoryDisplayName(slug?: string | null) {
  const groupKey = getCategoryGroupKey(slug);

  if (groupKey === "all") return "Alle";
  if (groupKey === "burger") return "Burger";
  if (groupKey === "fried-chicken") return "Fried Chicken";
  if (groupKey === "doener") return "Döner";
  if (groupKey === "kaffee-fruehstueck-dessert") return "Kaffee / Frühstück / Dessert";
  if (groupKey === "pizza") return "Pizza";
  if (groupKey === "asian") return "Asian";
  if (groupKey === "tacos-burritos") return "Tacos / Burritos";
  if (groupKey === "orientalisch") return "Orientalisch";

  return labelFromCategorySlug(groupKey);
}

function colorFromSlugHash(slug: string) {
  const hash = Array.from(slug).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return FALLBACK_CATEGORY_COLORS[hash % FALLBACK_CATEGORY_COLORS.length];
}

export function getColorForCategory(slug?: string | null) {
  const s = normalizeCategorySlug(slug);
  return CATEGORY_COLORS[s] ?? colorFromSlugHash(s);
}

export function labelFromCategorySlug(slug: string) {
  if (!slug) return "Other";
  if (["döner", "doner", "doener", "kebab"].includes(slug)) return "Döner/Kebab";
  if (slug === "fruehstueck-kaffee") return "Frühstück / Kaffee";
  if (slug === "fried-chicken") return "Fried Chicken";
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}
