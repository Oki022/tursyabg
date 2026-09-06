/**
 * "Публични регистри и идентификационни номера" entries on a profile.
 *
 * Free text declared by the user (never verified by the platform), so it is
 * masked and moderated server-side exactly like skill tags. The client-side
 * checks below only give faster, friendlier Bulgarian feedback.
 */

export type Credential = {
  label: string;
  value: string;
  url?: string | null;
};

export const MAX_CREDENTIALS = 5;
export const MAX_CREDENTIAL_LABEL = 60;
export const MAX_CREDENTIAL_VALUE = 60;

const CONTACT_PATTERNS: RegExp[] = [
  /(\+359|00359|0)\s*8\d[\s-]*\d{3}[\s-]*\d{3}/,
  /[\w.+-]+@[\w-]+\.[a-z]{2,}/i,
  /\b(viber|whatsapp|telegram|messenger|скайп|skype|вайбър)\b/i,
];

export function normalizeCredentialText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeCredentialUrl(value: string): string {
  return value.trim();
}

export function credentialError(entry: Credential): string | null {
  const label = normalizeCredentialText(entry.label);
  const value = normalizeCredentialText(entry.value);
  const url = normalizeCredentialUrl(entry.url ?? "");

  if (!label && !value && !url) return null;
  if (!label) return "Попълни името на регистъра или органа.";
  if (!value) return "Попълни номера или идентификатора.";
  if (label.length > MAX_CREDENTIAL_LABEL)
    return `Името на регистъра може да е до ${MAX_CREDENTIAL_LABEL} знака.`;
  if (value.length > MAX_CREDENTIAL_VALUE)
    return `Номерът може да е до ${MAX_CREDENTIAL_VALUE} знака.`;
  for (const re of CONTACT_PATTERNS) {
    if (re.test(label) || re.test(value)) {
      return "Тук не се посочват телефони, имейли или профили в месинджъри.";
    }
  }
  if (url && !/^https?:\/\/\S{4,200}$/i.test(url)) {
    return "Адресът трябва да започва с http:// или https://";
  }
  return null;
}

/** Drops empty rows and trims everything, ready to be saved. */
export function cleanCredentials(entries: Credential[]): Credential[] {
  const out: Credential[] = [];
  for (const e of entries) {
    const label = normalizeCredentialText(e.label);
    const value = normalizeCredentialText(e.value);
    const url = normalizeCredentialUrl(e.url ?? "");
    if (!label || !value) continue;
    out.push({ label, value, url: url || null });
    if (out.length >= MAX_CREDENTIALS) break;
  }
  return out;
}

export function parseCredentials(raw: unknown): Credential[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
    .map((r) => ({
      label: String(r["label"] ?? ""),
      value: String(r["value"] ?? ""),
      url: r["url"] ? String(r["url"]) : null,
    }))
    .filter((c) => c.label && c.value)
    .slice(0, MAX_CREDENTIALS);
}
