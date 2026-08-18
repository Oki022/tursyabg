import { supabase } from "@/integrations/supabase/client";
import { absoluteUrl } from "@/lib/brand";

export const TASKS_PER_SITEMAP = 45000;

export type SitemapEntry = {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
};

export function xmlResponse(xml: string) {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

export function urlsetXml(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${absoluteUrl(e.path)}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

export async function countActiveTasks(): Promise<number> {
  const { count, error } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (error) return 0;
  return count ?? 0;
}

/** One page of active tasks; lastmod comes from updated_at (fallback created_at). */
export async function activeTaskEntries(page = 1): Promise<SitemapEntry[]> {
  const from = (page - 1) * TASKS_PER_SITEMAP;
  const { data, error } = await supabase
    .from("tasks")
    .select("id, updated_at, created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(from, from + TASKS_PER_SITEMAP - 1);
  if (error || !data) return [];
  return data.map((row: any) => ({
    path: `/task/${row.id}`,
    lastmod: new Date(row.updated_at ?? row.created_at).toISOString(),
    changefreq: "daily" as const,
    priority: "0.6",
  }));
}
