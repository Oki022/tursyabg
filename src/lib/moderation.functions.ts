import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UploadImageResult =
  | { status: "approved"; imageId: string; path: string }
  | { status: "pending"; imageId: string; path: string; category: string | null }
  | { status: "rejected"; category: string | null; score: number };

type Input = { taskId: string; index: number; dataUrl: string };

/**
 * Server-side image pipeline: moderate FIRST, store only when allowed.
 * Rejected files never reach storage; uncertain files are stored but the task
 * is held in 'pending' and queued for a moderator. Provider outage = hold.
 */
export const uploadModeratedTaskImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => {
    if (!input?.taskId || typeof input.dataUrl !== "string") throw new Error("INVALID_INPUT");
    return input;
  })
  .handler(async ({ data, context }): Promise<UploadImageResult> => {
    const { supabase, userId } = context;

    const { data: task } = await supabase
      .from("tasks")
      .select("id, user_id")
      .eq("id", data.taskId)
      .maybeSingle();
    if (!task || task.user_id !== userId) throw new Error("FORBIDDEN");

    const base64 = data.dataUrl.includes(",") ? data.dataUrl.split(",")[1]! : data.dataUrl;
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const { moderateImage } = await import("@/services/moderation");
    const verdict = await moderateImage(binary);

    if (verdict.verdict === "reject") {
      return { status: "rejected", category: verdict.category, score: verdict.score };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { reportServerIssue } = await import("@/lib/monitoring/sentry.server");
    const key = `${userId}/${data.taskId}/${Date.now()}-${data.index}.jpg`;

    const uploadToSupabase = async () => {
      const { error: upErr } = await supabaseAdmin.storage
        .from("task-images")
        .upload(key, binary, { contentType: "image/jpeg", upsert: false });
      if (upErr) {
        console.error("Supabase storage upload failed", upErr);
        reportServerIssue({
          area: "api",
          action: "upload task image to supabase storage",
          error: upErr,
          userId,
          extra: { taskId: data.taskId, key },
        });
        throw new Error("UPLOAD_FAILED");
      }
      return key;
    };

    // New uploads go to Cloudflare R2 when configured; otherwise Supabase Storage
    // (local development without R2 credentials). Existing images are untouched.
    const { isR2Configured, r2Upload, r2VerifyReadable, R2_PREFIX } = await import("@/lib/r2.server");
    let path: string;
    if (isR2Configured()) {
      try {
        await r2Upload(key, binary, "image/jpeg");
        // Verify the object is readable now, so a broken R2 setup fails here
        // (visible, recoverable) instead of silently producing blank thumbnails.
        await r2VerifyReadable(key);
        path = `${R2_PREFIX}${key}`;
      } catch (error) {
        console.error("R2 upload failed, falling back to Supabase Storage", error);
        reportServerIssue({
          area: "api",
          action: "upload task image to R2",
          error,
          userId,
          extra: { taskId: data.taskId, key },
        });
        path = await uploadToSupabase();
      }
    } else {
      path = await uploadToSupabase();
    }

    const { data: row, error: insErr } = await supabaseAdmin
      .from("task_images")
      .insert({
        task_id: data.taskId,
        image_url: path,
        sort_order: data.index,
        moderation_status: verdict.verdict === "review" ? "pending" : "approved",
        moderation_score: verdict.score,
        moderation_labels: { ...verdict.labels, category: verdict.category },
        moderation_provider: verdict.provider,
      })
      .select("id")
      .single();
    if (insErr || !row) throw new Error("UPLOAD_FAILED");

    if (verdict.verdict === "review") {
      // Runs as the signed-in owner so the RPC can authorize and hold the task.
      await supabase.rpc("record_image_moderation", {
        _image_id: row.id,
        _status: "pending",
        _score: verdict.score,
        _labels: { ...verdict.labels, category: verdict.category },
        _provider: verdict.provider,
        _unavailable: verdict.unavailable,
      });
      return { status: "pending", imageId: row.id, path, category: verdict.category };
    }

    return { status: "approved", imageId: row.id, path };
  });
