import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { categoryList } from "@/lib/geo";
import { fetchMunicipalitySlugs, urlsetXml, xmlResponse, type SitemapEntry } from "@/lib/sitemap.server";

export const Route = createFileRoute("/sitemap-pages.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "daily", priority: "1.0" },
          { path: "/tasks", changefreq: "hourly", priority: "0.9" },
          { path: "/contact", changefreq: "yearly", priority: "0.4" },
          { path: "/faq", changefreq: "monthly", priority: "0.5" },
          { path: "/terms", changefreq: "yearly", priority: "0.2" },
          { path: "/privacy", changefreq: "yearly", priority: "0.2" },
          { path: "/refund-policy", changefreq: "yearly", priority: "0.2" },
        ];
        for (const category of categoryList) {
          entries.push({ path: `/categories/${category.id}`, changefreq: "daily", priority: "0.8" });
        }
        // Municipality level only (265), never village level — village pages
        // would be thin, near-duplicate content across thousands of URLs.
        const municipalities = await fetchMunicipalitySlugs();
        for (const slug of municipalities) {
          entries.push({ path: `/city/${slug}`, changefreq: "daily", priority: "0.8" });
          for (const category of categoryList) {
            entries.push({
              path: `/city/${slug}/${category.id}`,
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
