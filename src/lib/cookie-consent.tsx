import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export const CONSENT_COOKIE = "tursya_consent";
/** 12 months, in seconds. */
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;
export const CONSENT_VERSION = 1;

export type ConsentCategory = "necessary" | "analytics" | "marketing";

export type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  /** ISO date of the decision. */
  decidedAt: string;
  version: number;
};

export const CATEGORY_LABELS: Record<ConsentCategory, string> = {
  necessary: "Необходими",
  analytics: "Аналитични",
  marketing: "Маркетингови",
};

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${secure}`;
}

function parseConsent(raw: string | null): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.version !== CONSENT_VERSION) return null;
    return {
      necessary: true,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
      decidedAt: typeof parsed.decidedAt === "string" ? parsed.decidedAt : new Date().toISOString(),
      version: CONSENT_VERSION,
    };
  } catch {
    return null;
  }
}

/** True when the browser sends Global Privacy Control or Do Not Track. */
export function hasOptOutSignal(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  if (nav.globalPrivacyControl === true) return true;
  const dnt =
    nav.doNotTrack ?? nav.msDoNotTrack ?? (typeof window !== "undefined" ? (window as any).doNotTrack : null);
  return dnt === "1" || dnt === "yes";
}

type ConsentContextValue = {
  consent: ConsentState | null;
  /** Browser sent GPC / DNT: treated as a refusal of optional cookies. */
  optOutSignal: boolean;
  ready: boolean;
  bannerOpen: boolean;
  prefsOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
  save: (choice: { analytics: boolean; marketing: boolean }) => void;
  acceptAll: () => void;
  rejectAll: () => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [ready, setReady] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [optOutSignal, setOptOutSignal] = useState(false);

  useEffect(() => {
    setOptOutSignal(hasOptOutSignal());
    setConsent(parseConsent(readCookie(CONSENT_COOKIE)));
    setReady(true);
  }, []);

  const save = useCallback((choice: { analytics: boolean; marketing: boolean }) => {
    const next: ConsentState = {
      necessary: true,
      analytics: choice.analytics,
      marketing: choice.marketing,
      decidedAt: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    writeCookie(CONSENT_COOKIE, JSON.stringify(next));
    setConsent(next);
    setPrefsOpen(false);
  }, []);

  const value = useMemo<ConsentContextValue>(
    () => ({
      consent,
      optOutSignal,
      ready,
      bannerOpen: ready && consent === null,
      prefsOpen,
      openPreferences: () => setPrefsOpen(true),
      closePreferences: () => setPrefsOpen(false),
      save,
      acceptAll: () => save({ analytics: true, marketing: true }),
      rejectAll: () => save({ analytics: false, marketing: false }),
    }),
    [consent, optOutSignal, ready, prefsOpen, save],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useCookieConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useCookieConsent must be used inside CookieConsentProvider");
  return ctx;
}

/**
 * Gate for optional scripts. Returns false until the user has explicitly
 * allowed the category, so nothing loads without consent.
 */
export function useHasConsent(category: ConsentCategory): boolean {
  const { consent, optOutSignal } = useCookieConsent();
  if (category === "necessary") return true;
  if (optOutSignal) return false;
  return consent?.[category] === true;
}
