import { BRAND } from "@/lib/brand";
import type { Category } from "@/lib/mock-data";
import type { City } from "@/lib/geo";

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

const OPENINGS = [
  (c: string, city: string) => `Търсиш майстор за ${c.toLowerCase()} в ${city}? Тук намираш реални задачи и изпълнители от квартала, без посредници и без обаждания на сляпо.`,
  (c: string, city: string) => `${c} в ${city} е една от най-търсените услуги в платформата. Клиентите публикуват задачата си безплатно, а проверени изпълнители се свързват директно с тях.`,
  (c: string, city: string) => `Ако ти трябва изпълнител за ${c.toLowerCase()} в ${city}, това е мястото да сравниш оферти и да избереш човек с реални отзиви.`,
  (c: string, city: string) => `Всеки ден в ${city} се публикуват нови задачи за ${c.toLowerCase()}. Виж актуалните обяви по-долу и се свържи със заявителя още днес.`,
];

const MIDDLES = [
  "Публикуването на задача отнема под минута, описваш какво ти трябва, посочваш район и бюджет в евро, а платформата автоматично разпознава категорията.",
  "Не плащаш комисиона върху договорената сума. Клиентът публикува безплатно, а изпълнителят отключва контакт само за задачите, които наистина го интересуват.",
  "Всяка задача съдържа кратко описание, снимки, ориентировъчен бюджет в евро и квартал, така че да прецениш дали си струва пътят до обекта.",
  "Рейтингът е двустранен и се отваря чак след като и двете страни са оставили отзив, така оценките остават честни и непроменени под натиск.",
];

const CLOSINGS = [
  (c: string, city: string) => `Разгледай активните задачи за ${c.toLowerCase()} в ${city}, отвори тази, която ти пасва, и започни разговор директно със заявителя.`,
  (c: string, city: string) => `Ако си клиент от ${city}, публикувай своята задача за ${c.toLowerCase()} и получи предложения от местни майстори в рамките на часове.`,
  (c: string, city: string) => `Следвай връзките към съседните квартали и близките категории, ако не откриваш подходяща задача за ${c.toLowerCase()} точно в ${city}.`,
];

const CITY_CONTEXT = (city: City) =>
  city.neighborhoods.length
    ? `Най-често се търсят изпълнители в ${city.neighborhoods.slice(0, 4).join(", ")} и централната част на ${city.name}.`
    : `Обявите покриват целия град ${city.name} и близките райони.`;

/** Deterministic, city + category specific intro (150+ думи) so pages are not near-duplicates. */
export function landingIntro(opts: { city?: City; category?: Category }): string {
  const { city, category } = opts;
  const cityName = city?.name ?? "България";
  const catName = category?.name ?? "Услуги и задачи";
  const seed = hash(`${city?.slug ?? "bg"}-${category?.id ?? "all"}`);

  const parts = [
    OPENINGS[seed % OPENINGS.length]!(catName, cityName),
    city ? CITY_CONTEXT(city) : `Платформата покрива всички по-големи градове в страната, от София и Пловдив до Варна, Бургас и Русе.`,
    MIDDLES[(seed >> 3) % MIDDLES.length]!,
    MIDDLES[(seed >> 7) % MIDDLES.length]!,
    category
      ? `В категория „${catName}“ попадат задачи като ${(category.keywords.length ? category.keywords.slice(0, 6) : ["дребни ремонти", "монтаж", "поддръжка"]).join(", ")} и други сходни услуги.`
      : `Категориите обхващат ремонти, почистване, превоз, ИТ поддръжка, уроци, градина, домашни любимци, фото и услуги за красота и здраве.`,
    `${BRAND} свързва хора, които имат нужда от свършена работа, с изпълнители, които я търсят, прозрачно, с публични отзиви и без скрити такси.`,
    CLOSINGS[(seed >> 5) % CLOSINGS.length]!(catName, cityName),
  ];
  return parts.join(" ");
}

export function landingH1(opts: { city?: City; category?: Category }): string {
  const { city, category } = opts;
  // "Търся" here is the verb ("I'm looking for"), not the brand name.
  if (city && category) return `Търся майстор за ${category.name.toLowerCase()} в ${city.name}`;
  if (city) return `Търся изпълнител в ${city.name}, задачи и услуги`;
  if (category) return `${category.name}, задачи и майстори в цяла България`;
  return `${BRAND}, задачи и услуги`;
}
