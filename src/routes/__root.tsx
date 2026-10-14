import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { ClientOnly } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { BRAND, pageTitle } from "@/lib/brand";
import { PasswordRecoveryRedirect } from "@/components/password-recovery-redirect";
import { MonitoringBoot } from "@/components/monitoring-boot";
import { captureIssue } from "@/lib/monitoring/client";
import { CookieConsentProvider } from "@/lib/cookie-consent";
import { CookieConsent } from "@/components/cookie-consent";
import { AccountStatusGate } from "@/components/account/account-status-gate";
import { allowIndexing } from "@/lib/indexing";
import { bootAppUpdates, isStaleChunkError, reloadForNewVersion } from "@/lib/app-updates";
import { ThemeProvider } from "@/lib/theme";

const THEME_BOOT_SCRIPT = `(function(){try{var k='tursya-theme';var s=localStorage.getItem(k);var d=s==='dark'||(s!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})()`;

const SUPABASE_ORIGIN =
  (import.meta as any).env?.VITE_SUPABASE_URL ?? "https://xrltdrxhtennbscgbyxb.supabase.co";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Страницата не е намерена</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Търсената от теб страница не съществува или е преместена.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Към началната страница
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error: raw, reset }: { error: unknown; reset: () => void }) {
  const error = raw instanceof Error ? raw : new Error(String(raw));
  console.error(error);
  const router = useRouter();

  useEffect(() => {
    // A chunk that vanished with the previous deploy: recover silently.
    if (isStaleChunkError(error?.message ?? "")) {
      reloadForNewVersion();
      return;
    }
    captureIssue({
      area: "ui",
      action: "route render failed",
      error,
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  }, [raw]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: pageTitle() },
      {
        name: "description",
        content:
          "Публикувай задачата си безплатно. Телефонът ти виждат само до 5 изпълнители – без спам и без 20 обаждания. Ремонти, почистване, превоз и още.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: BRAND },
      { property: "og:locale", content: "bg_BG" },
      // Картинка при споделяне на линк (Viber, Facebook, WhatsApp, Messenger).
      { property: "og:image", content: "https://tursya.bg/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "ТърсяБГ – възложи работа или намери клиенти" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://tursya.bg/og-image.png" },
      { name: "theme-color", content: "#ffffff", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#0b1120", media: "(prefers-color-scheme: dark)" },
      { name: "apple-mobile-web-app-title", content: BRAND },
      { name: "application-name", content: BRAND },
      // Втори слой към robots.txt, докато сайтът е в тестов режим.
      ...(allowIndexing() ? [] : [{ name: "robots", content: "noindex, nofollow" }]),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: SUPABASE_ORIGIN, crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: SUPABASE_ORIGIN },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // Per-request CSP nonce, so the anti-flash theme script runs under the
  // strict (no 'unsafe-inline') script-src.
  const nonce = useRouter().options.ssr?.nonce;
  return (
    <html lang="bg" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script suppressHydrationWarning nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => bootAppUpdates(), []);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Messages screens behave like a native app view: fixed viewport height,
  // no footer / cookie banner, and no page-level scroll on mobile.
  const isMessages = pathname.startsWith("/messages");

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
        <CookieConsentProvider>
          <MonitoringBoot />
          <ClientOnly fallback={null}><PasswordRecoveryRedirect /></ClientOnly>
          <div
            className={
              isMessages
                ? "flex h-[100dvh] w-full max-w-full flex-col overflow-x-hidden overflow-y-hidden bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] md:h-auto md:min-h-screen md:overflow-visible md:pb-0"
                : "flex min-h-screen w-full max-w-full flex-col overflow-x-clip bg-background pb-24 md:pb-0"
            }
          >
            <SiteHeader />
            <main
              className={
                isMessages
                  ? "flex min-h-0 w-full max-w-full flex-1 flex-col"
                  : "w-full max-w-full flex-1"
              }
            >
              <Outlet />
            </main>
            {!isMessages && <SiteFooter />}
            <MobileNav />
          </div>
          {!isMessages && <CookieConsent />}
        </CookieConsentProvider>
        <ClientOnly fallback={null}><AccountStatusGate /></ClientOnly>
        <ClientOnly fallback={null}><Toaster /></ClientOnly>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
