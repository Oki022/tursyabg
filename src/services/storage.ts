import { supabase } from "@/integrations/supabase/client";

const BUCKET = "task-images";
const TTL_SECONDS = 60 * 60 * 24;

/**
 * Single source of truth for resolving stored image paths to displayable URLs.
 * Swap the implementation here (CDN / R2) without touching any component.
 */
export async function getImageUrl(path: string | null | undefined): Promise<string | null> {
  const [url] = await getImageUrls(path ? [path] : []);
  return url ?? null;
}

export async function getImageUrls(paths: string[]): Promise<string[]> {
  const map = await resolveImageUrls(paths);
  return paths.map((p) => map[p]).filter(Boolean) as string[];
}

/** Batch resolver: returns a path -> url map (absolute URLs pass through). */
export async function resolveImageUrls(paths: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const toSign: string[] = [];

  for (const p of paths) {
    if (!p) continue;
    if (p.startsWith("http")) map[p] = p;
    else if (!toSign.includes(p)) toSign.push(p);
  }
  if (toSign.length === 0) return map;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(toSign, TTL_SECONDS);
  if (error || !data) return map;

  data.forEach((entry, i) => {
    const path = entry.path ?? toSign[i];
    if (entry.signedUrl && path) map[path] = entry.signedUrl;
  });
  return map;
}
