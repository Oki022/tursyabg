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
 * signed image URLs keep working.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
  [
    "connect-src 'self' blob: data:",
    "https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in",
    "https://api.stripe.com https://*.stripe.com",
    "https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
  ].join(" "),
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.stripe.com",
].join("; ");

const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const response = await next();
  const headers = (response as unknown as { headers?: Headers }).headers;
  if (!headers || typeof headers.set !== "function") return response;

  headers.set("Content-Security-Policy", CSP);
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), payment=(self), usb=(), interest-cohort=()",
  );
  return response;
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
