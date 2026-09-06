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
import { MonitoringBoot } from "@/components/monitoring-boot";
import { captureIssue } from "@/lib/monitoring/client";
import { CookieConsentProvider } from "@/lib/cookie-consent";
import { CookieConsent } from "@/components/cookie-consent";
import { AccountStatusGate } from "@/components/account/account-status-gate";

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

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  useEffect(() => {
    captureIssue({
      area: "ui",
      action: "route render failed",
      error,
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  }, [error]);

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
          "Възложи работа или намери клиенти. Платформата, която свързва хора с майстори и изпълнители в България.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: BRAND },
      { property: "og:locale", content: "bg_BG" },
      { name: "twitter:card", content: "summary" },
      { name: "theme-color", content: "#14532d" },
      { name: "apple-mobile-web-app-title", content: BRAND },
      { name: "application-name", content: BRAND },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
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
  return (
    <html lang="bg">
      <head>
        <HeadContent />
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Messages screens behave like a native app view: fixed viewport height,
  // no footer / cookie banner, and no page-level scroll on mobile.
  const isMessages = pathname.startsWith("/messages");

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CookieConsentProvider>
          <MonitoringBoot />
          <div
            className={
              isMessages
                ? "flex h-[100dvh] w-full max-w-full flex-col overflow-x-hidden overflow-y-hidden bg-background pb-[calc(4rem+env(safe-area-inset-bottom))] md:h-auto md:min-h-screen md:overflow-visible md:pb-0"
                : "flex min-h-screen w-full max-w-full flex-col overflow-x-hidden bg-background pb-24 md:pb-0"
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
  );
}
