/**
 * Client-side validation and normalisation for profile skill tags.
 * Mirrors the server-side mask_contacts rules so the UI never reports
 * success for content the database would strip.
 */

const PHONE_RE = /(\+?\d[\s\-().]?){7,}/;
const EMAIL_RE = /[\p{L}\d._%+-]+@[\p{L}\d.-]+\.[\p{L}]{2,}/u;
const URL_RE = /(https?:\/\/|www\.|\b[\p{L}\d-]+\.(com|net|org|bg|eu|info|shop|site|online)\b)/iu;
const HANDLE_RE = /(@[\p{L}\d._]{3,}|viber|whatsapp|telegram|вайбър|уатсап|телеграм|фейсбук|facebook|messenger|инстаграм|instagram|скайп|skype)/iu;

/** Trim, collapse repeated whitespace, cap length. */
export function normalizeSkillTag(raw: string) {
  return raw.replace(/\s+/g, " ").trim().slice(0, 30);
}

/** Lowercase key used for duplicate matching (display casing preserved). */
export function skillTagKey(raw: string) {
  return normalizeSkillTag(raw).toLocaleLowerCase("bg");
}

/**
 * Returns a Bulgarian error message when the tag may not be saved,
 * or null when it is acceptable.
 */
export function skillTagError(raw: string): string | null {
  const t = normalizeSkillTag(raw);
  if (!t) return "Въведи умение.";
  if (t.length < 2) return "Умението е твърде кратко.";
  if (PHONE_RE.test(t))
    return "Умението не може да съдържа телефонен номер. Контактите се споделят само през платформата, след отключване.";
  if (EMAIL_RE.test(t))
    return "Умението не може да съдържа имейл адрес. Контактите се споделят само през платформата.";
  if (URL_RE.test(t)) return "Умението не може да съдържа уеб адрес или линк.";
  if (HANDLE_RE.test(t))
    return "Умението не може да съдържа профил в месинджър или социална мрежа.";
  return null;
}
