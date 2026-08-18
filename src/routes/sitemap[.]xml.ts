import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { absoluteUrl } from "@/lib/brand";
import { countActiveTasks, TASKS_PER_SITEMAP, xmlResponse } from "@/lib/sitemap.server";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const total = await countActiveTasks();
        const taskPages = Math.max(1, Math.ceil(total / TASKS_PER_SITEMAP));
        const maps = [
          absoluteUrl("/sitemap-pages.xml"),
          ...Array.from({ length: taskPages }, (_, i) =>
            absoluteUrl(i === 0 ? "/sitemap-tasks.xml" : `/sitemap-tasks.xml?page=${i + 1}`),
          ),
        ];
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...maps.map((loc) => `  <sitemap>\n    <loc>${loc}</loc>\n  </sitemap>`),
          `</sitemapindex>`,
        ].join("\n");
        return xmlResponse(xml);
      },
    },
  },
});
