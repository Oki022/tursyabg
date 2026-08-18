import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { absoluteUrl } from "@/lib/brand";

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
];

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => {
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
