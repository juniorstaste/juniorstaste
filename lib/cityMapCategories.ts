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
