import { supabase } from "@/integrations/supabase/client";

export type TaskSeo = {
  id: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  city: string | null;
  neighborhood: string | null;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  image: string | null;
};

/** SSR-safe minimal fetch for task metadata (anon read). Never throws. */
export async function fetchTaskSeo(id: string): Promise<TaskSeo | null> {
  try {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, description, category, budget, city, neighborhood, status, created_at, task_images(image_url, sort_order)")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    const row = data as any;
    const images = [...(row.task_images ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
    const firstHttp = images.map((i: any) => i.image_url).find((u: string) => u?.startsWith("http")) ?? null;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      budget: Number(row.budget),
      city: row.city,
      neighborhood: row.neighborhood,
      status: row.status,
      createdAt: row.created_at,
      /** Tasks expire 30 days after creation (feed sweep policy). */
      expiresAt: new Date(new Date(row.created_at).getTime() + 30 * 24 * 3600 * 1000).toISOString(),
      image: firstHttp,
    };
  } catch {
    return null;
  }
}

export type ProfileSeo = {
  id: string;
  name: string;
  city: string | null;
  rating: number | null;
  reviewCount: number;
  completedJobs: number;
};

export async function fetchProfileSeo(id: string): Promise<ProfileSeo | null> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, city, rating_as_pro, review_count_as_pro, rating_as_client, review_count_as_client, completed_jobs")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    const row = data as any;
    const count = (row.review_count_as_pro ?? 0) + (row.review_count_as_client ?? 0);
    const sum =
      (row.rating_as_pro ?? 0) * (row.review_count_as_pro ?? 0) +
      (row.rating_as_client ?? 0) * (row.review_count_as_client ?? 0);
    return {
      id: row.id,
      name: row.full_name ?? "Потребител",
      city: row.city ?? null,
      rating: count > 0 ? Number((sum / count).toFixed(2)) : null,
      reviewCount: count,
      completedJobs: row.completed_jobs ?? 0,
    };
  } catch {
    return null;
  }
}
