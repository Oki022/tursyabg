import { supabase } from "@/integrations/supabase/client";

const BUCKET = "avatars";
const SIZE = 400;
const MAX_BYTES = 2 * 1024 * 1024;

/** Изрязва снимката в квадрат и я смалява до 400x400 още в браузъра. */
export async function cropToSquare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("IMAGE_UNSUPPORTED");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.86),
  );
  if (!blob) throw new Error("IMAGE_UNSUPPORTED");
  return blob;
}

/** Качва нова профилна снимка и връща публичния път в хранилището. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("IMAGE_UNSUPPORTED");
  if (file.size > 12 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE");

  const blob = await cropToSquare(file);
  if (blob.size > MAX_BYTES) throw new Error("IMAGE_TOO_LARGE");

  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return path;
}

/** Превръща запазения път в адрес за показване (абсолютните адреси минават директно). */
export async function resolveAvatarUrl(path?: string | null): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl ?? null;
}
