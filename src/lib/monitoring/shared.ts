/**
 * Isomorphic monitoring policy: what counts as critical, what is noise,
 * how much we sample, and how we scrub personal data before anything leaves
 * the app. Both the browser SDK and the server reporter use this file.
 */

/** Business areas. `critical` areas are never sampled away. */
export type MonitoringArea =
  | "payments.webhook"
  | "payments.checkout"
  | "credits.spend"
  | "credits.refund"
  | "moderation.provider"
  | "cron"
  | "auth"
  | "ssr"
  | "server-fn"
  | "ui"
  | "api";

export type AlertPriority = "critical" | "high" | "normal" | "low";

const AREA_PRIORITY: Record<MonitoringArea, AlertPriority> = {
  "payments.webhook": "critical",
  "payments.checkout": "critical",
  "credits.spend": "critical",
  "credits.refund": "critical",
  "moderation.provider": "high",
  cron: "high",
  auth: "high",
  ssr: "normal",
  "server-fn": "normal",
  ui: "low",
  api: "normal",
};

export function priorityForArea(area: MonitoringArea): AlertPriority {
  return AREA_PRIORITY[area] ?? "normal";
}

/** Money and access paths are always sent; noisy UI paths are sampled hard. */
export function sampleRateFor(area: MonitoringArea): number {
  const p = priorityForArea(area);
  if (p === "critical") return 1;
  if (p === "high") return 1;
  if (p === "normal") return 0.3;
  return 0.1;
}

export function shouldSend(area: MonitoringArea): boolean {
  const rate = sampleRateFor(area);
  return rate >= 1 || Math.random() < rate;
}

/* ------------------------------ noise filter ------------------------------ */

const IGNORED_MESSAGES = [
  // Browser extensions / injected scripts
  "chrome-extension://",
  "moz-extension://",
  "safari-web-extension://",
  "extension context invalidated",
  "can't redefine non-configurable property",
  // Benign resize / layout observers
  "resizeobserver loop",
  // Client network flakiness, not an app bug
  "failed to fetch",
  "networkerror when attempting to fetch",
  "load failed",
  "network request failed",
  "the network connection was lost",
  "the operation was aborted",
  "aborterror",
  "timeout",
  "timed out",
  // Navigation / lifecycle races
  "the play() request was interrupted",
  "navigation cancelled",
  "abort fetching component for route",
  "dynamically imported module",
  "importing a module script failed",
  // Known benign auth states, surfaced in the UI already
  "auth session missing",
  "invalid login credentials",
  "refresh token not found",
];

const IGNORED_STACK_HINTS = ["chrome-extension://", "moz-extension://", "anonymous>", "gtag", "fbevents"];

/** True when the error is noise we deliberately never alert on. */
export function isIgnoredError(message: string | undefined, stack?: string): boolean {
  const m = (message ?? "").toLowerCase();
  if (!m) return false;
  if (IGNORED_MESSAGES.some((n) => m.includes(n))) return true;
  const s = (stack ?? "").toLowerCase();
  return IGNORED_STACK_HINTS.some((n) => s.includes(n));
}

/* -------------------------------- scrubbing ------------------------------- */

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const PHONE_RE = /(\+?359|0)\s*[\d\s().-]{8,}\d/g;
const CARD_RE = /\b(?:\d[ -]*?){13,19}\b/g;
const TOKEN_RE = /\b(eyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]{5,}|sk_[a-z]+_[\w]+|sb_[a-z]+_[\w-]+|Bearer\s+[\w.-]+)/gi;

/** Removes emails, phones, card-like digit runs and tokens from free text. */
export function scrubText(input: string): string {
  return input
    .replace(EMAIL_RE, "[email]")
    .replace(TOKEN_RE, "[token]")
    .replace(CARD_RE, "[card]")
    .replace(PHONE_RE, "[phone]");
}

const SENSITIVE_KEYS = [
  "phone",
  "phone_number",
  "email",
  "password",
  "body",
  "message",
  "messages",
  "content",
  "text",
  "details",
  "description",
  "card",
  "card_number",
  "cvc",
  "iban",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "apikey",
  "api_key",
  "secret",
  "cookie",
  "payment_method",
  "receipt_url",
  "full_name",
  "name",
  "avatar_url",
];

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.some((s) => k === s || k.endsWith(`_${s}`) || k.includes(s));
}

/** Deep-redacts sensitive keys and scrubs every remaining string value. */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (depth > 6) return "[deep]";
  if (typeof value === "string") return scrubText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrubValue(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSensitiveKey(k) ? "[redacted]" : scrubValue(v, depth + 1);
    }
    return out;
  }
  return "[unserializable]";
}

/** Strips query strings and ids that could carry personal data from a URL. */
export function scrubUrl(url: string): string {
  try {
    const u = new URL(url, "http://local");
    return `${u.pathname}`;
  } catch {
    return scrubText(url.split("?")[0] ?? "");
  }
}

export function errorMessageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error).slice(0, 300);
  } catch {
    return "Unknown error";
  }
}
