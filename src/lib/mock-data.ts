import { Wrench, Sparkles, Truck, Laptop, GraduationCap, Trees, PawPrint, Camera, Package } from "lucide-react";

export type Category = {
  id: string;
  name: string;
  icon: any;
  keywords: string[];
};

export const categories: Category[] = [
  { id: "remonti", name: "Ремонти", icon: Wrench, keywords: ["баня", "плочки", "ремонт", "боядисване", "шпакловка", "ламинат", "кухня", "монтаж", "вик", "ток", "ел"] },
  { id: "pochistvane", name: "Почистване", icon: Sparkles, keywords: ["чистене", "почистване", "пране", "прозорци", "килим"] },
  { id: "prevoz", name: "Превоз и хамали", icon: Truck, keywords: ["превоз", "хамали", "местене", "пренасяне", "товар", "транспорт"] },
  { id: "it", name: "ИТ и техника", icon: Laptop, keywords: ["компютър", "лаптоп", "сайт", "програма", "wifi", "интернет", "техника"] },
  { id: "uroci", name: "Уроци", icon: GraduationCap, keywords: ["урок", "уроци", "обучение", "математика", "английски", "немски"] },
  { id: "gradina", name: "Градина и двор", icon: Trees, keywords: ["градина", "двор", "трева", "косене", "дървета", "храсти"] },
  { id: "domashni", name: "Домашни любимци", icon: PawPrint, keywords: ["куче", "котка", "разходка", "питомец", "любимец"] },
  { id: "foto", name: "Фото и видео", icon: Camera, keywords: ["снимки", "фото", "видео", "сватба", "заснемане"] },
  { id: "drugi", name: "Други", icon: Package, keywords: [] },
];

export const cities = ["София", "Пловдив", "Варна", "Бургас", "Русе", "Стара Загора", "Плевен"];

export const neighborhoodsByCity: Record<string, string[]> = {
  "София": ["Младост", "Лозенец", "Витоша", "Студентски град", "Люлин", "Дружба", "Център"],
  "Пловдив": ["Тракия", "Кючук Париж", "Кършияка", "Смирненски", "Център"],
  "Варна": ["Чайка", "Левски", "Владислав Варненчик", "Аспарухово", "Център"],
  "Бургас": ["Меден рудник", "Славейков", "Изгрев", "Лазур", "Център"],
  "Русе": ["Възраждане", "Дружба", "Здравец", "Център"],
  "Стара Загора": ["Железник", "Казански", "Самара", "Център"],
  "Плевен": ["Сторгозия", "Дружба", "Мара Денчева", "Център"],
};

export type Task = {
  id: string;
  title: string;
  category: string;
  city: string;
  neighborhood: string;
  budget: number;
  description: string;
  postedAt: string;
  author: string;
};

export const mockTasks: Task[] = [
  { id: "1", title: "Ремонт на баня — смяна на плочки", category: "remonti", city: "София", neighborhood: "Младост", budget: 1800, description: "Малка баня, около 4 кв.м. Необходима е пълна подмяна на плочките по стени и под. Материалите ще бъдат осигурени.", postedAt: "преди 2 часа", author: "Мария Петрова" },
  { id: "2", title: "Основно почистване на апартамент след ремонт", category: "pochistvane", city: "Пловдив", neighborhood: "Тракия", budget: 120, description: "Двустаен апартамент, 75 кв.м. Необходимо е почистване на прах, прозорци и измиване на подове.", postedAt: "преди 4 часа", author: "Иван Георгиев" },
  { id: "3", title: "Пренасяне на мебели в нов апартамент", category: "prevoz", city: "София", neighborhood: "Лозенец", budget: 200, description: "Нужни са 2-ма хамали и бус. Разстояние около 8 км в София.", postedAt: "преди 6 часа", author: "Стефан Димитров" },
  { id: "4", title: "Уроци по математика за 11. клас", category: "uroci", city: "Варна", neighborhood: "Чайка", budget: 30, description: "Търся учител за подготовка за матура. 2 часа седмично.", postedAt: "вчера", author: "Елена Тодорова" },
  { id: "5", title: "Косене на трева и подрязване на храсти", category: "gradina", city: "Бургас", neighborhood: "Изгрев", budget: 80, description: "Двор около 300 кв.м. Има налична косачка.", postedAt: "вчера", author: "Петър Николов" },
  { id: "6", title: "Поправка на бавен лаптоп", category: "it", city: "София", neighborhood: "Студентски град", budget: 50, description: "Лаптопът работи много бавно. Необходима е диагностика и евентуално преинсталиране на Windows.", postedAt: "преди 2 дни", author: "Анна Стоянова" },
  { id: "7", title: "Боядисване на хол и спалня", category: "remonti", city: "Пловдив", neighborhood: "Кършияка", budget: 450, description: "Около 45 кв.м обща площ. Бялата боя е осигурена.", postedAt: "преди 2 дни", author: "Георги Илиев" },
  { id: "8", title: "Разходка на куче 3 пъти седмично", category: "domashni", city: "София", neighborhood: "Витоша", budget: 60, description: "Лабрадор, 4 години, спокоен. Разходки по 45 минути.", postedAt: "преди 3 дни", author: "Светла Маринова" },
  { id: "9", title: "Сватбен фотограф за 12 юли", category: "foto", city: "Варна", neighborhood: "Център", budget: 900, description: "Цял ден заснемане — церемония и парти.", postedAt: "преди 3 дни", author: "Николай Христов" },
  { id: "10", title: "Монтаж на климатик", category: "remonti", city: "София", neighborhood: "Дружба", budget: 150, description: "Сплит система, 12000 BTU. Имам всички необходими материали.", postedAt: "преди 4 дни", author: "Виктор Иванов" },
  { id: "11", title: "Седмично почистване на офис", category: "pochistvane", city: "София", neighborhood: "Център", budget: 200, description: "Офис около 80 кв.м, веднъж седмично.", postedAt: "преди 5 дни", author: "Динамо ООД" },
  { id: "12", title: "Уроци по английски за начинаещи", category: "uroci", city: "Пловдив", neighborhood: "Център", budget: 25, description: "Възрастен ученик, начално ниво. Онлайн или присъствено.", postedAt: "преди 5 дни", author: "Радостина К." },
];

export function getCategory(id: string) {
  return categories.find((c) => c.id === id) ?? categories[categories.length - 1];
}

export function detectCategory(title: string): string | null {
  const t = title.toLowerCase();
  for (const cat of categories) {
    if (cat.keywords.some((k) => t.includes(k))) return cat.id;
  }
  return null;
}
