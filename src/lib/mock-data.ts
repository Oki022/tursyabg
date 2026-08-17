import { Wrench, Sparkles, Truck, Laptop, GraduationCap, Trees, PawPrint, Camera, Package, HeartPulse } from "lucide-react";

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
  { id: "krasota-zdrave", name: "Красота и здраве", icon: HeartPulse, keywords: ["коса", "фризьор", "маникюр", "грим", "масаж", "козметик", "красота", "здраве"] },
  { id: "drugi", name: "Други", icon: Package, keywords: [] },
];

export const locations: string[] = [
  "София, кв. Младост",
  "София, кв. Люлин",
  "София, Център",
  "София, кв. Лозенец",
  "София, кв. Витоша",
  "София, кв. Студентски град",
  "София, кв. Дружба",
  "Варна, кв. Чайка",
  "Варна, кв. Левски",
  "Варна, Център",
  "Варна, кв. Аспарухово",
  "Пловдив, кв. Тракия",
  "Пловдив, кв. Смирненски",
  "Пловдив, кв. Кършияка",
  "Пловдив, Център",
  "Бургас, кв. Лазур",
  "Бургас, кв. Меден рудник",
  "Бургас, кв. Изгрев",
  "Бургас, Център",
  "Русе, кв. Възраждане",
  "Русе, кв. Здравец",
  "Русе, кв. Дружба",
  "Русе, Център",
  "Стара Загора, кв. Железник",
  "Стара Загора, кв. Казански",
  "Стара Загора, кв. Самара",
  "Стара Загора, Център",
  "Плевен, кв. Сторгозия",
  "Плевен, кв. Дружба",
  "Плевен, кв. Мара Денчева",
  "Плевен, Център",
  "Сливен, кв. Българка",
  "Сливен, кв. Сини камъни",
  "Сливен, Център",
  "Добрич, кв. Балик",
  "Добрич, кв. Дружба",
  "Добрич, Център",
  "Шумен, кв. Тракия",
  "Шумен, кв. Боян Българанов",
  "Шумен, Център",
  "Перник, кв. Изток",
  "Перник, кв. Тева",
  "Перник, Център",
  "Хасково, кв. Орфей",
  "Хасково, кв. Бадема",
  "Хасково, Център",
  "Благоевград, кв. Еленово",
  "Благоевград, кв. Струмско",
  "Благоевград, Център",
  "Велико Търново, кв. Колю Фичето",
  "Велико Търново, кв. Бузлуджа",
  "Велико Търново, кв. Картала",
  "Велико Търново, Център",
];

export const cities = ["София", "Пловдив", "Варна", "Бургас", "Русе", "Стара Загора", "Плевен"];

export type TaskStatus = "active" | "pending" | "pending_payment" | "inactive";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  active: "Активни",
  pending: "Изчакващи",
  pending_payment: "Изчакващи плащане",
  inactive: "Неактивни",
};

export type Task = {
  id: string;
  title: string;
  category: string;
  location: string;
  budget: number;
  description: string;
  postedAt: string;
  author: string;
  image?: string;
  status?: TaskStatus;
};

const img = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

export const CATEGORY_IMAGES: Record<string, string> = {
  remonti: img("photo-1581578731548-c64695cc6952"),
  pochistvane: img("photo-1527515637462-cff94eecc1ac"),
  prevoz: img("photo-1600585154340-be6161a56a0c"),
  it: img("photo-1517336714731-489689fd1ca8"),
  uroci: img("photo-1503676260728-1c00da094a0b"),
  gradina: img("photo-1416879595882-3373a0480b5b"),
  domashni: img("photo-1450778869180-41d0601e046e"),
  foto: img("photo-1519741497674-611481863552"),
  "krasota-zdrave": img("photo-1560750588-73207b1ef5b8"),
  drugi: img("photo-1505691938895-1758d7feb511"),
};

