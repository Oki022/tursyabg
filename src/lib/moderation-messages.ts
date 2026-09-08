/** Bulgarian explanations for automated moderation outcomes. */

export const MODERATION_CATEGORY_BG: Record<string, string> = {
  scam: "съмнение за измама (предварителни плащания, инвестиционни схеми)",
  quality: "неразбираемо или твърде оскъдно съдържание",
  sexual: "сексуално или интимно съдържание",
  hate: "реч на омразата или обиди по признак",
  threat: "заплахи или насилие",
  illegal: "незаконни стоки или услуги",
  spam: "спам или нежелана реклама",
  nudity: "голота или сексуално съдържание",
  erotica: "еротично съдържание",
  gore: "кръв и жестокост",
  violence: "насилие",
  weapon: "оръжия",
  offensive: "обидни жестове или символи",
  service_ad: "реклама на услуги вместо описание на нужда",
  other: "нарушение на правилата за съдържание",
};

/** Explanation shown when a listing looks like a service advertisement. */
export const SERVICE_AD_HELP =
  "Тук се публикуват задачи, които търсиш да ти бъдат свършени, а не реклами на услуги, които предлагаш. Опиши какво трябва да се направи, къде и за кога, от първо лице. Вместо „Предлагаме ремонти на бани с дългогодишен опит, безплатен оглед“ напиши „Трябва ми ремонт на баня 4 кв.м в Люлин, подмяна на плочки и смесител, до края на месеца“.";

export function categoryBg(category?: string | null) {
  if (!category) return MODERATION_CATEGORY_BG["other"]!;
  return MODERATION_CATEGORY_BG[category] ?? MODERATION_CATEGORY_BG["other"]!;
}

/** Maps a raw DB / server error into a clear Bulgarian explanation. */
export function moderationErrorBg(raw: string): { title: string; description: string } | null {
  if (raw.includes("CONTENT_BLOCKED")) {
    const category = raw.split("CONTENT_BLOCKED:")[1]?.trim().split(/\s/)[0] ?? "other";
    if (category === "service_ad") {
      return {
        title: "Това прилича на реклама на услуга",
        description: SERVICE_AD_HELP,
      };
    }
    return {
      title: "Съдържанието не беше публикувано",
      description: `Текстът съдържа ${categoryBg(category)}. Преформулирай го без забранените изрази и опитай отново. Правилата са в Общите условия.`,
    };
  }
  if (raw.includes("POSTING_SUSPENDED")) {
    return {
      title: "Публикуването е временно спряно",
      description: "Профилът ти е с 7-дневно ограничение заради повторно нарушение на правилата за съдържание.",
    };
  }
  if (raw.includes("PHONE_NOT_VERIFIED")) {
    return {
      title: "Потвърди телефона си",
      description:
        "За да публикуваш задача или да отключиш контакт, трябва да потвърдиш телефонния си номер с код по SMS. Отвори „Влизане и сигурност“ в настройките и натисни „Изпрати код по SMS“.",
    };
  }
  if (raw.includes("ACCOUNT_BANNED")) {
    return {
      title: "Профилът ти е блокиран",
      description: "Не можеш да публикуваш съдържание. Свържи се с екипа, ако смяташ, че има грешка.",
    };
  }
  return null;
}

export const IMAGE_REJECT_BG =
  "Снимката беше отхвърлена от автоматичната проверка и не е запазена.";
export const IMAGE_HELD_BG =
  "Снимката чака ръчен преглед. Задачата ще стане видима, след като модератор я одобри.";
