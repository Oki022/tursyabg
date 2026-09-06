/**
 * Client mirror of the server-side content quality rules (see the
 * `text_quality_issue` / `task_content_issue` database functions).
 * Used only for live, helpful feedback — the database remains the source of truth.
 */

export const TITLE_MIN = 10;
export const TITLE_MAX = 100;
export const DESCRIPTION_MIN = 30;
export const DESCRIPTION_MAX = 2000;
export const BUDGET_MIN = 5;
export const BUDGET_MAX = 500000;

const VOWELS = /[аъоуеияюaeiouy]/g;
const KEYBOARD_MASH =
  /(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuio|uiop|zxcv|xcvb|cvbn|vbnm|qazwsx|qwerty|йцук|цуке|укен|фыва|ячсм|абвгд|фдса|дсаф|ждло|ялдж|ъвер|ьбню|ючсм)/;

const letters = (s: string) => s.replace(/[^\p{L}]/gu, "");

export function isGibberish(text: string): boolean {
  const s = (text ?? "").toLowerCase();
  const l = letters(s);
  if (l.length === 0) return true;
  if (/(.)\1{3,}/.test(s)) return true;
  if (KEYBOARD_MASH.test(s)) return true;

  const v = (l.match(VOWELS) ?? []).length;
  if (v === 0) return true;
  if (l.length >= 6) {
    const ratio = v / l.length;
    if (ratio < 0.15 || ratio > 0.85) return true;
  }

  const devoweled = s.replace(VOWELS, " ").replace(/[^\p{L}]/gu, " ");
  if (/\p{L}{5,}/u.test(devoweled)) return true;

  if (l.length >= 8) {
    const counts = new Map<string, number>();
    for (const ch of l) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    if (Math.max(...counts.values()) / l.length > 0.4) return true;
  }
  return false;
}

export type QualityIssue =
  | "TOO_SHORT"
  | "TOO_LONG"
  | "NO_LETTERS"
  | "REPEATED_WORD"
  | "TOO_FEW_WORDS"
  | "GIBBERISH";

export function textQualityIssue(
  text: string,
  minLen: number,
  maxLen: number,
  minWords: number,
): QualityIssue | null {
  const s = (text ?? "").trim();
  if (s.length < minLen) return "TOO_SHORT";
  if (s.length > maxLen) return "TOO_LONG";
  if (letters(s) === "") return "NO_LETTERS";

  const words = s.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2);
  const distinct = new Set(words.map((w) => w.toLowerCase()));
  if (distinct.size === 1 && words.length > 1) return "REPEATED_WORD";
  if (distinct.size < minWords) return "TOO_FEW_WORDS";
  if (isGibberish(s)) return "GIBBERISH";
  return null;
}

const TITLE_MESSAGES: Record<QualityIssue, string> = {
  TOO_SHORT: `Заглавието е твърде кратко. Използвай поне ${TITLE_MIN} знака, например: Ремонт на баня в София.`,
  TOO_LONG: `Заглавието е твърде дълго. Съкрати го до ${TITLE_MAX} знака и остави детайлите за описанието.`,
  NO_LETTERS: "Заглавието трябва да съдържа думи, не само цифри или символи.",
  REPEATED_WORD: "Заглавието повтаря една и съща дума. Опиши накратко каква е задачата.",
  TOO_FEW_WORDS: "Заглавието трябва да съдържа поне 2 думи, например: Косене на трева.",
  GIBBERISH:
    "Заглавието изглежда неразбираемо. Опиши накратко какво търсиш, например: Ремонт на баня в София.",
};

const DESCRIPTION_MESSAGES: Record<QualityIssue, string> = {
  TOO_SHORT: `Описанието е твърде кратко. Използвай поне ${DESCRIPTION_MIN} знака и кажи какво трябва да се направи, кога и има ли специфики.`,
  TOO_LONG: `Описанието е твърде дълго. Съкрати го до ${DESCRIPTION_MAX} знака.`,
  NO_LETTERS: "Описанието трябва да съдържа думи, не само цифри или символи.",
  REPEATED_WORD: "Описанието повтаря една и съща дума. Разкажи с няколко изречения какво ти трябва.",
  TOO_FEW_WORDS: "Описанието трябва да съдържа поне 5 различни думи. Добави повече подробности.",
  GIBBERISH:
    "Описанието изглежда неразбираемо. Опиши с прости думи какво трябва да се направи, например: Трябва да се сменят плочките в баня 4 кв.м. Материалите са купени.",
};

export function titleIssueBg(title: string): string | null {
  const issue = textQualityIssue(title, TITLE_MIN, TITLE_MAX, 2);
  return issue ? TITLE_MESSAGES[issue] : null;
}

export function descriptionIssueBg(description: string, title?: string): string | null {
  const issue = textQualityIssue(description, DESCRIPTION_MIN, DESCRIPTION_MAX, 5);
  if (issue) return DESCRIPTION_MESSAGES[issue];
  if (title && description.trim().toLowerCase() === title.trim().toLowerCase()) {
    return "Описанието не може да е същото като заглавието. Добави подробности за задачата.";
  }
  return null;
}

