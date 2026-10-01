import { createStart, createMiddleware, createCsrfMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { buildCsp, isStrictCspEnabled } from "./lib/csp";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

/**
 * CSRF protection for server functions with TanStack Start's built-in
 * middleware. Server functions are recognised by the route TanStack resolved
 * (handlerType), not by a request header the caller controls, so a forged
 * request cannot skip the check by leaving the header out. A request must
 * prove it is same-origin via Sec-Fetch-Site, Origin or Referer; requests with
 * none of them are rejected. Server routes such as
 * /api/public/payments/webhook are unaffected.
 */
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
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

const securityHeadersMiddleware = createMiddleware().server(async ({ next, request }) => {
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
      !import.meta.env.DEV &&
      isStrictCspEnabled(process.env as Record<string, string | undefined>);
    const nonce =
      strict && isHtml
        ? (await import("./lib/csp-nonce")).nonceForRequest(request)
        : undefined;
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