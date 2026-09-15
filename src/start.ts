import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

/**
 * CSRF protection for server functions, following the pattern TanStack Start
 * documents for createCsrfMiddleware (not yet shipped in our installed
 * version): only server-function requests (marked by the client with the
 * x-tsr-serverFn header) are checked, and a request must prove it is
 * same-origin via Sec-Fetch-Site, Origin, or Referer. Server routes such as
 * /api/public/payments/webhook are unaffected.
 */
const csrfMiddleware = createMiddleware().server(async ({ next, request }) => {
  if (request.headers.get("x-tsr-serverFn") !== "true") return next();

  const requestOrigin = new URL(request.url).origin;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null) {
    if (fetchSite === "same-origin" || fetchSite === "none") return next();
    return new Response("Forbidden", { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (origin !== null) {
    if (origin === requestOrigin) return next();
    return new Response("Forbidden", { status: 403 });
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).origin === requestOrigin) return next();
    } catch {
      // unparsable referer falls through to rejection
    }
  }

  return new Response("Forbidden", { status: 403 });
});

/**
 * Security headers for every response. The CSP explicitly allows Stripe
 * (embedded checkout + its iframes), Supabase (REST/auth over https and
 * realtime over wss) and Sentry ingest, so payments, live messaging and
 * signed image URLs keep working. script-src is nonce based — see
 * ./lib/csp.ts.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(self), payment=(self), usb=(), interest-cohort=()",
};

/**
 * The per-request nonce lives on the router created for this request
 * (src/router.tsx), which is also what stamps it onto every inline script
 * TanStack renders — so reading it back here guarantees header and markup
 * always agree, even under concurrent requests.
 */
async function requestNonce(): Promise<string | undefined> {
  try {
    const { getStartContext } = await import("@tanstack/start-storage-context");
    const ctx = getStartContext({ throwIfNotFound: false }) as
      | { getRouter?: () => Promise<{ options?: { ssr?: { nonce?: string } } }> }
      | undefined;
    if (!ctx?.getRouter) return undefined;
    const router = await ctx.getRouter();
    return router.options?.ssr?.nonce;
  } catch {
    return undefined;
  }
}

const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  const candidate = result as unknown as { headers?: Headers; response?: { headers?: Headers } };
  const headers = candidate.response?.headers ?? candidate.headers;
  if (headers && typeof headers.set === "function") {
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
    const contentType = headers.get("content-type") ?? "";
    const isHtml = contentType.includes("text/html");
    // Vite's dev server injects its own inline scripts without a nonce, so the
    // strict policy only applies to real builds.
    const strict =
      isStrictCspEnabled(process.env as Record<string, string | undefined>) &&
      process.env["NODE_ENV"] !== "development" &&
      process.env["TSS_DEV_SERVER"] !== "true";
    const nonce = strict && isHtml ? await requestNonce() : undefined;
    headers.set("Content-Security-Policy", buildCsp({ strict, nonce }));
    // The app shell must never be served stale: a cached HTML document points
    // at hashed chunks that a newer deploy has already removed. Hashed assets
    // under /_build and /assets keep their long-lived immutable caching.
    if (isHtml) {
      headers.set("Cache-Control", "no-cache, must-revalidate, max-age=0");
    }
  }
  return result;
});



const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    const { reportServerIssue } = await import("./lib/monitoring/sentry.server");
    reportServerIssue({ area: "server-fn", action: "server request failed", error });
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [securityHeadersMiddleware, csrfMiddleware, errorMiddleware],
}));
