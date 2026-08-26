import { slugify } from "@/lib/geo";

export type Region = { id: string; name: string; slug: string };

export type Municipality = {
  id: string;
  name: string;
  slug: string;
  hasNeighborhoods: boolean;
  lat: number | null;
  lng: number | null;
  regionName: string;
  regionSlug: string;
};

export type Neighborhood = { id: string; name: string; slug: string };

/**
 * Search key: Bulgarian text and Latin transliteration collapse to the same
 * form, so "smyadovo", "Смядово" и "СМЯДОВО" all match the same община.
 */
export function searchKey(input: string): string {
  return slugify(
    input
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\bкв\.?\b/gi, " "),
  ).replace(/-/g, "");
}

/** Free-text match over the община name and its област, ranked by prefix hits. */
export function rankMunicipalities(list: Municipality[], query: string): Municipality[] {
  const q = searchKey(query);
  if (!q) return list;
  const scored: { m: Municipality; score: number }[] = [];
  for (const m of list) {
    const name = searchKey(m.name);
    const region = searchKey(m.regionName);
    let score = -1;
    if (name.startsWith(q)) score = 0;
    else if (name.includes(q)) score = 1;
    else if (region.startsWith(q)) score = 2;
    else if (region.includes(q)) score = 3;
    if (score >= 0) scored.push({ m, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.m.name.localeCompare(b.m.name, "bg"))
    .map((s) => s.m);
}

/** Location strings stay "Община" or "Община, кв. Х" so existing tasks keep working. */
export function buildLocation(city: string, neighborhood?: string | null): string {
  return neighborhood ? `${city}, ${neighborhood}` : city;
}

export function splitLocation(value?: string): { city?: string; neighborhood?: string } {
  const [city, neighborhood] = (value ?? "").split(",").map((s) => s.trim());
  return { ...(city ? { city } : {}), ...(neighborhood ? { neighborhood } : {}) };
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Straight-line distance in km, good enough to pick the nearest община. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearestMunicipality(
  list: Municipality[],
  point: { lat: number; lng: number },
): Municipality | undefined {
  let best: Municipality | undefined;
  let bestDist = Infinity;
  for (const m of list) {
    if (m.lat == null || m.lng == null) continue;
    const d = distanceKm(point, { lat: m.lat, lng: m.lng });
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}
