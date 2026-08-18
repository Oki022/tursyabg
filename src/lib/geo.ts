import { locations, categories } from "@/lib/mock-data";

const BG_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
};

/** Latin, URL-safe slug from a Bulgarian string. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => BG_TO_LAT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type City = { name: string; slug: string; neighborhoods: string[] };

/** All cities derived from the location config, so landing pages scale automatically. */
export const cityList: City[] = (() => {
  const map = new Map<string, City>();
  for (const loc of locations) {
    const [city, neighborhood] = loc.split(",").map((s) => s.trim());
    if (!city) continue;
    const existing = map.get(city) ?? { name: city, slug: slugify(city), neighborhoods: [] };
    if (neighborhood) existing.neighborhoods.push(neighborhood);
    map.set(city, existing);
  }
  return [...map.values()];
})();

export function findCityBySlug(slug: string): City | undefined {
  return cityList.find((c) => c.slug === slug);
}

export const categoryList = categories;

export function findCategoryBySlug(slug: string) {
  return categories.find((c) => c.id === slug);
}
