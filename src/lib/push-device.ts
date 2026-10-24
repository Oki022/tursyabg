/**
 * Push notifications in the mobile app: permission, Firebase token and taps.
 * Only ever called inside the app (see isNativeApp); the plugins are loaded
 * with dynamic imports, so the website does not download them.
 */
import { supabase } from "@/integrations/supabase/client";
import { captureIssue } from "@/lib/monitoring/client";
import { nativePlatform } from "@/lib/mobile-app";

let currentToken: string | null = null;
let listenersReady: Promise<void> | null = null;

/** The token of this phone, if it registered for push in this session. */
export function currentPushToken(): string | null {
  return currentToken;
}

/**
 * Listeners are added once per app start, before register() is called, so the
 * token event and a tap on a notification that opened the app are not missed.
 */
export function ensurePushListeners(openLink: (link: string) => void): Promise<void> {
  if (listenersReady) return listenersReady;
  listenersReady = (async () => {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    await PushNotifications.addListener("registration", ({ value }) => {
      currentToken = value;
      const platform = nativePlatform();
      if (!platform) return;
      void supabase.auth.getSession().then(({ data }) => {
        if (!data.session) return;
        void supabase.rpc("register_push_device", { _token: value, _platform: platform }).then(({ error }) => {
          if (error) captureIssue({ area: "api", action: "register push device", error });
        });
      });
    });

    await PushNotifications.addListener("registrationError", (err) => {
      captureIssue({ area: "api", action: "push registration", error: new Error(String(err?.error ?? err)) });
    });

    // Tap on a notification: open the page it points to.
    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const link = (action.notification?.data as { link?: unknown } | undefined)?.link;
      if (typeof link === "string" && link.startsWith("/")) openLink(link);
    });
  })();
  return listenersReady;
}

/** Asks for permission (Android 13+ shows a dialog once) and registers the phone. */
export async function registerForPush(openLink: (link: string) => void): Promise<void> {
  await ensurePushListeners(openLink);
  const { PushNotifications } = await import("@capacitor/push-notifications");
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") return;
  await PushNotifications.register();
}

/** Before sign-out: stop sending this user's notifications to this phone. */
export async function unregisterPushDevice(): Promise<void> {
  if (!currentToken) return;
  try {
    await supabase.rpc("unregister_push_device", { _token: currentToken });
  } catch {
    // Signing out must not fail because of this.
  }
}
