import { errorBg, errorRaw } from "@/lib/errors";

/** Превежда техническите грешки от бекенда в разбираем български език. */
export function authErrorMessage(err: unknown): string {
  // `errorRaw` покрива и Supabase обектите `{ message, code, status }`,
  // при които `String(err)` даваше безполезното „[object Object]“.
  const raw = errorRaw(err).toLowerCase();


  if (raw.includes("invalid login credentials") || raw.includes("invalid credentials"))
    return "Грешен имейл или парола. Провери ги и опитай пак.";
  if (raw.includes("already registered") || raw.includes("already been registered") || raw.includes("user already"))
    return "Вече има профил с този имейл. Влез с него или използвай „Забравена парола“.";
  if (raw.includes("password") && (raw.includes("short") || raw.includes("at least") || raw.includes("6 characters")))
    return "Паролата е твърде къса, използвай поне 6 символа.";
  if (raw.includes("pwned") || raw.includes("weak") || raw.includes("compromised"))
    return "Тази парола е твърде лесна за отгатване. Избери по-силна парола.";
  if (raw.includes("invalid email") || raw.includes("email address") && raw.includes("invalid"))
    return "Имейлът изглежда неправилен. Провери дали е изписан вярно.";
  if (raw.includes("rate limit") || raw.includes("too many") || raw.includes("429"))
    return "Твърде много опити. Изчакай минута и опитай отново.";
  if (raw.includes("email not confirmed"))
    return "Имейлът ти още не е потвърден. Провери пощата си.";
  if (raw.includes("network") || raw.includes("fetch"))
    return "Няма връзка с интернет. Провери мрежата и опитай пак.";
  if (raw.includes("signups not allowed") || raw.includes("signup is disabled"))
    return "В момента регистрациите са спрени. Опитай по-късно.";
  if (raw.includes("phone_required"))
    return "Добави телефон в профила си (Настройки → Влизане и сигурност), за да продължиш.";
  if (raw.includes("profile_contacts_phone_valid"))
    return "Въведи валиден български мобилен номер, например 0888123456.";

  // Последна инстанция: общият форматер, вместо анонимно „Нещо се обърка“.
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
