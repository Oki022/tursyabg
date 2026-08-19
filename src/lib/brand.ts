/** Single source of truth for brand identity and the site's base URL. */
/** Cyrillic display name, used everywhere users read the brand. */
export const BRAND_DISPLAY = "ТърсяБГ";
/** Latin domain, lowercase. Only for URLs, email senders and technical fields. */
export const BRAND_DOMAIN = "tursya.bg";
/** Back-compat alias for the display name. */
export const BRAND = BRAND_DISPLAY;
/** Latin-script name where required technically (equals the domain). */
export const BRAND_LATIN = BRAND_DOMAIN;
export const BRAND_TAGLINE = "Борса за задачи и услуги в България";

const DEFAULT_SITE_URL = `https://${BRAND_DOMAIN}`;

/** Configurable base URL (VITE_SITE_URL). Never hardcode the domain elsewhere. */
export const SITE_URL: string = (
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_SITE_URL) ||
  (typeof process !== "undefined" && process.env?.["VITE_SITE_URL"]) ||
  DEFAULT_SITE_URL
).replace(/\/$/, "");

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Page title format: "[Page title] | ТърсяБГ" */
export function pageTitle(title?: string): string {
  if (!title) return `${BRAND_DISPLAY} | ${BRAND_TAGLINE}`;
  return `${title} | ${BRAND_DISPLAY}`;
}
