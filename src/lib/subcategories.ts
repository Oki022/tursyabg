/**
 * Подкатегории ("вид услуга") за всяка от 10-те категории.
 * Началната страница показва само категориите; подкатегориите се избират при
 * публикуване, във филтъра на борсата и в известията. "drugo" („Друго“) е
 * винаги последна. Задачите отпреди подкатегориите имат null.
 *
 * Правило за нова подкатегория: само ако различен тип изпълнител върши тази
 * работа. Кодовете (id) не се сменят, защото са записани в базата.
 */

export type Subcategory = { id: string; name: string };

export const OTHER_SUBCATEGORY = "drugo";

const other: Subcategory = { id: OTHER_SUBCATEGORY, name: "Друго" };

export const SUBCATEGORIES: Record<string, Subcategory[]> = {
  remonti: [
    { id: "vik", name: "ВиК" },
    { id: "elektro", name: "Електро" },
    { id: "boya-plochki-podove", name: "Боя, плочки и подове" },
    { id: "dograma-pokrivi", name: "Дограма и покриви" },
    { id: "mebeli-montazh", name: "Мебели и монтаж" },
    { id: "bitova-tehnika", name: "Битова техника и климатици" },
    { id: "avtomobili", name: "Автомобили" },
    { id: "selskostopanska-tehnika", name: "Селскостопанска и строителна техника" },
    { id: "drebni-remonti", name: "Дребни ремонти" },
    other,
  ],
  pochistvane: [
    { id: "dom", name: "Дом" },
    { id: "sled-remont", name: "След ремонт" },
    { id: "ofisi-vhodove", name: "Офиси и входове" },
    { id: "prozorci", name: "Прозорци" },
    { id: "meka-mebel-kilimi", name: "Мека мебел и килими" },
    { id: "deca", name: "Гледане на деца" },
    { id: "vazrastni", name: "Грижа за възрастни" },
    other,
  ],
  gradina: [
    { id: "kosene", name: "Косене и поддръжка" },
    { id: "darveta", name: "Дървета" },
    { id: "ozelenyavane", name: "Озеленяване и поливане" },
    other,
  ],
  prevoz: [
    { id: "premestvane", name: "Преместване" },
    { id: "tovari", name: "Превоз на товари" },
    { id: "otpadaci", name: "Извозване на отпадъци" },
    { id: "patna-pomosht", name: "Пътна помощ" },
    other,
  ],
  it: [
    { id: "kompyutri", name: "Компютри и лаптопи" },
    { id: "telefoni", name: "Телефони" },
    { id: "mrezhi", name: "Мрежи и интернет" },
    { id: "videonablyudenie", name: "Видеонаблюдение" },
    { id: "saitove-softuer", name: "Сайтове и софтуер" },
    other,
  ],
  eksperti: [
    { id: "schetovodstvo", name: "Счетоводство" },
    { id: "pravni", name: "Юридически услуги" },
    { id: "prevodi", name: "Преводи" },
    { id: "proektirane", name: "Проектиране" },
    other,
  ],
  uroci: [
    { id: "uchilishtni", name: "Училищни предмети" },
    { id: "ezici", name: "Езици" },
    { id: "muzika-izkustva", name: "Музика и изкуства" },
    { id: "sport", name: "Спорт" },
    { id: "shofyorski", name: "Шофьорски" },
    other,
  ],
  "krasota-zdrave": [
    { id: "kosa", name: "Коса" },
    { id: "nokti", name: "Нокти" },
    { id: "grim-kozmetika", name: "Грим и козметика" },
    { id: "masazh", name: "Масаж" },
    { id: "fitnes", name: "Фитнес" },
    other,
  ],
  domashni: [
    { id: "razhodka-gledane", name: "Разходка и гледане" },
    { id: "gruming", name: "Грумиинг" },
    { id: "dresura", name: "Дресура" },
    other,
  ],
  foto: [
    { id: "foto", name: "Фото" },
    { id: "video", name: "Видео" },
    { id: "keturing", name: "Кетъринг и торти" },
    { id: "muzika-vodesht", name: "Музика и водещ" },
    { id: "animatori", name: "Аниматори и украса" },
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
