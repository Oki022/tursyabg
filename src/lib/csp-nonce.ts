import { createIsomorphicFn } from "@tanstack/react-start";
import { getStartContext } from "@tanstack/start-storage-context";

/**
 * Per-request CSP nonce.
 *
 * Keyed by the incoming Request object, so two requests being served
 * concurrently can never see each other's nonce: the security headers
 * middleware (which owns the Request) and the SSR router (which stamps the
 * nonce onto every inline script) always resolve the exact same value.
 */
const nonces = new WeakMap<Request, string>();

export function nonceForRequest(request: Request): string {
  const existing = nonces.get(request);
  if (existing) return existing;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  nonces.set(request, nonce);
  return nonce;
}

/** Nonce of the request currently being rendered (SSR only). */
export const currentRequestNonce = createIsomorphicFn()
  .client((): string | undefined => undefined)
  .server((): string | undefined => {
    const ctx = getStartContext({ throwIfNotFound: false }) as
      | { request?: Request }
      | undefined;
    return ctx?.request ? nonceForRequest(ctx.request) : undefined;
  });
