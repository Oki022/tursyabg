import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { captureIssue } from "@/lib/monitoring/client";
import { APP_AUTH_CALLBACK, isNativeApp } from "@/lib/mobile-app";
import { ensurePushListeners, registerForPush } from "@/lib/push-device";
import { resumePendingPromotions, storePurchasesEnabled } from "@/lib/store-purchases";

/**
 * Glue between the website and the mobile app. Renders nothing and does
 * nothing in a normal browser.
 *  - Google sign-in: the app opens Google in an in-app browser sheet; Supabase
 *    sends the user back to bg.tursya.app://auth/callback with the session.
 *  - Push: after sign-in the phone registers for notifications; a tap on a
 *    notification opens its page.
 */
export function NativeAppBridge() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!isNativeApp()) return;
    const openLink = (link: string) => void router.history.push(link);
    let removeUrlListener: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      // The site is on screen: hide the launch screen (our turning logo).
      await import("@capacitor/splash-screen")
        .then(({ SplashScreen }) => SplashScreen.hide())
        .catch(() => undefined);
      await ensurePushListeners(openLink).catch(() => undefined);
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("appUrlOpen", ({ url }) => {
        if (url.startsWith(APP_AUTH_CALLBACK)) void finishGoogleSignIn(url, openLink);
      });
      if (cancelled) void handle.remove();
      else removeUrlListener = () => void handle.remove();
    })();

    return () => {
      cancelled = true;
      removeUrlListener?.();
    };
  }, [router]);

  useEffect(() => {
    if (!isNativeApp() || !user?.id) return;
    const openLink = (link: string) => void router.history.push(link);
    void registerForPush(openLink).catch((error) =>
      captureIssue({ area: "api", action: "register for push", error }),
    );
    // A promotion paid in an earlier session but not applied yet.
    if (storePurchasesEnabled()) void resumePendingPromotions().catch(() => undefined);
  }, [user?.id, router]);

  return null;
}

async function finishGoogleSignIn(url: string, openLink: (link: string) => void) {
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close().catch(() => undefined);

    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    new URLSearchParams(parsed.search).forEach((v, k) => params.set(k, v));

    if (params.get("error") || params.get("error_description")) {
      toast.error("Входът с Google не беше завършен. Опитай отново.");
      return;
    }

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const code = params.get("code");
    const { error } =
      accessToken && refreshToken
        ? await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        : code
          ? await supabase.auth.exchangeCodeForSession(code)
          : { error: new Error("Google callback without session") };
    if (error) throw error;

    openLink("/");
  } catch (error) {
    captureIssue({ area: "auth", action: "finish google sign-in in app", error });
    toast.error("Входът с Google не беше завършен. Опитай отново.");
  }
}
