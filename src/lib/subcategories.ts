/**
 * Подкатегории ("вид услуга") за всяка от 12-те категории.
 * Началната страница показва само категориите; подкатегориите се избират при
 * публикуване, във филтъра на борсата и в известията.
 *
 * Правило: всяка подкатегория е работа, за която един изпълнител може да каже
 * „аз правя това“ (напр. климатик → „Климатици и отопление“), за да може да си
 * пусне известия само за нея. „Друго“ (drugo) е винаги последна.
 * Кодовете (id) са записани в базата: не ги сменяй, добавяй нови.
 */

export type Subcategory = { id: string; name: string };

export const OTHER_SUBCATEGORY = "drugo";

const other: Subcategory = { id: OTHER_SUBCATEGORY, name: "Друго" };

export const SUBCATEGORIES: Record<string, Subcategory[]> = {
  remonti: [
    { id: "vik", name: "ВиК" },
    { id: "elektro", name: "Електро" },
    { id: "klimatici", name: "Климатици и отопление" },
    { id: "boyadisvane", name: "Боядисване и шпакловка" },
    { id: "plochki", name: "Плочки и настилки" },
    { id: "dograma", name: "Дограма и врати" },
    { id: "mebeli", name: "Монтаж на мебели" },
    { id: "drebni-remonti", name: "Дребни ремонти" },
    other,
  ],
  avto: [
    { id: "avtoservis", name: "Автосервиз (механика)" },
    { id: "avtoelektrika", name: "Автоелектроника" },
    { id: "tenekedzhiya", name: "Тенекеджийски и бояджийски" },
    { id: "gumi", name: "Гуми" },
    { id: "diagnostika", name: "Диагностика" },
    { id: "avto-klimatik", name: "Климатик на автомобил" },
    { id: "avtomivka", name: "Автомивка и детайлинг" },
    { id: "motori", name: "Мотоциклети" },
    { id: "tezhka-tehnika", name: "Тежка и селскостопанска техника" },
    other,
  ],
  pochistvane: [
    { id: "dom", name: "Апартаменти и къщи" },
    { id: "sled-remont", name: "След ремонт" },
    { id: "ofisi-vhodove", name: "Офиси и входове" },
    { id: "prozorci", name: "Прозорци" },
    { id: "meka-mebel-kilimi", name: "Пране на мека мебел и килими" },
    { id: "dezinsekciya", name: "Дезинфекция и дезинсекция" },
    other,
  ],
  stroitelstvo: [
    { id: "grub-stroezh", name: "Груб строеж и зидария" },
    { id: "pokrivi", name: "Покриви" },
    { id: "izolaciya-fasadi", name: "Изолация и фасади" },
    { id: "hidroizolaciya", name: "Хидроизолация" },
    { id: "kofrazh-beton", name: "Кофраж и бетон" },
    { id: "izkopni", name: "Изкопни дейности" },
    other,
  ],
  gradina: [
    { id: "kosene", name: "Косене и поддръжка" },
    { id: "rezitba", name: "Резитба на дървета и храсти" },
    { id: "ozelenyavane", name: "Озеленяване" },
    { id: "polivni-sistemi", name: "Поливни системи" },
    { id: "parceli", name: "Почистване на парцели" },
    other,
  ],
  prevoz: [
    { id: "premestvane", name: "Преместване" },
    { id: "hamali", name: "Хамали" },
    { id: "tovari", name: "Превоз на товари" },
    { id: "otpadaci", name: "Извозване на отпадъци" },
    { id: "patna-pomosht", name: "Пътна помощ" },
    other,
  ],
  it: [
    { id: "kompyutri", name: "Компютри и лаптопи" },
    { id: "telefoni", name: "Телефони и таблети" },
    { id: "uredi", name: "Ремонт на уреди" },
    { id: "mrezhi", name: "Интернет и мрежи" },
    { id: "videonablyudenie", name: "Видеонаблюдение и аларми" },
    { id: "saitove", name: "Сайтове и онлайн магазини" },
    { id: "softuer", name: "Софтуер и приложения" },
    other,
  ],
  eksperti: [
    { id: "schetovodstvo", name: "Счетоводство" },
    { id: "pravni", name: "Юридически услуги" },
    { id: "prevodi", name: "Преводи" },
    { id: "proektirane", name: "Архитектура и проектиране" },
    { id: "inzheneri", name: "Инженери и надзор" },
    { id: "geodeziya", name: "Геодезия" },
    { id: "ocenki", name: "Оценки на имоти" },
    { id: "marketing", name: "Маркетинг и реклама" },
    { id: "biznes", name: "Бизнес консултации" },
    other,
  ],
  uroci: [
    { id: "uchilishtni", name: "Училищни предмети" },
    { id: "izpiti", name: "Подготовка за изпити" },
    { id: "ezici", name: "Езици" },
    { id: "muzika", name: "Музика" },
    { id: "izkustva", name: "Рисуване и изкуства" },
    { id: "sport", name: "Спорт" },
    { id: "kormuvane", name: "Кормуване" },
    other,
  ],
  "krasota-zdrave": [
    { id: "kosa", name: "Фризьор" },
    { id: "nokti", name: "Маникюр и педикюр" },
    { id: "grim", name: "Грим" },
    { id: "kozmetika", name: "Козметика и мигли" },
    { id: "masazh", name: "Масаж" },
    { id: "fitnes", name: "Личен треньор" },
    other,
  ],
  domashni: [
    { id: "razhodka", name: "Разходка" },
    { id: "gledane", name: "Гледане и пансион" },
    { id: "gruming", name: "Грумиинг" },
    { id: "dresura", name: "Дресура" },
    other,
  ],
  foto: [
    { id: "fotograf", name: "Фотограф" },
    { id: "video", name: "Видеооператор" },
    { id: "dj", name: "DJ и музика" },
    { id: "vodesht", name: "Водещ" },
    { id: "animatori", name: "Аниматори" },
    { id: "ukrasa", name: "Украса" },
    { id: "keturing", name: "Кетъринг и торти" },
    other,
  ],
};

export function subcategoriesFor(category?: string | null): Subcategory[] {
  return (category && SUBCATEGORIES[category]) || [];
}

export function isValidSubcategory(category: string | null | undefined, sub: string | null | undefined): boolean {
  return Boolean(sub) && subcategoriesFor(category).some((s) => s.id === sub);
}

export function subcategoryName(category: string | null | undefined, sub: string | null | undefined): string | null {
  if (!sub) return null;
  return subcategoriesFor(category).find((s) => s.id === sub)?.name ?? null;
}
