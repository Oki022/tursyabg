import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type Task, type TaskStatus } from "@/lib/mock-data";
import { resolveImageUrls } from "@/services/storage";
import { uploadModeratedTaskImage } from "@/lib/moderation.functions";

export const PAGE_SIZE = 20;

type Row = {
  id: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  city: string | null;
  neighborhood: string | null;
  status: TaskStatus;
  unlock_cost?: number | null;
  created_at: string;
  bumped_at?: string;
  status_changed_at?: string;
  view_count?: number;
  unlock_count?: number;
  max_unlocks?: number;
  user_id: string;
  task_images?: { image_url: string; sort_order: number }[] | null;
  profiles?: { full_name: string | null } | null;
};

const SELECT =
  "id, title, description, category, budget, city, neighborhood, status, unlock_cost, created_at, bumped_at, status_changed_at, view_count, unlock_count, max_unlocks, user_id, task_images(image_url, sort_order), profiles(full_name)";

export function timeAgoBg(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "току-що";
  if (min < 60) return `преди ${min} мин.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `преди ${h} ч.`;
  const d = Math.floor(h / 24);
  if (d === 1) return "вчера";
  if (d < 30) return `преди ${d} дни`;
  const m = Math.floor(d / 30);
  return `преди ${m} мес.`;
}

function mapRow(row: Row, signed: Record<string, string>): Task {
  const images = [...(row.task_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const gallery = images
    .map((i) => (i.image_url.startsWith("http") ? i.image_url : signed[i.image_url]))
    .filter(Boolean) as string[];

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    budget: Number(row.budget),
    location: [row.city, row.neighborhood].filter(Boolean).join(", "),
    postedAt: timeAgoBg(row.created_at),
    author: row.profiles?.full_name ?? "Потребител",
    userId: row.user_id,
    status: row.status,
    unlockCost: row.unlock_cost ?? undefined,
    image: gallery[0],
    gallery,
    bumpedAt: row.bumped_at ?? row.created_at,
    viewCount: row.view_count ?? 0,
    unlockCount: row.unlock_count ?? 0,
    maxUnlocks: row.max_unlocks ?? 5,
    createdAtIso: row.created_at,
    statusChangedAtIso: row.status_changed_at ?? row.created_at,
  };
}

async function mapRows(rows: Row[]): Promise<Task[]> {
  const paths = rows.flatMap((r) => (r.task_images ?? []).map((i) => i.image_url)).filter((p) => !p.startsWith("http"));
  const signed = await resolveImageUrls(paths);
  return rows.map((r) => mapRow(r, signed));
}

export type TaskFilters = { q?: string; category?: string; location?: string };

type FeedRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  city: string | null;
  neighborhood: string | null;
  status: TaskStatus;
  unlock_cost: number | null;
  created_at: string;
  bumped_at: string;
  user_id: string;
  author: string | null;
  images: string[] | null;
  is_top: boolean;
  is_urgent: boolean;
  promo_expires_at: string | null;
  promoted_slot: boolean;
  unlock_count: number | null;
  max_unlocks: number | null;
};

/** Stable per-session seed so the promoted rotation stays consistent while paginating. */
function feedSeed(): string {
  if (typeof window === "undefined") return "ssr";
  const key = "feed-seed";
  let seed = window.sessionStorage.getItem(key);
  if (!seed) {
    seed = Math.random().toString(36).slice(2);
    window.sessionStorage.setItem(key, seed);
  }
  return seed;
}

async function mapFeedRows(rows: FeedRow[]): Promise<Task[]> {
  const paths = rows.flatMap((r) => r.images ?? []).filter((p) => !p.startsWith("http"));
  const signed = await resolveImageUrls(paths);
  return rows.map((row) => {
    const gallery = (row.images ?? [])
      .map((p) => (p.startsWith("http") ? p : signed[p]))
      .filter(Boolean) as string[];
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      budget: Number(row.budget),
      location: [row.city, row.neighborhood].filter(Boolean).join(", "),
      postedAt: timeAgoBg(row.bumped_at),
      author: row.author ?? "Потребител",
      userId: row.user_id,
      status: row.status,
      unlockCost: row.unlock_cost ?? undefined,
      image: gallery[0],
      gallery,
      isTop: row.is_top,
      isUrgent: row.is_urgent,
      promoExpiresAt: row.promo_expires_at,
      bumpedAt: row.bumped_at,
      unlockCount: row.unlock_count ?? 0,
      maxUnlocks: row.max_unlocks ?? 5,
    } satisfies Task;
  });
}

type FeedCursor = { cursor?: string; promoOffset: number };

/** Server-side ordering: rotating promoted slots first (max 4), then tasks by bumped_at DESC. */
async function fetchTasksPage({
  page,
  filters,
}: {
  page: FeedCursor;
  filters: TaskFilters;
}): Promise<{ items: Task[]; nextCursor?: FeedCursor }> {
  const [city, neighborhood] = (filters.location ?? "").split(",").map((s) => s.trim());

  const { data, error } = await supabase.rpc("feed_tasks", {
    _limit: PAGE_SIZE,
    ...(page.cursor ? { _cursor: page.cursor } : {}),
    _seed: feedSeed(),
    _promo_offset: page.promoOffset,
    ...(filters.category ? { _category: filters.category } : {}),
    ...(city ? { _city: city } : {}),
    ...(neighborhood ? { _neighborhood: neighborhood } : {}),
    ...(filters.q ? { _q: filters.q } : {}),
  });
  if (error) throw error;

  const rows = (data ?? []) as unknown as FeedRow[];
  const items = await mapFeedRows(rows);
  const normal = rows.filter((r) => !r.promoted_slot);
  const promoted = rows.length - normal.length;
  const last = normal[normal.length - 1];

  return {
    items,
    nextCursor:
      normal.length === PAGE_SIZE && last
        ? { cursor: last.bumped_at, promoOffset: page.promoOffset + promoted }
        : undefined,
  };
}

export function useTasksFeed(filters: TaskFilters = {}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("tasks-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useInfiniteQuery({
    queryKey: ["tasks", "feed", filters],
    initialPageParam: { promoOffset: 0 } as FeedCursor,
    queryFn: ({ pageParam }) => fetchTasksPage({ page: pageParam, filters }),
    getNextPageParam: (last) => last.nextCursor,
  });
}

export type TaskImage = { id: string; path: string; url: string; status: string };

/** Owner-facing image list for the edit form (ids are needed to remove them). */
export function useTaskImages(taskId?: string) {
  return useQuery({
    queryKey: ["tasks", "images", taskId],
    enabled: Boolean(taskId),
    queryFn: async (): Promise<TaskImage[]> => {
      const { data, error } = await supabase
        .from("task_images")
        .select("id, image_url, sort_order, moderation_status")
        .eq("task_id", taskId!)
        .order("sort_order");
      if (error) throw error;
      const rows = data ?? [];
      const signed = await resolveImageUrls(rows.map((r) => r.image_url));
      return rows.map((r) => ({
        id: r.id,
        path: r.image_url,
        url: r.image_url.startsWith("http") ? r.image_url : (signed[r.image_url] ?? ""),
        status: r.moderation_status,
      }));
    },
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["tasks", "detail", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select(SELECT).eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [task] = await mapRows([data as unknown as Row]);
      return task ?? null;
    },
  });
}

export function useMyTasks(userId?: string) {
  return useQuery({
    queryKey: ["tasks", "mine", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(SELECT)
        .eq("user_id", userId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return mapRows((data ?? []) as unknown as Row[]);
    },
  });
}

async function callTaskRpc(
  fn: "close_task" | "confirm_task_active",
  taskId: string,
  extra: Record<string, unknown> = {},
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc(fn as any, { _task_id: taskId, ...extra } as any);
  if (error) throw error;
  const r = (data ?? {}) as Record<string, unknown>;
  if (!r["ok"]) throw new Error(String(r["error"] ?? "UNKNOWN"));
}

export type CloseOutcome = "external" | "cancelled";

/** Owner closes the task: hired outside the platform, or gave up on it. */
export function useCloseTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { taskId: string; outcome: CloseOutcome }) =>
      callTaskRpc("close_task", v.taskId, { _outcome: v.outcome }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

/** Owner confirms the task is still open, refreshes it in the feed. */
export function useConfirmTaskActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => callTaskRpc("confirm_task_active", taskId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

/** Compresses an image in the browser before upload. */
export async function compressImage(file: File, maxSize = 1600, quality = 0.8): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

export type CreateTaskInput = {
  title: string;
  description: string;
  category: string;
  budget: number;
  location: string;
  files: File[];
  /** When reposting, the archived task whose approved photos carry over. */
  repostFrom?: string;
  /** Source-task image ids the user removed in the form; they are not carried over. */
  repostExclude?: string[];
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("READ_FAILED"));
    reader.readAsDataURL(blob);
  });
}

export type CreateTaskResult = {
  id: string;
  /** Categories of images rejected by automated moderation (never stored). */
  rejected: (string | null)[];
  /** Number of images held for manual review. */
  held: number;
  /** True when the task itself was held (pending) instead of published. */
  pending: boolean;
  /** True when the repost photo carry-over failed (task was still created). */
  copyFailed: boolean;
};

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskInput): Promise<CreateTaskResult> => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Трябва да си влязъл в профила си.");

      const [city, neighborhood] = input.location.split(",").map((s) => s.trim());

      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          user_id: userId,
          title: input.title,
          description: input.description,
          category: input.category,
          budget: input.budget,
          city: city ?? null,
          neighborhood: neighborhood ?? null,
          status: "active",
        })
        .select("id, status")
        .single();
      if (error) throw error;

      const rejected: (string | null)[] = [];
      let held = 0;

      // Images go through server-side moderation before they are ever stored.
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        if (!file) continue;
        const blob = await compressImage(file);
        const dataUrl = await blobToDataUrl(blob);
        try {
          const res = await uploadModeratedTaskImage({
            data: { taskId: task.id, index: i, dataUrl },
          });
          if (res.status === "rejected") rejected.push(res.category);
          if (res.status === "pending") held += 1;
        } catch {
          rejected.push(null);
        }
      }

      // Repost: carry over the already-approved photos from the source task,
      // minus the ones the user removed in the form. The source rows and the
      // stored files are never touched — new rows point at the same paths.
      let copyFailed = false;
      if (input.repostFrom) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: copyError } = await supabase.rpc("copy_task_images" as any, {
          _source_task_id: input.repostFrom,
          _new_task_id: task.id,
          _exclude_ids: input.repostExclude ?? [],
        } as any);
        if (copyError) {
          console.error("copy_task_images", copyError);
          copyFailed = true;
        }
      }

      // Automated gate: publishes the task immediately when every check came
      // back clean, keeps it held when something needs a human.
      const { error: finalizeError } = await supabase.rpc("finalize_task_publication", { _task_id: task.id });
      if (finalizeError) console.error("finalize_task_publication", finalizeError);

      const { data: fresh } = await supabase.from("tasks").select("status").eq("id", task.id).maybeSingle();

      return {
        id: task.id as string,
        rejected,
        held,
        pending: (fresh?.status ?? task.status) === "pending",
        copyFailed,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}


export type UpdateTaskInput = {
  taskId: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  location: string;
  files: File[];
  removedImageIds: string[];
};

export type UpdateTaskResult = {
  pending: boolean;
  rejected: (string | null)[];
  held: number;
};

/** Owner edit. Text goes through the same masking + moderation path as a new task. */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTaskInput): Promise<UpdateTaskResult> => {
      const [city, neighborhood] = input.location.split(",").map((s) => s.trim());

      const { data, error } = await supabase.rpc("update_own_task", {
        _task_id: input.taskId,
        _title: input.title,
        _description: input.description,
        _category: input.category,
        _budget: input.budget,
        _city: city ?? null,
        _neighborhood: neighborhood ?? null,
      });
      if (error) throw error;
      const res = (data ?? {}) as Record<string, unknown>;
      if (!res["ok"]) throw new Error(String(res["error"] ?? "UNKNOWN"));

      if (input.removedImageIds.length > 0) {
        const { error: delError } = await supabase
          .from("task_images")
          .delete()
          .in("id", input.removedImageIds);
        if (delError) throw delError;
      }

      const rejected: (string | null)[] = [];
      let held = 0;
      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        if (!file) continue;
        const blob = await compressImage(file);
        const dataUrl = await blobToDataUrl(blob);
        try {
          const uploaded = await uploadModeratedTaskImage({
            data: { taskId: input.taskId, index: Date.now() % 100000 + i, dataUrl },
          });
          if (uploaded.status === "rejected") rejected.push(uploaded.category);
          if (uploaded.status === "pending") held += 1;
        } catch {
          rejected.push(null);
        }
      }

      const { data: fresh } = await supabase
        .from("tasks")
        .select("status")
        .eq("id", input.taskId)
        .maybeSingle();

      return { pending: (fresh?.status ?? "active") === "pending", rejected, held };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export type DeletePreview = { unlockers: number; credits: number };

/** How many professionals paid for this task, shown before the owner deletes it. */
export function useDeletePreview(taskId?: string, enabled = true) {
  return useQuery({
    queryKey: ["tasks", "delete-preview", taskId],
    enabled: Boolean(taskId) && enabled,
    queryFn: async (): Promise<DeletePreview> => {
      const { data, error } = await supabase.rpc("own_task_delete_preview", { _task_id: taskId! });
      if (error) throw error;
      const r = (data ?? {}) as Record<string, unknown>;
      return { unlockers: Number(r["unlockers"] ?? 0), credits: Number(r["credits"] ?? 0) };
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; reason: string }) => {
      const { data, error } = await supabase.rpc("delete_own_task", {
        _task_id: input.taskId,
        _reason: input.reason,
      });
      if (error) throw error;
      const r = (data ?? {}) as Record<string, unknown>;
      if (!r["ok"]) throw new Error(String(r["error"] ?? "UNKNOWN"));
      return { refundedUsers: Number(r["refunded_users"] ?? 0), refundedCredits: Number(r["refunded_credits"] ?? 0) };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
  });
}
