/**
 * Deployment safety net for already-open tabs and cached browsers.
 *
 * The app deliberately ships WITHOUT a service worker: its only real benefit
 * here would be PWA installability, while a stale cached shell breaks the site
 * on every deploy (old entry JS asking for chunk files that no longer exist).
 * Until launch the safer configuration is "no worker at all", so this module
 * also removes any worker a user picked up from an earlier build.
 *
 * Two jobs, both client-side:
 *   1. Unregister every service worker and drop its caches, once per load.
 *   2. Recover from a failed dynamic import (a chunk deleted by a newer
 *      deploy) by reloading the page exactly once.
 */

const RELOAD_FLAG = "app:chunk-reloaded-at";
/** Do not auto-reload more than once per minute, so we can never loop. */
const RELOAD_WINDOW_MS = 60_000;

function looksLikeStaleChunkError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("failed to fetch dynamically imported module") ||
    m.includes("error loading dynamically imported module") ||
    m.includes("importing a module script failed") ||
    (m.includes("unexpected token") && m.includes("<")) ||
    m.includes("'text/html' is not a valid javascript mime type")
  );
}

function reloadOnce(): void {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
    if (Date.now() - last < RELOAD_WINDOW_MS) return;
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    // Private mode without storage: fall through and reload anyway.
  }
  window.location.reload();
}

async function removeServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) return;
    await Promise.all(registrations.map((r) => r.unregister()));
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    // The current page is still controlled by the worker we just removed, so
    // its HTML/JS may already be the stale pair — reload into a clean load.
    if (navigator.serviceWorker.controller) reloadOnce();
  } catch {
    // Nothing to do: worker cleanup is best effort.
  }
}

/** Call once, from a client effect. */
export function bootAppUpdates(): () => void {
  void removeServiceWorkers();

  const onError = (event: ErrorEvent) => {
    if (looksLikeStaleChunkError(String(event.message ?? ""))) reloadOnce();
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason as { message?: string } | string | undefined;
    const message = typeof reason === "string" ? reason : (reason?.message ?? "");
    if (looksLikeStaleChunkError(message)) reloadOnce();
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
