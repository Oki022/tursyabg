import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The app opens the live site (tursya.bg) inside a native shell, so every site
 * update reaches the app without a store release. Native features (push,
 * camera, app links) are added on top with Capacitor plugins.
 *
 * appId is permanent once the app is in Google Play: do not change it later.
 */
const config: CapacitorConfig = {
  appId: "bg.tursya.app",
  appName: "ТърсяБГ",
  // Only a fallback page; the app loads server.url.
  webDir: "www",
  server: {
    url: "https://tursya.bg",
    cleartext: false,
    // Pages on these hosts open inside the app; any other link opens in the
    // phone's browser (for example Google sign-in, Stripe receipts).
    allowNavigation: ["tursya.bg", "www.tursya.bg"],
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
