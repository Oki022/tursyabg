import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_IMAGES, type Task, type TaskStatus } from "@/lib/mock-data";

export const PAGE_SIZE = 20;
const BUCKET = "task-images";

type Row = {
  id: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  city: string | null;
  neighborhood: string | null;
  status: TaskStatus;
  created_at: string;
  user_id: string;
  task_images?: { image_url: string; sort_order: number }[] | null;
  profiles?: { full_name: string | null } | null;
};

const SELECT =
  "id, title, description, category, budget, city, neighborhood, status, created_at, user_id, task_images(image_url, sort_order), profiles(full_name)";

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

async function signPaths(paths: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(unique, 60 * 60 * 24);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  data.forEach((entry, i) => {
    const path = entry.path ?? unique[i];
    if (entry.signedUrl && path) map[path] = entry.signedUrl;
  });
  return map;
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
    image: gallery[0] ?? CATEGORY_IMAGES[row.category] ?? CATEGORY_IMAGES.drugi,
    gallery,
  };
}

async function mapRows(rows: Row[]): Promise<Task[]> {
  const paths = rows.flatMap((r) => (r.task_images ?? []).map((i) => i.image_url)).filter((p) => !p.startsWith("http"));
  const signed = await signPaths(paths);
  return rows.map((r) => mapRow(r, signed));
}

export type TaskFilters = { q?: string; category?: string; location?: string };

async function fetchTasksPage({
  cursor,
  filters,
}: {
  cursor?: string;
  filters: TaskFilters;
}): Promise<{ items: Task[]; nextCursor?: string }> {
  let query = supabase
    .from("tasks")
    .select(SELECT)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) query = query.lt("created_at", cursor);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.location) {
    const [city, neighborhood] = filters.location.split(",").map((s) => s.trim());
    if (city) query = query.eq("city", city);
    if (neighborhood) query = query.eq("neighborhood", neighborhood);
  }
  if (filters.q) {
    const term = filters.q.replace(/[%,]/g, " ");
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as Row[];
  const items = await mapRows(rows);
  return {
    items,
    nextCursor: rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : undefined,
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
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchTasksPage({ cursor: pageParam, filters }),
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
