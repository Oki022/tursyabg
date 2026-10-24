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

export function nativePlatform(): "android" | "ios" | null {
  const p = capacitor()?.getPlatform?.();
  return p === "android" || p === "ios" ? p : null;
}
