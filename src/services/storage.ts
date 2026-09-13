import { supabase } from "@/integrations/supabase/client";
import { signR2Urls, deleteR2Object } from "@/lib/storage.functions";
import { uploadModeratedTaskImage } from "@/lib/moderation.functions";

const BUCKET = "task-images";
const TTL_SECONDS = 60 * 60 * 24;

/** Stored R2 paths carry this prefix so we always know which backend owns them. */
export const R2_PREFIX = "r2:";

export function isR2Path(path: string) {
  return path.startsWith(R2_PREFIX);
}

/**
 * Single source of truth for resolving stored image paths to displayable URLs.
 * Handles three shapes: absolute URLs, Cloudflare R2 keys (r2:...) and legacy
 * Supabase Storage paths. New uploads go to R2; old ones keep working.
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
  const r2Keys: string[] = [];

  for (const p of paths) {
    if (!p) continue;
    if (p.startsWith("http")) map[p] = p;
    else if (isR2Path(p)) {
      const key = p.slice(R2_PREFIX.length);
      if (!r2Keys.includes(key)) r2Keys.push(key);
    } else if (!toSign.includes(p)) toSign.push(p);
  }

  await Promise.all([
    (async () => {
      if (toSign.length === 0) return;
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(toSign, TTL_SECONDS);
      if (error || !data) return;
      data.forEach((entry, i) => {
        const path = entry.path ?? toSign[i];
        if (entry.signedUrl && path) map[path] = entry.signedUrl;
      });
    })(),
    (async () => {
      if (r2Keys.length === 0) return;
      try {
        const { urls, failed } = await signR2Urls({ data: { keys: r2Keys } });
        for (const [key, url] of Object.entries(urls)) map[`${R2_PREFIX}${key}`] = url;
        if (failed.length > 0) {
          const error = new Error(`R2 signing failed for ${failed.length} image(s)`);
          console.error(error, failed);
          captureIssue({ area: "api", action: "resolve r2 image urls", error, extra: { failed } });
        }
      } catch (error) {
        console.error("R2 signing request failed", error);
        captureIssue({ area: "api", action: "resolve r2 image urls", error });
      }
    })(),
  ]);

  return map;
}

/**
 * Uploads a task photo. The server function moderates the file first and then
 * stores it in R2 when credentials are configured, in Supabase Storage otherwise.
 */
export async function uploadTaskImage(input: { taskId: string; index: number; dataUrl: string }) {
  return uploadModeratedTaskImage({ data: input });
}

/** Deletes a stored image from whichever backend owns it. */
export async function deleteImage(path: string): Promise<void> {
  if (!path || path.startsWith("http")) return;
  if (isR2Path(path)) {
    await deleteR2Object({ data: { key: path.slice(R2_PREFIX.length) } });
    return;
  }
  await supabase.storage.from(BUCKET).remove([path]);
}
