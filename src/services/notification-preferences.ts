import { supabase } from "@/integrations/supabase/client";

export type NotificationGroup =
  | "messages"
  | "tasks"
  | "promotions"
  | "credits"
  | "reviews"
  | "moderation";

export type NotificationPreferences = Record<NotificationGroup, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  messages: true,
  tasks: true,
  promotions: true,
  credits: true,
  reviews: true,
  moderation: true,
};

export const NOTIFICATION_GROUPS: {
  key: NotificationGroup;
  title: string;
  description: string;
}[] = [
  {
    key: "messages",
    title: "Съобщения",
    description: "Известия за нови съобщения по твоите разговори.",
  },
  {
    key: "tasks",
    title: "Задачи",
    description: "Изтичащи задачи, напомняния за актуалност и все още отворени задачи.",
  },
  {
    key: "promotions",
    title: "Промоции",
    description: "Напомняния, когато промоция на задача изтича.",
  },
  {
    key: "credits",
    title: "Кредити и плащания",
    description: "Отключени контакти и предупреждение при нисък баланс.",
  },
  {
    key: "reviews",
    title: "Отзиви и възлагане",
    description: "Заявки за възлагане, потвърждения и покани за отзив.",
  },
  {
    key: "moderation",
    title: "Модерация",
    description: "Одобрено съдържание и сигнали по твои задачи.",
  },
];

export async function getMyNotificationPreferences(): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("messages, tasks, promotions, credits, reviews, moderation")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  return {
    messages: data.messages,
    tasks: data.tasks,
    promotions: data.promotions,
    credits: data.credits,
    reviews: data.reviews,
    moderation: data.moderation,
  };
}

export async function setMyNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences,
): Promise<void> {
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: userId, ...prefs }, { onConflict: "user_id" });
  if (error) throw error;
}
