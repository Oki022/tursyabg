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
          background_color: "#ffffff",
          theme_color: "#ffffff",
          icons: [
            { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            // Android crops these to a circle or squircle; the T sits inside the safe zone.
            { src: "/maskable-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
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
