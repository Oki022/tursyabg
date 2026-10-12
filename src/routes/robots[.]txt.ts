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

/**
 * Bots that only fetch a page to build a link preview (Facebook/Instagram,
 * WhatsApp, Viber, Telegram, X, LinkedIn, Slack, Discord). They do not index
 * the site, so they are allowed even during the test period; otherwise shared
 * links show no picture and Instagram rejects them.
 */
const PREVIEW_BOTS = [
  "facebookexternalhit",
  "Facebot",
  "WhatsApp",
  "Viber",
  "TelegramBot",
  "Twitterbot",
  "LinkedInBot",
  "Slackbot",
  "Discordbot",
];

const previewBotsGroup = [
  ...PREVIEW_BOTS.map((bot) => `User-agent: ${bot}`),
  "Allow: /",
  ...DISALLOWED.map((path) => `Disallow: ${path}`),
  "",
];

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () => {
        // Периодът на тестване: пълна забрана за обхождане (освен ботовете за преглед на линкове).
        if (!allowIndexingServer()) {
          const blocked = [
            ...previewBotsGroup,
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
