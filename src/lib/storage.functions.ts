import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KEY_RE = /^[A-Za-z0-9/_.-]{3,200}$/;

/**
 * Signs R2 object keys for display. Task photos are publicly visible on the
 * task page, so this is intentionally callable without a session; keys are
 * validated and only ever read.
 */
export const signR2Urls = createServerFn({ method: "POST" })
  .inputValidator((input: { keys: string[] }) => {
    const keys = (input?.keys ?? []).filter((k) => typeof k === "string" && KEY_RE.test(k)).slice(0, 100);
    return { keys };
  })
  .handler(async ({ data }): Promise<Record<string, string>> => {
    if (data.keys.length === 0) return {};
    const { r2SignedUrl } = await import("@/lib/r2.server");
    const out: Record<string, string> = {};
    await Promise.all(
      data.keys.map(async (key) => {
        try {
          out[key] = await r2SignedUrl(key);
        } catch {
          /* missing credentials or object: skip */
        }
      }),
    );
    return out;
  });

/** Deletes one of the caller's own R2 objects (keys are prefixed with the user id). */
export const deleteR2Object = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string }) => {
    if (!input?.key || !KEY_RE.test(input.key)) throw new Error("INVALID_INPUT");
    return input;
  })
  .handler(async ({ data, context }) => {
    if (!data.key.startsWith(`${context.userId}/`)) throw new Error("FORBIDDEN");
    const { r2Delete } = await import("@/lib/r2.server");
    await r2Delete(data.key);
    return { ok: true };
  });
