import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { activeTaskEntries, urlsetXml, xmlResponse } from "@/lib/sitemap.server";

export const Route = createFileRoute("/sitemap-tasks.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get("page") ?? "1") || 1;
        const entries = await activeTaskEntries(page);
        return xmlResponse(urlsetXml(entries));
      },
    },
  },
});
