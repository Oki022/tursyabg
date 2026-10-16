import type { BudgetRange } from "@/lib/budget-range";
import { Wrench, Sparkles, Truck, Laptop, GraduationCap, Trees, PawPrint, Camera, HelpCircle, HeartPulse, Briefcase, Car, HardHat } from "lucide-react";

export type Category = {
  id: string;
  name: string;
  icon: any;
  keywords: string[];
};

export const categories: Category[] = [
  { id: "remonti", name: "Ремонти", icon: Wrench, keywords: ["баня", "плочки", "ремонт", "боядисване", "шпакловка", "ламинат", "кухня", "монтаж", "вик", "ток", "ел", "климатик"] },
  { id: "pochistvane", name: "Почистване", icon: Sparkles, keywords: ["чистене", "почистване", "пране", "прозорци", "килим"] },
  { id: "prevoz", name: "Превоз и хамали", icon: Truck, keywords: ["превоз", "хамали", "местене", "пренасяне", "товар", "транспорт"] },
  { id: "avto", name: "Авто", icon: Car, keywords: ["кола", "автомобил", "автосервиз", "гуми", "мотор", "трактор", "пътна помощ"] },
  { id: "stroitelstvo", name: "Строителство", icon: HardHat, keywords: ["строителство", "строеж", "зидария", "покрив", "изолация", "фасада", "бетон", "къща"] },
  { id: "gradina", name: "Градина и двор", icon: Trees, keywords: ["градина", "двор", "трева", "косене", "дървета", "храсти"] },
  { id: "it", name: "ИТ и техника", icon: Laptop, keywords: ["компютър", "лаптоп", "сайт", "програма", "wifi", "интернет", "техника"] },
  { id: "krasota-zdrave", name: "Красота и здраве", icon: HeartPulse, keywords: ["коса", "фризьор", "маникюр", "грим", "масаж", "козметик", "красота", "здраве"] },
  { id: "uroci", name: "Уроци", icon: GraduationCap, keywords: ["урок", "уроци", "обучение", "математика", "английски", "немски"] },
  { id: "eksperti", name: "Експерти и консултанти", icon: Briefcase, keywords: ["адвокат", "юрист", "счетоводител", "консултант", "нотариус", "данъци", "оценител", "архитект", "инженер", "преводач"] },
  { id: "foto", name: "Фото, видео и забавления", icon: Camera, keywords: ["снимки", "фото", "видео", "сватба", "заснемане", "dj", "аниматор", "кетъринг"] },
  { id: "domashni", name: "Домашни любимци", icon: PawPrint, keywords: ["куче", "котка", "разходка", "питомец", "любимец"] },
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
  /** Subcategory id from src/lib/subcategories.ts; null for tasks from before subcategories. */
  subcategory?: string | null;
  location: string;
  budget: number;
  /** Set when the client chose "По договаряне"; `budget` then holds the range's representative value. */
  budgetRange?: BudgetRange | null;
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
  /** Set when an admin hid the task; the owner cannot bring it back. */
  adminHiddenAt?: string | null;
  /** Set on the source task once it was published again as a copy. */
  repostedAt?: string | null;
  /** Last real content edit (title, description, budget, category, location). */
  contentEditedAt?: string | null;
  statusChangedAtIso?: string;
};

export const UNKNOWN_CATEGORY: Category = {
  id: "",
  name: "Без категория",
  icon: HelpCircle,
  keywords: [],
};

export function getCategory(id: string) {
  return categories.find((c) => c.id === id) ?? UNKNOWN_CATEGORY;
}
