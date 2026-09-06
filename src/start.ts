import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

/**
 * CSRF protection for server functions, following the pattern TanStack Start
 * documents for createCsrfMiddleware (not yet shipped in our installed
 * version): only server-function requests (serverFnMeta present) are checked,
 * and a request must prove it is same-origin via Sec-Fetch-Site, Origin, or
 * Referer. Server routes such as /api/public/payments/webhook are unaffected.
 */
const csrfMiddleware = createMiddleware().server(async ({ next, request, serverFnMeta }) => {
  if (!serverFnMeta) return next();

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
  requestMiddleware: [csrfMiddleware, errorMiddleware],
}));
