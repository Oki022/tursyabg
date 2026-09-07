import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { absoluteUrl } from "@/lib/brand";
import { allowIndexingServer } from "@/lib/indexing";

const DISALLOWED = [
  "/admin",
  "/settings",
  "/messages",
  "/notifications",
  "/billing",
  "/profile",
  "/post",
  "/posted",
  "/unlocked",
  "/review",
  "/auth",
  "/reset-password",
  "/api/",
  "/task/*/edit",
];

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => {
        // Периодът на тестване: пълна забрана за обхождане.
        if (!allowIndexingServer()) {
          const blocked = [
            "User-agent: *",
            "Disallow: /",
            "",
            `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
            "",
          ].join("\n");
          return new Response(blocked, {
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
          });
        }
        const body = [
          "User-agent: *",
          "Allow: /",
          ...DISALLOWED.map((path) => `Disallow: ${path}`),
          "",
          `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
          "",
        ].join("\n");
        return new Response(body, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
