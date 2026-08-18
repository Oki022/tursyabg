import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { cityList, categoryList } from "@/lib/geo";
import { urlsetXml, xmlResponse, type SitemapEntry } from "@/lib/sitemap.server";

export const Route = createFileRoute("/sitemap-pages.xml")({
  server: {
    handlers: {
      GET: () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/tasks", changefreq: "hourly", priority: "0.9" },
          { path: "/terms", changefreq: "yearly", priority: "0.2" },
          { path: "/privacy", changefreq: "yearly", priority: "0.2" },
          { path: "/refund-policy", changefreq: "yearly", priority: "0.2" },
        ];
        for (const category of categoryList) {
          entries.push({ path: `/categories/${category.id}`, changefreq: "daily", priority: "0.8" });
        }
        for (const city of cityList) {
          entries.push({ path: `/city/${city.slug}`, changefreq: "daily", priority: "0.8" });
          for (const category of categoryList) {
            entries.push({
              path: `/city/${city.slug}/${category.id}`,
              changefreq: "daily",
              priority: "0.7",
            });
          }
        }
        return xmlResponse(urlsetXml(entries));
      },
    },
  },
});
