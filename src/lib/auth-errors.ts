import { errorBg, errorRaw } from "@/lib/errors";
import { supabaseAuthErrorBg } from "@/lib/supabase-auth-errors";

/** Превежда техническите грешки от бекенда в разбираем български език. */
export function authErrorMessage(err: unknown): string {
  // `errorRaw` покрива и Supabase обектите `{ message, code, status }`,
  // при които `String(err)` даваше безполезното „[object Object]“.
  const raw = errorRaw(err);

  const known = supabaseAuthErrorBg(raw);
  if (known) {
    return known.description && known.description !== known.title
      ? `${known.title}. ${known.description}`
      : known.title;
  }

  const lower = raw.toLowerCase();
  if (lower.includes("network") || lower.includes("failed to fetch"))
    return "Няма връзка с интернет. Провери мрежата и опитай пак.";

  // Последна инстанция: общият форматер, който също не пропуска английски текст.
  const { title, description } = errorBg(err, { title: "Нещо се обърка" });
  return description && description !== title ? `${title}. ${description}` : title;
}


export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export function emailError(value: string): string | null {
  if (!value) return null;
  return EMAIL_RE.test(value.trim()) ? null : "Въведи валиден имейл, например ivan@example.bg";
}

export function passwordError(value: string): string | null {
  if (!value) return null;
  return value.length < 6 ? "Паролата трябва да е поне 6 символа." : null;
}

export function nameError(value: string): string | null {
  if (!value) return null;
  return value.trim().length < 2 ? "Въведи името си (поне 2 символа)." : null;
}
