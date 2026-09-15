/**
 * Content-Security-Policy builder.
 *
 * Two modes:
 *  - strict (default in production): script-src uses a per-request nonce plus
 *    'strict-dynamic', so a successful XSS cannot execute injected inline code.
 *    'strict-dynamic' also means scripts loaded *by* our own nonced bundle
 *    (Stripe.js and the further scripts Stripe itself injects) stay allowed
 *    without a host allowlist.
 *  - legacy: the previous 'unsafe-inline' header, kept behind CSP_STRICT=false
 *    so production can be reverted from the hosting env without a code change.
 *
 * style-src keeps 'unsafe-inline' in BOTH modes: React inline styles, Radix
 * popovers and the chart component all emit inline style attributes/tags that
 * cannot carry a nonce. script-src is the one that matters for XSS.
 */

const SHARED = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' data: blob: https:",
  "worker-src 'self' blob:",
  [
    "connect-src 'self' blob: data:",
    "https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in",
    "https://api.stripe.com https://*.stripe.com",
    "https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io",
  ].join(" "),
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.stripe.com",
];

const LEGACY_SCRIPT_SRC =
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com";

/**
 * Browsers that understand 'strict-dynamic' ignore the host sources below;
 * older ones fall back to them, so Stripe keeps working there too.
 */
function strictScriptSrc(nonce: string): string {
  return `script-src 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com`;
}

export function buildCsp(opts: { strict: boolean; nonce?: string }): string {
  const scriptSrc =
    opts.strict && opts.nonce ? strictScriptSrc(opts.nonce) : LEGACY_SCRIPT_SRC;
  return [...SHARED, scriptSrc].join("; ");
}

/** CSP_STRICT=false reverts to the previous header instantly. */
export function isStrictCspEnabled(env: Record<string, string | undefined>): boolean {
  return env["CSP_STRICT"] !== "false";
}