export const mockTasks: Task[] = [
  { id: "1", title: "Ремонт на баня — смяна на плочки", category: "remonti", location: "София, кв. Младост", budget: 1800, description: "Малка баня, около 4 кв.м. Необходима е пълна подмяна на плочките по стени и под. Материалите ще бъдат осигурени.", postedAt: "преди 2 часа", author: "Мария Петрова", image: img("photo-1581578731548-c64695cc6952") },
  { status: "pending", id: "2", title: "Основно почистване на апартамент след ремонт", category: "pochistvane", location: "Пловдив, кв. Тракия", budget: 120, description: "Двустаен апартамент, 75 кв.м. Необходимо е почистване на прах, прозорци и измиване на подове.", postedAt: "преди 4 часа", author: "Иван Георгиев", image: img("photo-1527515637462-cff94eecc1ac") },
  { status: "pending_payment", id: "3", title: "Пренасяне на мебели в нов апартамент", category: "prevoz", location: "София, кв. Лозенец", budget: 200, description: "Нужни са 2-ма хамали и бус. Разстояние около 8 км в София.", postedAt: "преди 6 часа", author: "Стефан Димитров", image: img("photo-1600585154340-be6161a56a0c") },
  { id: "4", title: "Уроци по математика за 11. клас", category: "uroci", location: "Варна, кв. Чайка", budget: 30, description: "Търся учител за подготовка за матура. 2 часа седмично.", postedAt: "вчера", author: "Елена Тодорова", image: img("photo-1503676260728-1c00da094a0b") },
  { status: "inactive", id: "5", title: "Косене на трева и подрязване на храсти", category: "gradina", location: "Бургас, кв. Изгрев", budget: 80, description: "Двор около 300 кв.м. Има налична косачка.", postedAt: "вчера", author: "Петър Николов", image: img("photo-1416879595882-3373a0480b5b") },
  { id: "6", title: "Поправка на бавен лаптоп", category: "it", location: "София, кв. Студентски град", budget: 50, description: "Лаптопът работи много бавно. Необходима е диагностика и евентуално преинсталиране на Windows.", postedAt: "преди 2 дни", author: "Анна Стоянова", image: img("photo-1517336714731-489689fd1ca8") },
  { id: "7", title: "Боядисване на хол и спалня", category: "remonti", location: "Пловдив, кв. Кършияка", budget: 450, description: "Около 45 кв.м обща площ. Бялата боя е осигурена.", postedAt: "преди 2 дни", author: "Георги Илиев", image: img("photo-1604147706283-d7119b5b822c") },
  { id: "8", title: "Разходка на куче 3 пъти седмично", category: "domashni", location: "София, кв. Витоша", budget: 60, description: "Лабрадор, 4 години, спокоен. Разходки по 45 минути.", postedAt: "преди 3 дни", author: "Светла Маринова", image: img("photo-1450778869180-41d0601e046e") },
  { id: "9", title: "Сватбен фотограф за 12 юли", category: "foto", location: "Варна, Център", budget: 900, description: "Цял ден заснемане — церемония и парти.", postedAt: "преди 3 дни", author: "Николай Христов", image: img("photo-1519741497674-611481863552") },
  { id: "10", title: "Монтаж на климатик", category: "remonti", location: "София, кв. Дружба", budget: 150, description: "Сплит система, 12000 BTU. Имам всички необходими материали.", postedAt: "преди 4 дни", author: "Виктор Иванов", image: img("photo-1556909114-f6e7ad7d3136") },
  { id: "11", title: "Седмично почистване на офис", category: "pochistvane", location: "София, Център", budget: 200, description: "Офис около 80 кв.м, веднъж седмично.", postedAt: "преди 5 дни", author: "Динамо ООД", image: img("photo-1581578731548-c64695cc6952") },
  { id: "12", title: "Уроци по английски за начинаещи", category: "uroci", location: "Пловдив, Център", budget: 25, description: "Възрастен ученик, начално ниво. Онлайн или присъствено.", postedAt: "преди 5 дни", author: "Радостина К.", image: img("photo-1503676260728-1c00da094a0b") },
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