export function budgetIssueBg(budget: number): string | null {
  if (!budget || budget <= 0 || Number.isNaN(budget)) return "Въведи бюджет в евро, по-голям от 0.";
  if (budget < BUDGET_MIN) return `Бюджетът трябва да е поне ${BUDGET_MIN} €.`;
  if (budget > BUDGET_MAX) return `Бюджетът изглежда нереалистичен. Максимумът е ${BUDGET_MAX} €.`;
  return null;
}

/** Maps a raw `CONTENT_QUALITY:*` database error into Bulgarian. */
export function contentQualityErrorBg(raw: string): { title: string; description: string } | null {
  const match = /CONTENT_QUALITY:([A-Z_]+)/.exec(raw ?? "");
  if (!match) return null;
  const code = match[1]!;
  const [field, ...rest] = code.split("_");
  const issue = rest.join("_") as QualityIssue;

  if (code === "DESCRIPTION_SAME_AS_TITLE") {
    return {
      title: "Описанието е същото като заглавието",
      description: "Добави подробности какво трябва да се направи, кога и има ли специфики.",
    };
  }
  if (field === "BUDGET") {
    return {
      title: "Бюджетът не е валиден",
      description:
        code === "BUDGET_TOO_HIGH"
          ? `Бюджетът изглежда нереалистичен. Максимумът е ${BUDGET_MAX} €.`
          : `Въведи реалистичен бюджет между ${BUDGET_MIN} € и ${BUDGET_MAX} €.`,
    };
  }
  if (field === "COMMENT") {
    return {
      title: "Отзивът не беше запазен",
      description:
        "Коментарът изглежда неразбираем или е твърде кратък. Напиши с няколко думи как мина работата.",
    };
  }
  const messages = field === "TITLE" ? TITLE_MESSAGES : DESCRIPTION_MESSAGES;
  return {
    title: field === "TITLE" ? "Заглавието се нуждае от корекция" : "Описанието се нуждае от корекция",
    description: messages[issue] ?? "Опиши задачата с ясни думи и опитай отново.",
  };
}

type Example = { title: string; description: string };

const EXAMPLES: Record<string, Example> = {
  remonti: {
    title: "Напр. Смяна на плочки в баня в София",
    description:
      "Напр. Банята е 4 кв.м, плочките са купени. Трябва да се вдигнат старите и да се сложат новите. Търся майстор за следващите две седмици.",
  },
  pochistvane: {
    title: "Напр. Основно почистване на двустаен апартамент",
    description:
      "Напр. Апартамент 65 кв.м след ремонт. Нужно е почистване на прозорци, баня и кухня. Препаратите ги осигурявам аз.",
  },
  prevoz: {
    title: "Напр. Превоз на мебели от Люлин до Младост",
    description:
      "Напр. Един гардероб, диван и 10 кашона. Трети етаж без асансьор. Търся хамали с бус за събота сутрин.",
  },
  it: {
    title: "Напр. Настройка на Wi-Fi мрежа в офис",
    description:
      "Напр. Офис от 4 стаи, интернетът прекъсва в дъното. Трябва настройка на рутер и евентуално разширител.",
  },
  uroci: {
    title: "Напр. Уроци по математика за 7 клас",
    description:
      "Напр. Подготовка за НВО, два пъти седмично по 60 минути. Ученикът има пропуски в дробите и уравненията.",
  },
  gradina: {
    title: "Напр. Косене на трева и подрязване на храсти",
    description:
      "Напр. Двор около 300 кв.м в Банкя. Тревата е висока, има и 5 храста за оформяне. Търся човек със собствена техника.",
  },
  domashni: {
    title: "Напр. Разходка на куче всеки делничен ден",
    description:
      "Напр. Лабрадор на 3 години, спокоен. Нужна е разходка от 40 минути около 17 ч. в кв. Лозенец.",
  },
  foto: {
    title: "Напр. Фотограф за рожден ден в Пловдив",
    description:
      "Напр. Празненство за 20 души в събота от 18 ч. Търся фотограф за 3 часа и обработени снимки след това.",
  },
  "krasota-zdrave": {
    title: "Напр. Грим и прическа за сватба",
    description:
      "Напр. Сватба в София на 12 септември. Нужни са грим и прическа за булката и две шаферки, на място в хотела.",
  },
  eksperti: {
    title: "Напр. Счетоводител за годишна данъчна декларация",
    description:
      "Напр. Свободна практика с около 40 фактури за годината. Трябва ми подготовка и подаване на декларацията, работим онлайн.",
  },
  drugi: {
    title: "Напр. Помощ с монтаж на мебели от ИКЕА",
    description:
      "Напр. Гардероб и две нощни шкафчета за сглобяване. Инструментите ги осигурявам аз. Търся човек за уикенда.",
  },
};

export function examplesFor(category?: string): Example {
  return EXAMPLES[category ?? ""] ?? EXAMPLES["drugi"]!;
}
