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
  TOO_SHORT: `Описанието е твърде кратко. Използвай поне ${DESCRIPTION_MIN} знака и опиши какво трябва да се направи, кога и има ли специфики.`,
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
  avto: {
    title: "Напр. Смяна на накладки на кола",
    description:
      "Напр. VW Golf 6, предните спирачки свирят. Частите мога да ги купя или да ги осигурите вие.",
  },
  grizha: {
    title: "Напр. Детегледачка за три следобеда седмично",
    description:
      "Напр. Дете на 4 години, взимане от детската градина и игри у дома от 16 до 19 ч.",
  },
  default: {
    title: "Напр. Помощ с монтаж на мебели от ИКЕА",
    description:
      "Напр. Гардероб и две нощни шкафчета за сглобяване. Инструментите ги осигурявам аз. Търся човек за уикенда.",
  },
};


/** Examples per subcategory ("category:subcategory"); "Друго" uses the category example. */
const SUB_EXAMPLES: Record<string, Example> = {
  "remonti:vik": {
    title: "Напр. Смяна на смесител и сифон в баня",
    description: "Напр. Смесителят на мивката тече, а сифонът е стар. Новите са купени. Удобно е в делничен ден след 17 ч.",
  },
  "remonti:elektro": {
    title: "Напр. Монтаж на 3 контакта и нова лампа",
    description: "Напр. Нужни са нови контакти в хола и смяна на полилей с LED плафониера. Стените са тухлени.",
  },
  "remonti:klimatici": {
    title: "Напр. Профилактика на два климатика",
    description: "Напр. Два стенни климатика на 4 години, не изстудяват добре. Нужно е почистване и проверка на фреона.",
  },
  "remonti:boyadisvane": {
    title: "Напр. Шпакловка и боядисване на две стаи",
    description: "Напр. Около 60 кв.м стени, има няколко пукнатини. Боята е бяла, мога да я купя аз.",
  },
  "remonti:plochki": {
    title: "Напр. Смяна на плочки в баня",
    description: "Напр. Банята е 4 кв.м, плочките са купени. Трябва да се свалят старите и да се сложат новите.",
  },
  "remonti:dograma": {
    title: "Напр. Смяна на два прозореца с PVC дограма",
    description: "Напр. Два прозореца 120×140 см на трети етаж. Търся оглед, оферта и монтаж с подмазване.",
  },
  "remonti:pokrivi": {
    title: "Напр. Ремонт на течащ покрив",
    description: "Напр. Покривът на къщата тече на две места след дъжд. Нужни са оглед, подмяна на керемиди и улуци.",
  },
  "remonti:grub-stroezh": {
    title: "Напр. Зидане на стена в двор",
    description: "Напр. Ограден зид около 15 м дължина и 1,5 м височина, тухли или блокчета. Основата е готова.",
  },
  "remonti:uredi": {
    title: "Напр. Пералнята не центрофугира",
    description: "Напр. Пералня Bosch на 6 години, пере, но не изцежда водата и показва грешка. Нужна е диагностика у дома.",
  },
  "remonti:mebeli": {
    title: "Напр. Сглобяване на гардероб и легло от ИКЕА",
    description: "Напр. Гардероб с плъзгащи врати и двойно легло. Мебелите са в кашоните.",
  },
  "remonti:drebni-remonti": {
    title: "Напр. Закачане на рафтове, картини и корниз",
    description: "Напр. Три рафта, четири картини и един корниз в хола. Стените са бетон, нужна е бормашина.",
  },
  "avto:avtoservis": {
    title: "Напр. Смяна на накладки и дискове",
    description: "Напр. VW Golf 6, предните спирачки свирят. Частите мога да ги купя или да ги осигурите вие.",
  },
  "avto:avtoelektrika": {
    title: "Напр. Колата не пали, акумулаторът е нов",
    description: "Напр. Opel Astra 2012, стартерът щрака, но двигателят не се завърта. Акумулаторът е сменен преди месец.",
  },
  "avto:tenekedzhiya": {
    title: "Напр. Изправяне и боядисване на броня",
    description: "Напр. Задната броня е вдлъбната след паркиране, има и драскотини. Кола Toyota Yaris, сив металик.",
  },
  "avto:gumi": {
    title: "Напр. Смяна на зимни гуми с джантите",
    description: "Напр. Четири зимни гуми на джанти, кола Skoda Octavia. Нужни са смяна и баланс.",
  },
  "avto:diagnostika": {
    title: "Напр. Компютърна диагностика, свети check engine",
    description: "Напр. Ford Focus 2015, от вчера свети лампичката за двигателя. Колата върви нормално.",
  },
  "avto:avto-klimatik": {
    title: "Напр. Зареждане на климатика на колата",
    description: "Напр. Климатикът духа топло, кола Renault Megane 2016. Нужна е проверка за теч и зареждане.",
  },
  "avto:avtomivka": {
    title: "Напр. Пране на салон и полиране",
    description: "Напр. Седан с платнени седалки, има петна по задната седалка. Искам и външно полиране.",
  },
  "avto:patna-pomosht": {
    title: "Напр. Пътна помощ до сервиз",
    description: "Напр. Лека кола, не запалва на паркинг. Трябва да се закара до сервиз на 10 км.",
  },
  "avto:motori": {
    title: "Напр. Обслужване на скутер",
    description: "Напр. Скутер 125 куб.см, нужна е смяна на масло, свещ и проверка на спирачките преди сезона.",
  },
  "avto:tezhka-tehnika": {
    title: "Напр. Ремонт на трактор, не пали",
    description: "Напр. Трактор Беларус 82, не запалва от два дни. Има ток, но стартерът само щрака.",
  },
  "pochistvane:dom": {
    title: "Напр. Основно почистване на двустаен апартамент",
    description: "Напр. Апартамент 65 кв.м, баня, кухня и прозорци. Препаратите ги осигурявам аз.",
  },
  "pochistvane:sled-remont": {
    title: "Напр. Почистване на къща след ремонт",
    description: "Напр. Къща 120 кв.м след боядисване и подмяна на плочки. Има прах и петна от боя по подовете.",
  },
  "pochistvane:ofisi-vhodove": {
    title: "Напр. Почистване на вход веднъж седмично",
    description: "Напр. Вход на 6 етажа с асансьор. Миене на стълбите, парапетите и входната врата.",
  },
  "pochistvane:prozorci": {
    title: "Напр. Измиване на прозорци и дограма",
    description: "Напр. Апартамент с 8 прозореца и голям остъклен балкон, пети етаж.",
  },
  "pochistvane:meka-mebel-kilimi": {
    title: "Напр. Изпиране на ъглов диван и килим",
    description: "Напр. Ъглов диван и килим 2×3 м, има петна от кафе. Предпочитам на място у дома.",
  },
  "pochistvane:dezinsekciya": {
    title: "Напр. Пръскане против хлебарки",
    description: "Напр. Двустаен апартамент, хлебарки в кухнята и банята. Нужно е третиране и повторно след 2 седмици.",
  },
  "grizha:deca": {
    title: "Напр. Детегледачка за дете на 4 години",
    description: "Напр. Три следобеда седмично от 16 до 19 ч. Взимане от детската градина и игри у дома.",
  },
  "grizha:vazrastni": {
    title: "Напр. Грижа за възрастна жена през деня",
    description: "Напр. Помощ с храна, лекарства и разходка за баба на 82 години, делнични дни от 9 до 14 ч.",
  },
  "grizha:domashna-pomosht": {
    title: "Напр. Домашна помощница два пъти седмично",
    description: "Напр. Подреждане, пране и пазаруване в къща с трима души, вторник и петък сутрин.",
  },
  "grizha:gladene": {
    title: "Напр. Гладене на дрехи веднъж седмично",
    description: "Напр. Около 20 ризи и спално бельо седмично. Може у дома или да ги взимате.",
  },
  "grizha:gotvene": {
    title: "Напр. Готвене на домашна храна за седмицата",
    description: "Напр. Сготвени ястия за двама души за 5 дни, без месо. Продуктите ги осигурявам аз.",
  },
  "gradina:kosene": {
    title: "Напр. Косене на трева в двор",
    description: "Напр. Двор около 400 кв.м, тревата е висока. Търся човек със собствена косачка, по възможност редовно.",
  },
  "gradina:rezitba": {
    title: "Напр. Резитба на овощни дървета",
    description: "Напр. Шест овощни дървета и жив плет около 20 м в двора на къща. Клоните трябва да се извозят.",
  },
  "gradina:ozelenyavane": {
    title: "Напр. Озеленяване на нов двор",
    description: "Напр. Двор около 150 кв.м пред къща. Нужни са тревен чим, няколко храста и цветна леха.",
  },
  "gradina:polivni-sistemi": {
    title: "Напр. Поливна система за градина",
    description: "Напр. Градина 200 кв.м с тревна площ и храсти. Искам автоматично поливане с таймер.",
  },
  "gradina:ogradi": {
    title: "Напр. Нова ограда от мрежа",
    description: "Напр. Около 40 м ограда с оградна мрежа и метални колове, плюс една врата за кола.",
  },
  "gradina:parceli": {
    title: "Напр. Почистване на обрасъл парцел",
    description: "Напр. Парцел около 1 декар, обрасъл с трева и храсталаци. Нужно е изсичане и извозване.",
  },
  "prevoz:premestvane": {
    title: "Напр. Преместване на двустаен апартамент",
    description: "Напр. Мебели и около 30 кашона от трети етаж без асансьор до нов адрес в същия град.",
  },
  "prevoz:hamali": {
    title: "Напр. Двама хамали за качване на мебели",
    description: "Напр. Нов диван и гардероб трябва да се качат на четвърти етаж без асансьор. Около час работа.",
  },
  "prevoz:tovari": {
    title: "Напр. Превоз на палети от склад",
    description: "Напр. Четири палета с плочки, общо около 1,5 тона, от склад до къща на 40 км.",
  },
  "prevoz:otpadaci": {
    title: "Напр. Извозване на строителни отпадъци",
    description: "Напр. Около 3 куб.м отпадъци след ремонт на баня, в чували пред входа.",
  },
  "it:kompyutri": {
    title: "Напр. Лаптопът е много бавен",
    description: "Напр. Лаптоп на 5 години с Windows 10, бави се и прегрява. Трябва почистване и преинсталиране.",
  },
  "it:telefoni": {
    title: "Напр. Смяна на счупен дисплей на телефон",
    description: "Напр. Samsung Galaxy A52, екранът е счупен, но телефонът работи.",
  },
  "it:mrezhi": {
    title: "Напр. Wi-Fi не стига до всички стаи",
    description: "Напр. Къща на два етажа, на втория етаж няма интернет. Търся настройка или нов рутер.",
  },
  "it:videonablyudenie": {
    title: "Напр. Монтаж на 4 камери за видеонаблюдение",
    description: "Напр. Къща с двор, искам 4 външни камери и запис с достъп от телефона.",
  },
  "it:saitove": {
    title: "Напр. Онлайн магазин за ръчно изработени бижута",
    description: "Напр. Около 50 продукта, плащане с карта и наложен платеж. Имам снимки и описания.",
  },
  "it:softuer": {
    title: "Напр. Програма за записване на часове",
    description: "Напр. Малък салон, искам клиентите да си записват час онлайн и да получават напомняне.",
  },
  "eksperti:schetovodstvo": {
    title: "Напр. Счетоводител за ЕООД",
    description: "Напр. Малка фирма с около 20 фактури месечно, без служители. Търся месечно обслужване.",
  },
  "eksperti:pravni": {
    title: "Напр. Консултация с адвокат за наем",
    description: "Напр. Наемателят не плаща от три месеца. Нужен е съвет какви са следващите стъпки.",
  },
  "eksperti:prevodi": {
    title: "Напр. Превод на диплома от английски",
    description: "Напр. Една диплома и едно приложение, нужен е заклет превод с легализация.",
  },
  "eksperti:proektirane": {
    title: "Напр. Проект за пристройка към къща",
    description: "Напр. Пристройка около 25 кв.м към едноетажна къща. Нужен е архитектурен проект.",
  },
  "eksperti:inzheneri": {
    title: "Напр. Енергиен паспорт на сграда",
    description: "Напр. Жилищна сграда на 4 етажа, нужни са обследване и енергиен паспорт.",
  },
  "eksperti:geodeziya": {
    title: "Напр. Трасиране на граници на парцел",
    description: "Напр. Парцел в село, съседите оспорват оградата. Нужно е геодезично заснемане и трасиране.",
  },
  "eksperti:ocenki": {
    title: "Напр. Пазарна оценка на апартамент",
    description: "Напр. Тристаен апартамент 90 кв.м, оценката е нужна за банка.",
  },
  "eksperti:marketing": {
    title: "Напр. Реклама във Facebook за нов ресторант",
    description: "Напр. Нов ресторант в града, искам кампания за първия месец и няколко поста седмично.",
  },
  "eksperti:biznes": {
    title: "Напр. Бизнес план за кандидатстване по програма",
    description: "Напр. Малка производствена фирма, кандидатстваме за европейско финансиране до края на месеца.",
  },
  "uroci:uchilishtni": {
    title: "Напр. Уроци по математика за 7 клас",
    description: "Напр. Два пъти седмично по 60 минути. Ученикът има пропуски в дробите и уравненията.",
  },
  "uroci:izpiti": {
    title: "Напр. Подготовка за матура по български",
    description: "Напр. Ученичка в 12 клас, матура през май. Нужни са упражнения по есе и тестова част.",
  },
  "uroci:ezici": {
    title: "Напр. Уроци по английски за възрастен",
    description: "Напр. Начинаещ, искам да говоря свободно за пътувания. Два пъти седмично, онлайн или на място.",
  },
  "uroci:muzika": {
    title: "Напр. Уроци по китара за дете на 10 години",
    description: "Напр. Начинаещ, има собствена китара. Веднъж седмично по 45 минути.",
  },
  "uroci:izkustva": {
    title: "Напр. Уроци по рисуване за начинаещи",
    description: "Напр. Възрастен, искам да се науча да рисувам с акварел. Веднъж седмично.",
  },
  "uroci:sport": {
    title: "Напр. Уроци по плуване за дете",
    description: "Напр. Дете на 6 години, не може да плува. Търся индивидуален треньор в басейн.",
  },
  "uroci:kormuvane": {
    title: "Напр. Допълнителни часове по кормуване",
    description: "Напр. Имам книжка, но нямам практика в града. Търся 5–6 часа с инструктор.",
  },
  "krasota-zdrave:kosa": {
    title: "Напр. Подстригване и боядисване на коса",
    description: "Напр. Средно дълга коса, искам кичури и подстригване. Може в салон или у дома.",
  },
  "krasota-zdrave:nokti": {
    title: "Напр. Маникюр с гел лак",
    description: "Напр. Маникюр с гел лак и лек дизайн, в събота преди обед.",
  },
  "krasota-zdrave:grim": {
    title: "Напр. Грим за сватба",
    description: "Напр. Грим за булката и две шаферки на място в хотела, 12 септември сутринта.",
  },
  "krasota-zdrave:kozmetika": {
    title: "Напр. Поставяне на мигли косъм по косъм",
    description: "Напр. Първо поставяне, естествен ефект. Удобно след 18 ч. в делничен ден.",
  },
  "krasota-zdrave:masazh": {
    title: "Напр. Масаж на гръб и врат",
    description: "Напр. Болки във врата от работа на компютър. Търся масажист, удобно у дома.",
  },
  "krasota-zdrave:fitnes": {
    title: "Напр. Личен треньор за отслабване",
    description: "Напр. Три тренировки седмично в зала или на открито, начинаещ.",
  },
  "domashni:razhodka": {
    title: "Напр. Разходка на куче всеки делничен ден",
    description: "Напр. Лабрадор на 3 години, спокоен. Разходка от 40 минути около 17 ч.",
  },
  "domashni:gledane": {
    title: "Напр. Гледане на котка за една седмица",
    description: "Напр. Котка на 5 години, нужни са хранене и почистване на тоалетната веднъж дневно у дома.",
  },
  "domashni:gruming": {
    title: "Напр. Подстригване и къпане на куче",
    description: "Напр. Пудел, 8 кг, има сплъстена козина. Предпочитам у дома.",
  },
  "domashni:dresura": {
    title: "Напр. Дресура на куче, което дърпа каишката",
    description: "Напр. Куче на 1 година, дърпа и лае по други кучета. Търся няколко занятия.",
  },
  "foto:fotograf": {
    title: "Напр. Фотограф за рожден ден",
    description: "Напр. Празненство за 20 души в събота от 18 ч. Търся фотограф за 3 часа и обработени снимки.",
  },
  "foto:video": {
    title: "Напр. Видео от сватба",
    description: "Напр. Сватба в събота, нужно е заснемане от църквата до ресторанта и монтаж на клип.",
  },
  "foto:dj": {
    title: "Напр. DJ за абитуриентски бал",
    description: "Напр. Около 150 гости в ресторант, от 20 до 3 ч. Нужна е и озвучителна техника.",
  },
  "foto:vodesht": {
    title: "Напр. Водещ за сватба",
    description: "Напр. Сватба за 120 гости, нужен е водещ с игри и програма за вечерта.",
  },
  "foto:animatori": {
    title: "Напр. Аниматор за детски рожден ден",
    description: "Напр. Рожден ден за 15 деца на 5 години, 2 часа игри и рисуване по лицето.",
  },
  "foto:ukrasa": {
    title: "Напр. Украса с балони за кръщене",
    description: "Напр. Арка от балони и украса на масите в ресторант, в бяло и златисто.",
  },
  "foto:keturing": {
    title: "Напр. Кетъринг за фирмено парти",
    description: "Напр. Хапки и напитки за 40 души, в офис, петък от 18 ч.",
  },
};

export function examplesFor(category?: string, subcategory?: string | null): Example {
  return (
    (subcategory ? SUB_EXAMPLES[`${category ?? ""}:${subcategory}`] : undefined) ??
    EXAMPLES[category ?? ""] ??
    EXAMPLES["default"]!
  );
}
