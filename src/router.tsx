import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { captureIssue } from "./lib/monitoring/client";

export const getRouter = () => {
  // Every failed data call is reported with the query/mutation key as the
  // "action" — no arguments, so no personal data leaves the browser.
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        captureIssue({
          area: "api",
          action: `query failed: ${String(query.queryKey[0] ?? "unknown")}`,
          error,
          extra: { query_key: query.queryKey.slice(0, 2).map(String) },
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        captureIssue({
          area: "api",
          action: `mutation failed: ${String(mutation.options.mutationKey?.[0] ?? "unknown")}`,
          error,
        });
      },
    }),
  });

  // One fresh CSP nonce per SSR request (a router is created per request on the
  // server). Every inline script TanStack emits, plus our own theme script,
  // carries it; the security headers middleware reads it back off the router
  // to build the matching Content-Security-Policy header.
  const nonce = import.meta.env.SSR
    ? crypto.randomUUID().replace(/-/g, "")
    : undefined;

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(nonce ? { ssr: { nonce } } : {}),
  });

  return router;
};
