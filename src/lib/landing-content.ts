import { BRAND } from "@/lib/brand";
import type { Category } from "@/lib/mock-data";
import { municipalityLabel, type Municipality } from "@/lib/locations";

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

const OPENINGS = [
  (c: string, city: string) => `Търсиш специалист за ${c.toLowerCase()} в ${city}? Тук намираш реални задачи и изпълнители от района, без посредници и без обаждания на сляпо.`,
  (c: string, city: string) => `${c} в ${city} е една от най-търсените услуги в платформата. Клиентите публикуват задачата си безплатно, а изпълнители от общината се свързват директно с тях.`,
  (c: string, city: string) => `Ако ти трябва изпълнител за ${c.toLowerCase()} в ${city}, това е мястото да сравниш оферти и да избереш човек с реални отзиви.`,
  (c: string, city: string) => `Всяка седмица в ${city} се публикуват нови задачи за ${c.toLowerCase()}. Виж актуалните задачи по-долу и се свържи със заявителя още днес.`,
  (c: string, city: string) => `Нуждата от ${c.toLowerCase()} в ${city} рядко чака. Затова задачите тук се публикуват за минути и стигат директно до хора, които работят в района.`,
  (c: string, city: string) => `В ${city} услугата „${c}“ се търси както в града, така и в околните села от общината. Разгледай кой има нужда от помощ точно сега.`,
];

const MIDDLES = [
  "Публикуването на задача отнема под минута, описваш какво ти трябва, посочваш община и бюджет в евро, а платформата автоматично разпознава категорията.",
  "Не плащаш комисиона върху договорената сума. Клиентът публикува безплатно, а изпълнителят отключва контакт само за задачите, които наистина го интересуват.",
  "Всяка задача съдържа кратко описание, снимки, ориентировъчен бюджет в евро и локация до ниво община или квартал, така че да прецениш дали си струва пътят до обекта.",
  "Рейтингът е двустранен и се отваря чак след като и двете страни са оставили отзив, така оценките остават честни и непроменени под натиск.",
  "Броят на изпълнителите, които могат да отключат един контакт, е ограничен, затова заявителят не получава десетки обаждания за една и съща задача.",
  "Ако задачата е спешна, може да бъде маркирана като такава и излиза по-напред в списъка, без това да променя цената на самата услуга.",
];

const CLOSINGS = [
  (c: string, city: string) => `Разгледай активните задачи за ${c.toLowerCase()} в ${city}, отвори тази, която ти пасва, и започни разговор директно със заявителя.`,
  (c: string, city: string) => `Ако си клиент от ${city}, публикувай своята задача за ${c.toLowerCase()} и получи предложения от местни изпълнители в рамките на часове.`,
  (c: string, city: string) => `Следвай връзките към съседните общини и близките категории, ако не откриваш подходяща задача за ${c.toLowerCase()} точно в ${city}.`,
  (c: string, city: string) => `Запази страницата за ${c.toLowerCase()} в ${city} и се връщай, защото списъкът се обновява при всяка нова публикувана задача.`,
];

const RURAL_NOTE = (m: Municipality) =>
  `Обявите покриват целия район на община ${m.name}, включително по-малките населени места, а не само централната част.`;

const CITY_NOTE = (m: Municipality, neighborhoods: string[]) =>
  neighborhoods.length
    ? `Най-често се търсят изпълнители в ${neighborhoods.slice(0, 4).join(", ")} и централната част на ${m.name}.`
    : `Обявите покриват целия град ${m.name} и близките населени места в общината.`;

/**
 * Deterministic, община + category specific intro (150+ думи) so none of the
 * 265 landing pages reads like a near-duplicate of another.
 */
export function landingIntro(opts: {
  municipality?: Municipality;
  neighborhoods?: string[];
  category?: Category;
}): string {
  const { municipality, category, neighborhoods = [] } = opts;
  const cityName = municipality ? municipalityLabel(municipality.name, municipality.hasNeighborhoods) : "България";
  const catName = category?.name ?? "Услуги и задачи";
  const seed = hash(`${municipality?.slug ?? "bg"}-${category?.id ?? "all"}`);

  const parts = [
    OPENINGS[seed % OPENINGS.length]!(catName, cityName),
    municipality
      ? municipality.hasNeighborhoods
        ? CITY_NOTE(municipality, neighborhoods)
        : RURAL_NOTE(municipality)
      : `Платформата покрива всички 265 общини в страната, от София, Пловдив и Варна до малките общини в Родопите и Северозападна България.`,
    municipality
      ? `Община ${municipality.name} е част от област ${municipality.regionName}, така че задачи от съседните общини също са на един клик разстояние.`
      : `Локацията се избира до ниво община, а в големите градове и до квартал.`,
    MIDDLES[(seed >>> 3) % MIDDLES.length]!,
    MIDDLES[(seed >>> 7) % MIDDLES.length]!,
    category
      ? `В категория „${catName}“ попадат задачи като ${(category.keywords.length ? category.keywords.slice(0, 6) : ["дребни ремонти", "монтаж", "поддръжка"]).join(", ")} и други сходни услуги.`
      : `Категориите обхващат ремонти, почистване, превоз, ИТ поддръжка, уроци, градина, домашни любимци, фото и услуги за красота и здраве.`,
    `${BRAND} свързва хора, които имат нужда от свършена работа, с изпълнители, които я търсят, прозрачно, с публични отзиви и без скрити такси.`,
    CLOSINGS[(seed >>> 5) % CLOSINGS.length]!(catName, cityName),
  ];
  return parts.join(" ");
}

export function landingH1(opts: { municipality?: Municipality; category?: Category }): string {
  const { municipality, category } = opts;
  // "Търся" here is the verb ("I'm looking for"), not the brand name.
  if (municipality && category)
    return `Търся специалист за ${category.name.toLowerCase()} в ${municipalityLabel(municipality.name, municipality.hasNeighborhoods)}`;
  if (municipality)
    return `Търся изпълнител в ${municipalityLabel(municipality.name, municipality.hasNeighborhoods)}, задачи и услуги`;
  if (category) return `${category.name}, задачи и изпълнители в цяла България`;
  return `${BRAND}, задачи и услуги`;
}
