export const LAST_CITY_SLUG_KEY = "last_city_slug";
export const LAST_CITY_VIEW_KEY = "last_city_view";
export const LAST_CITY_FALLBACK_SLUG = "stuttgart";

export type CityTabView = "list" | "map" | "tasteDesMonats";

export function isCityTabView(value: string | null | undefined): value is CityTabView {
  return value === "list" || value === "map" || value === "tasteDesMonats";
}

export function buildCityViewHref(citySlug: string, view: CityTabView) {
  if (view === "list") return `/city/${citySlug}`;
  return `/city/${citySlug}?view=${encodeURIComponent(view)}`;
}
