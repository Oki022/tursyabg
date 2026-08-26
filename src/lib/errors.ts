/**
 * Единна обработка на грешки за целия проект.
 *
 * Защо съществува: Supabase/PostgREST не хвърлят `Error` инстанции, а обикновени
 * обекти от вида `{ message, details, hint, code }`. Всеки `catch (e)`, който
 * проверява `e instanceof Error`, мълчаливо губи истинската причина и показва
 * общо съобщение. Тук нормализираме всяка хвърлена стойност и я превеждаме на
 * ясен български език.
 */

import { contentQualityErrorBg } from "@/lib/content-quality";
import { moderationErrorBg } from "@/lib/moderation-messages";

export type AppError = {
  /** Пълен текст (message + details + hint), използван за търсене на кодове. */
  raw: string;
  /** Основното съобщение, ако има такова. */
  message: string;
  details: string;
  hint: string;
  /** Postgres SQLSTATE или PostgREST код, например `23505`, `42501`, `PGRST116`. */
  code: string;
};

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** Нормализира всяка хвърлена стойност: Error, PostgREST обект, string, Response. */
export function toAppError(e: unknown): AppError {
  if (e == null) return { raw: "", message: "", details: "", hint: "", code: "" };

  if (typeof e === "string") return { raw: e, message: e, details: "", hint: "", code: "" };

  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    // Supabase понякога опакова грешката: { error: { message, code } }.
    const inner = o["error"];
    if (inner && typeof inner === "object" && !("raw" in o)) {
      const nested = toAppError(inner);
      if (nested.raw) return nested;
    }
    const message = str(o["message"]);
    const details = str(o["details"]);
    const hint = str(o["hint"]);
    const code = str(o["code"] ?? o["status"]);
    const raw = [message, details, hint, code].filter(Boolean).join(" | ");
    if (raw) return { raw, message, details, hint, code };
  }

  const fallback = str(e);
  return { raw: fallback, message: fallback, details: "", hint: "", code: "" };
}

/** Суровият текст на грешката — заместител на `e instanceof Error ? e.message : ""`. */
export function errorRaw(e: unknown): string {
  return toAppError(e).raw;
}

/**
 * Извлича кода на приложението (`FREE_TASK_LIMIT_REACHED`, `DUPLICATE`, ...).
 * Базите данни ги хвърлят с `RAISE EXCEPTION`, така че кодът е част от текста.
 */
export function errorCode(e: unknown): string {
  const { raw, message } = toAppError(e);
  const exact = message.trim();
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(exact)) return exact;
  const match = /\b([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)\b/.exec(raw);
  return match?.[1] ?? "";
}

/** Кодове на приложението → обяснение на български. */
export const APP_ERROR_BG: Record<string, { title: string; description: string }> = {
  // Публикуване на задачи
  FREE_TASK_LIMIT_REACHED: {
    title: "Достигна лимита от 5 безплатни задачи този месец",
    description: "Можеш да публикуваш нова задача в началото на следващия месец.",
  },
  PHONE_REQUIRED: {
    title: "Липсва телефон в профила ти",
    description: "Добави телефон от Настройки → Влизане и сигурност, за да продължиш.",
  },
  PROFILE_NOT_FOUND: {
    title: "Профилът не е намерен",
    description: "Излез и влез отново в профила си, след което опитай пак.",
  },
  BUDGET_LOWERED: {
    title: "Бюджетът не може да бъде намаляван",
    description: "Майстори вече са платили кредити според текущия бюджет на задачата.",
  },
  TASK_NOT_FOUND: {
    title: "Задачата не е намерена",
    description: "Възможно е да е изтрита или вече да не е публична.",
  },
  TASK_NOT_ACTIVE: {
    title: "Задачата вече не е активна",
    description: "Възложителят я е затворил и тя не приема нови кандидати.",
  },

  // Кредити и отключвания
  INSUFFICIENT_CREDITS: {
    title: "Нямаш достатъчно кредити",
    description: "Купи кредити от Настройки → Баланс и плащания и опитай отново.",
  },
  UNLOCK_LIMIT_REACHED: {
    title: "Местата са запълнени",
    description: "Достигнат е лимитът от отключвания по тази задача.",
  },
  ALREADY_UNLOCKED: {
    title: "Контактът вече е отключен",
    description: "Няма да ти бъдат удържани кредити повторно.",
  },

  // Модерация и ограничения
  SKILL_TAG_BLOCKED: {
    title: "Етикетът не беше приет",
    description: "Един от етикетите съдържа непозволено съдържание. Премахни го и опитай пак.",
  },
  RATE_LIMITED: {
    title: "Твърде много опити",
    description: "Изчакай малко и опитай отново.",
  },
  ACCOUNT_DEACTIVATED: {
    title: "Профилът е деактивиран",
    description: "Активирай профила си отново, за да публикуваш задачи, да отключваш контакти или да изпращаш съобщения.",
  },
  CONTACT_RATE_LIMIT: {
    title: "Твърде много съобщения",
    description: "Изпрати не повече от 5 съобщения на час. Опитай отново по-късно.",
  },

  // Права и валидност
  FORBIDDEN: {
    title: "Нямаш права за това действие",
    description: "Възможно е да си излязъл от профила си или действието да е само за автора.",
  },
  NOT_AUTHENTICATED: {
    title: "Влез в профила си",
    description: "Трябва да си влязъл, за да извършиш това действие.",
  },
  NOT_UNLOCKED: {
    title: "Контактът не е отключен",
    description: "Трябва първо да отключиш контакта по задачата.",
  },
  INVALID_INPUT: {
    title: "Невалидни данни",
    description: "Провери въведените стойности и опитай отново.",
  },
  REASON_REQUIRED: { title: "Причината е задължителна", description: "Опиши накратко причината." },
  NOTE_REQUIRED: { title: "Бележката е задължителна", description: "Опиши накратко решението си." },
  DUPLICATE: { title: "Вече си го направил", description: "Това действие вече е записано." },
  SELF: { title: "Не можеш да го направиш за себе си", description: "Избери друг потребител." },
  NOT_FOUND: { title: "Съдържанието не е налично", description: "Възможно е да е премахнато." },
  ALREADY_RESOLVED: { title: "Вече е обработено", description: "Заявката е приключена по-рано." },
  LAST_ADMIN: {
    title: "Това е последният администратор",
    description: "Профилът не може да бъде блокиран.",
  },
  USER_NOT_FOUND: { title: "Потребителят не е намерен", description: "Опресни списъка и опитай пак." },

  // Отзиви
  ALREADY_CLAIMED: { title: "Вече си заявил тази задача", description: "Изчакай отговор от възложителя." },
  OWN_TASK: { title: "Това е твоята задача", description: "Не можеш да я заявиш като изпълнител." },
  NOT_CONFIRMED: {
    title: "Работата още не е потвърдена",
    description: "Изчакай възложителят да потвърди, за да оставиш отзив.",
  },
  WINDOW_CLOSED: { title: "Срокът изтече", description: "Периодът от 14 дни за отзив приключи." },
  COMMENT_TOO_SHORT: { title: "Коментарът е твърде кратък", description: "Използвай поне 10 символа." },
  COMMENT_TOO_LONG: { title: "Коментарът е твърде дълъг", description: "Съкрати го и опитай пак." },
  INVALID_RATING: { title: "Липсва оценка", description: "Избери оценка от 1 до 5 звезди." },
};

