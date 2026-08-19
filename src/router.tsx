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

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
