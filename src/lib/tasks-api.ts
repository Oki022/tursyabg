import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_IMAGES, type Task, type TaskStatus } from "@/lib/mock-data";
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
  view_count?: number;
  unlock_count?: number;
  max_unlocks?: number;
  user_id: string;
  task_images?: { image_url: string; sort_order: number }[] | null;
  profiles?: { full_name: string | null } | null;
};

const SELECT =
  "id, title, description, category, budget, city, neighborhood, status, unlock_cost, created_at, bumped_at, view_count, unlock_count, max_unlocks, user_id, task_images(image_url, sort_order), profiles(full_name)";

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
    image: gallery[0] ?? CATEGORY_IMAGES[row.category] ?? CATEGORY_IMAGES.drugi,
    gallery,
    bumpedAt: row.bumped_at ?? row.created_at,
    viewCount: row.view_count ?? 0,
    unlockCount: row.unlock_count ?? 0,
    maxUnlocks: row.max_unlocks ?? 5,
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
      image: gallery[0] ?? CATEGORY_IMAGES[row.category] ?? CATEGORY_IMAGES.drugi,
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

export function useTask(id: string) {
  return useQuery({
    queryKey: ["tasks", "detail", id],
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
        .order("created_at", { ascending: false });
      if (error) throw error;
      return mapRows((data ?? []) as unknown as Row[]);
    },
  });
}

async function callTaskRpc(fn: "close_task" | "confirm_task_active", taskId: string) {
  const { data, error } = await supabase.rpc(fn, { _task_id: taskId });
  if (error) throw error;
  const r = (data ?? {}) as Record<string, unknown>;
  if (!r["ok"]) throw new Error(String(r["error"] ?? "UNKNOWN"));
}

/** Owner marks the task as taken — it leaves the feed and stops consuming unlock slots. */
export function useCloseTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => callTaskRpc("close_task", taskId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

/** Owner confirms the task is still open — refreshes it in the feed. */
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
};

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
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
        .select("id")
        .single();
      if (error) throw error;

      for (let i = 0; i < input.files.length; i++) {
        const file = input.files[i];
        const blob = await compressImage(file);
        const path = `${userId}/${task.id}/${Date.now()}-${i}.jpg`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (upErr) continue;
        await supabase.from("task_images").insert({ task_id: task.id, image_url: path, sort_order: i });
      }

      return task.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
