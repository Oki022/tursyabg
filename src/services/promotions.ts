import { supabase } from "@/integrations/supabase/client";

export type PromoType = "bump" | "urgent" | "top";

export type PromoProduct = {
  id: string;
  code: string;
  name: string;
  type: PromoType;
  durationDays: number;
  priceEur: number;
  sortOrder: number;
};

export type TaskPromotion = {
  id: string;
  taskId: string;
  type: PromoType;
  startsAt: string;
  expiresAt: string;
};

export const PROMO_DESCRIPTIONS: Record<PromoType, string> = {
  bump: "Задачата ти отива най-отгоре в списъка, все едно е публикувана току-що.",
  urgent: "Показва червен етикет „Спешно“, за да привлече вниманието на майсторите.",
  top: "Задачата се показва в промотираните места най-отгоре в борсата.",
};

export const PROMO_LABELS: Record<PromoType, string> = {
  bump: "Обновяване",
  urgent: "Спешно",
  top: "ТОП",
};

function mapProduct(r: Record<string, any>): PromoProduct {
  return {
    id: r["id"],
    code: r["code"],
    name: r["name_bg"],
    type: r["type"] as PromoType,
    durationDays: r["duration_days"],
    priceEur: Number(r["price_eur"]),
    sortOrder: r["sort_order"],
  };
}

function mapPromotion(r: Record<string, any>): TaskPromotion {
  return {
    id: r["id"],
    taskId: r["task_id"],
    type: r["type"] as PromoType,
    startsAt: r["starts_at"],
    expiresAt: r["expires_at"],
  };
}

export async function listPromoProducts(): Promise<PromoProduct[]> {
  const { data, error } = await supabase
    .from("promo_products")
    .select("id, code, name_bg, type, duration_days, price_eur, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapProduct);
}

/** Active (not yet expired) promotions for one task. */
export async function getTaskPromotions(taskId: string): Promise<TaskPromotion[]> {
  const { data, error } = await supabase
    .from("task_promotions")
    .select("id, task_id, type, starts_at, expires_at")
    .eq("task_id", taskId)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapPromotion);
}

/** Active promotions for all tasks of one owner, keyed by task id. */
export async function getPromotionsByOwner(userId: string): Promise<Record<string, TaskPromotion[]>> {
  const { data, error } = await supabase
    .from("task_promotions")
    .select("id, task_id, type, starts_at, expires_at")
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString());
  if (error) throw error;
  const out: Record<string, TaskPromotion[]> = {};
  for (const row of data ?? []) {
    const p = mapPromotion(row);
    (out[p.taskId] ??= []).push(p);
  }
  return out;
}

export async function canBumpTask(taskId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("can_bump_task", { _task_id: taskId });
  if (error) throw error;
  return Boolean(data);
}

/** "Активна още 4 дни" / "Активна още 3 ч." */
export function remainingLabel(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Изтекла";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `Активна още ${Math.max(1, Math.round(ms / 60_000))} мин.`;
  if (hours < 24) return `Активна още ${hours} ч.`;
  const days = Math.ceil(hours / 24);
  return `Активна още ${days} ${days === 1 ? "ден" : "дни"}`;
}

export function durationLabel(days: number): string {
  if (days <= 0) return "еднократно";
  return `${days} ${days === 1 ? "ден" : "дни"}`;
}

/** Promo products by id (including inactive ones), for rendering payment history. */
export async function getPromoProductsByIds(ids: string[]): Promise<Record<string, PromoProduct>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("promo_products")
    .select("id, code, name_bg, type, duration_days, price_eur, sort_order")
    .in("id", ids);
  if (error) throw error;
  const out: Record<string, PromoProduct> = {};
  for (const row of data ?? []) {
    const p = mapProduct(row);
    out[p.id] = p;
  }
  return out;
}
