import { supabase } from "@/integrations/supabase/client";
import { type Task, type TaskStatus } from "@/lib/mock-data";
import { resolveImageUrls } from "@/services/storage";
import { timeAgoBg } from "@/lib/tasks-api";
import { fetchPublicNames, FALLBACK_NAME } from "@/lib/public-profiles";

export const FAVOURITES_PAGE_SIZE = 20;

export type FavouriteItem = {
  favouriteId: string;
  taskId: string;
  savedAt: string;
  /** Null when the task is deleted or no longer visible. */
  task: Task | null;
  /** True when the task is not active anymore (closed, assigned, deleted). */
  inactive: boolean;
};

type Row = {
  id: string;
  task_id: string;
  created_at: string;
  tasks: {
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
    user_id: string;
    deleted_at: string | null;
    task_images: { image_url: string; sort_order: number }[] | null;
  } | null;
};

const SELECT =
  "id, task_id, created_at, tasks(id, title, description, category, budget, city, neighborhood, status, unlock_cost, created_at, user_id, deleted_at, task_images(image_url, sort_order))";

/** IDs of every task the signed-in user has saved. */
export async function getFavouriteIds(): Promise<string[]> {
  const { data, error } = await supabase.from("favourites").select("task_id");
  if (error) throw error;
  return (data ?? []).map((r) => r.task_id);
}

export async function getFavouritesPage(cursor?: string): Promise<{
  items: FavouriteItem[];
  nextCursor?: string;
}> {
  let query = supabase
    .from("favourites")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(FAVOURITES_PAGE_SIZE);
  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as Row[];

  const paths = rows
    .flatMap((r) => (r.tasks?.task_images ?? []).map((i) => i.image_url))
    .filter((p) => !p.startsWith("http"));
  const [signed, names] = await Promise.all([
    resolveImageUrls(paths),
    fetchPublicNames(rows.map((r) => r.tasks?.user_id)),
  ]);

  const items: FavouriteItem[] = rows.map((r) => {
    const t = r.tasks;
    if (!t || t.deleted_at) {
      return { favouriteId: r.id, taskId: r.task_id, savedAt: r.created_at, task: null, inactive: true };
    }
    const gallery = [...(t.task_images ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => (i.image_url.startsWith("http") ? i.image_url : signed[i.image_url]))
      .filter(Boolean) as string[];
    return {
      favouriteId: r.id,
      taskId: r.task_id,
      savedAt: r.created_at,
      inactive: t.status !== "active",
      task: {
        id: t.id,
        title: t.title,
        description: t.description,
        category: t.category,
        budget: Number(t.budget),
        location: [t.city, t.neighborhood].filter(Boolean).join(", "),
        postedAt: timeAgoBg(t.created_at),
        author: names[t.user_id] ?? FALLBACK_NAME,
        userId: t.user_id,
        status: t.status,
        unlockCost: t.unlock_cost ?? undefined,
        image: gallery[0],
        gallery,
      } as Task,
    };
  });

  const last = rows[rows.length - 1];
  return {
    items,
    nextCursor: rows.length === FAVOURITES_PAGE_SIZE && last ? last.created_at : undefined,
  };
}

export async function getFavouritesCount(): Promise<number> {
  const { count, error } = await supabase.from("favourites").select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function addFavourite(taskId: string, userId: string): Promise<void> {
  const { error } = await supabase.from("favourites").insert({ task_id: taskId, user_id: userId });
  if (error && error.code !== "23505") throw error;
}

export async function removeFavourite(taskId: string): Promise<void> {
  const { error } = await supabase.from("favourites").delete().eq("task_id", taskId);
  if (error) throw error;
}
