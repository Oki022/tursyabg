import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The app opens the live site (tursya.bg) inside a native shell, so every site
 * update reaches the app without a store release. Native features (push,
 * Google sign-in, splash) are added on top with Capacitor plugins.
 *
 * appId is permanent once the app is in Google Play: do not change it later.
 */
const config: CapacitorConfig = {
  appId: "bg.tursya.app",
  appName: "tursya.bg",
  // Only a fallback page; the app loads server.url.
  webDir: "www",
  // Lets the site know it runs in the app before any script loads
  // (hides the header logo without a flash).
  appendUserAgent: "TursyaBGApp",
  server: {
    url: "https://tursya.bg",
    cleartext: false,
    // Pages on these hosts open inside the app; any other link opens in the
    // phone's browser (for example Stripe receipts, Google Maps).
    allowNavigation: ["tursya.bg", "www.tursya.bg"],
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    // Our turning logo stays until the site is ready (the site hides it), at
    // most 8 seconds, so a slow network never leaves the user on a blank page.
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 8000,
      launchFadeOutDuration: 250,
    },
    // Google sign-in with the phone's own account picker (Credential Manager).
    // Apple stays on for the iPhone app later; the rest are not bundled.
    SocialLogin: {
      providers: {
        google: true,
        apple: true,
        facebook: false,
        twitter: false,
      },
      logLevel: 1,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
