import { Wrench, Sparkles, Truck, Laptop, GraduationCap, Trees, PawPrint, Camera, Package, HeartPulse, Briefcase } from "lucide-react";

export type Category = {
  id: string;
  name: string;
  icon: any;
  keywords: string[];
};

export const categories: Category[] = [
  { id: "remonti", name: "Ремонти", icon: Wrench, keywords: ["баня", "плочки", "ремонт", "боядисване", "шпакловка", "ламинат", "кухня", "монтаж", "вик", "ток", "ел"] },
  { id: "pochistvane", name: "Почистване", icon: Sparkles, keywords: ["чистене", "почистване", "пране", "прозорци", "килим"] },
  { id: "gradina", name: "Градина и двор", icon: Trees, keywords: ["градина", "двор", "трева", "косене", "дървета", "храсти"] },
  { id: "prevoz", name: "Превоз и хамали", icon: Truck, keywords: ["превоз", "хамали", "местене", "пренасяне", "товар", "транспорт"] },
  { id: "it", name: "ИТ и техника", icon: Laptop, keywords: ["компютър", "лаптоп", "сайт", "програма", "wifi", "интернет", "техника"] },
  { id: "eksperti", name: "Експерти и консултанти", icon: Briefcase, keywords: ["адвокат", "юрист", "счетоводител", "консултант", "нотариус", "данъци", "оценител", "архитект", "инженер", "преводач"] },
  { id: "uroci", name: "Уроци", icon: GraduationCap, keywords: ["урок", "уроци", "обучение", "математика", "английски", "немски"] },
  { id: "krasota-zdrave", name: "Красота и здраве", icon: HeartPulse, keywords: ["коса", "фризьор", "маникюр", "грим", "масаж", "козметик", "красота", "здраве"] },
  { id: "domashni", name: "Домашни любимци", icon: PawPrint, keywords: ["куче", "котка", "разходка", "питомец", "любимец"] },
  { id: "foto", name: "Фото и видео", icon: Camera, keywords: ["снимки", "фото", "видео", "сватба", "заснемане"] },
  { id: "drugi", name: "Други", icon: Package, keywords: [] },
];



export const cities = ["София", "Пловдив", "Варна", "Бургас", "Русе", "Стара Загора", "Плевен"];

export type TaskStatus = "active" | "assigned" | "pending" | "pending_payment" | "inactive";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  active: "Активни",
  assigned: "Възложени",
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
  userId?: string;
  image?: string;
  status?: TaskStatus;
  unlockCost?: number;
  gallery?: string[];
  /** Promotion state (from the server-side feed ordering). */
  isTop?: boolean;
  isUrgent?: boolean;
  promoExpiresAt?: string | null;
  bumpedAt?: string;
  viewCount?: number;
  /** Contact-unlock slots (max 5 professionals per task by default). */
  unlockCount?: number;
  maxUnlocks?: number;
  /** ISO timestamps used for archiving old tasks. */
  createdAtIso?: string;
  statusChangedAtIso?: string;
};

export function getCategory(id: string) {
  return categories.find((c) => c.id === id) ?? categories[categories.length - 1];
}