/** Postgres SQLSTATE / PostgREST кодове → обяснение на български. */
const PG_ERROR_BG: Record<string, { title: string; description: string }> = {
  "23505": { title: "Вече съществува", description: "Този запис вече е направен веднъж." },
  "23503": {
    title: "Свързаните данни липсват",
    description: "Записът се отнася до нещо, което вече не съществува.",
  },
  "23514": {
    title: "Данните не отговарят на правилата",
    description: "Провери въведените стойности и опитай отново.",
  },
  "23502": { title: "Липсва задължително поле", description: "Попълни всички полета и опитай пак." },
  "22P02": { title: "Невалидна стойност", description: "Провери въведените данни и опитай отново." },
  "42501": {
    title: "Нямаш права за това действие",
    description: "Влез отново в профила си или се свържи с екипа, ако смяташ, че има грешка.",
  },
  PGRST116: { title: "Записът не е намерен", description: "Възможно е вече да е премахнат." },
  PGRST301: { title: "Сесията е изтекла", description: "Влез отново в профила си и опитай пак." },
  "401": { title: "Сесията е изтекла", description: "Влез отново в профила си и опитай пак." },
  "403": { title: "Нямаш права за това действие", description: "Достъпът е ограничен." },
  "429": { title: "Твърде много опити", description: "Изчакай минута и опитай отново." },
};

const GENERIC = {
  title: "Нещо се обърка",
  description: "Опитай отново след малко. Ако проблемът продължава, пиши ни от страница Контакти.",
};

/**
 * Превежда всяка хвърлена стойност в заглавие + обяснение на български.
 * Обхваща Error, PostgREST обекти, string-ове и вложени `{ error }` обвивки.
 */
export function errorBg(
  e: unknown,
  fallback?: Partial<{ title: string; description: string }>,
): { title: string; description: string } {
  const { raw, code } = toAppError(e);

  const quality = contentQualityErrorBg(raw);
  if (quality) return quality;

  const moderation = moderationErrorBg(raw);
  if (moderation) return moderation;

  const appCode = errorCode(e);
  if (appCode && APP_ERROR_BG[appCode]) return APP_ERROR_BG[appCode]!;

  if (code && PG_ERROR_BG[code]) return PG_ERROR_BG[code]!;

  const lower = raw.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("network")) {
    return { title: "Няма връзка със сървъра", description: "Провери интернет връзката си и опитай пак." };
  }
  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return PG_ERROR_BG["42501"]!;
  }
  if (lower.includes("jwt") || lower.includes("not authenticated")) {
    return { title: "Сесията е изтекла", description: "Влез отново в профила си и опитай пак." };
  }

  return {
    title: fallback?.title ?? GENERIC.title,
    // Суровият текст остава като последна следа, за да не изглежда нищо неслучило се.
    description: fallback?.description ?? (raw || GENERIC.description),
  };
}

/** Едноредова версия за места, където се показва само текст. */
export function errorMessageBg(e: unknown, fallbackTitle?: string): string {
  const { title, description } = errorBg(e, fallbackTitle ? { title: fallbackTitle } : {});
  return description && description !== title ? `${title}. ${description}` : title;
}
