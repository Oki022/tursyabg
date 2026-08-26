import { categories } from "@/lib/mock-data";

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

export const categoryList = categories;

export function findCategoryBySlug(slug: string) {
  return categories.find((c) => c.id === slug);
}
