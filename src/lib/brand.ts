/** Single source of truth for brand identity and the site's base URL. */
export const BRAND = "Търся";
/** Latin transliteration, only where a Latin-script name is technically required. */
export const BRAND_LATIN = "Tarsya";
export const BRAND_TAGLINE = "Борса за задачи и услуги в България";

const DEFAULT_SITE_URL = "https://tursya.bg";

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

/** Page title format: "[Page title] | Търся" */
export function pageTitle(title?: string): string {
  if (!title) return `${BRAND}, ${BRAND_TAGLINE}`;
  return `${title} | ${BRAND}`;
}
