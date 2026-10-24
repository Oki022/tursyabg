/**
 * Mobile app (Capacitor). The app opens tursya.bg inside a native shell, so
 * the same code runs in the browser and in the app. Native plugins are loaded
 * only inside the app (dynamic import), so the website bundle stays the same.
 */

/** Deep link the app opens after Google sign-in (Supabase redirect allow list). */
export const APP_AUTH_CALLBACK = "bg.tursya.app://auth/callback";

type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True inside the Android or iPhone app, false in a normal browser. */
export function isNativeApp(): boolean {
  return !!capacitor()?.isNativePlatform?.();
}

/** Marker the app adds to its user agent (mobile/capacitor.config.ts). */
export const APP_USER_AGENT_MARKER = "TursyaBGApp";

export function nativePlatform(): "android" | "ios" | null {
  const p = capacitor()?.getPlatform?.();
  return p === "android" || p === "ios" ? p : null;
}

const SIGN_IN_KEY = "tursya-app-google-sign-in-started";
const SIGN_IN_WINDOW_MS = 10 * 60 * 1000;

/** Called right before the app opens Google sign-in in the browser sheet. */
export function markAppSignInStarted(): void {
  try {
    window.localStorage.setItem(SIGN_IN_KEY, String(Date.now()));
  } catch {
    // storage blocked: the callback will then be refused, the user can retry
  }
}

/**
 * True once if this app started a Google sign-in in the last 10 minutes.
 * A sign-in link that someone else sent to the user (which would log them in
 * to a stranger's account) is refused.
 */
export function takeAppSignInStarted(): boolean {
  try {
    const started = Number(window.localStorage.getItem(SIGN_IN_KEY) ?? "0");
    window.localStorage.removeItem(SIGN_IN_KEY);
    return started > 0 && Date.now() - started < SIGN_IN_WINDOW_MS;
  } catch {
    return false;
  }
}
