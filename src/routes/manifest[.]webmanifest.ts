import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { BRAND, BRAND_LATIN, BRAND_TAGLINE } from "@/lib/brand";

export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: () => {
        const manifest = {
          name: BRAND,
          short_name: BRAND_LATIN,
          description: BRAND_TAGLINE,
          lang: "bg",
          start_url: "/",
          display: "standalone",
          background_color: "#0f172a",
          theme_color: "#0f172a",
        };
        return new Response(JSON.stringify(manifest, null, 2), {
          headers: {
            "Content-Type": "application/manifest+json; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
