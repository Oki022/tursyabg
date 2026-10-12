import { supabase } from "@/integrations/supabase/client";
import { fetchPublicNames, FALLBACK_NAME } from "@/lib/public-profiles";

export type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  priceEur: number;
  sortOrder: number;
};

export type CreditTransaction = {
  id: string;
  amount: number;
  type: "purchase" | "unlock" | "refund" | "bonus" | "promo_spend";
  taskId: string | null;
  counterpartyId: string | null;
  balanceAfter: number;
  description: string;
  createdAt: string;
};

export type UnlockedTask = {
  unlockId: string;
  taskId: string;
  creditsSpent: number;
  unlockedAt: string;
  expiresAt: string;
  title: string;
  budget: number;
  category: string;
  ownerName: string;
  phone: string | null;
  taskStatus: string;
  taskDeleted: boolean;
};

export type UnlockResult =
  | { ok: true; already: boolean; phone: string | null; name: string | null; creditsSpent: number; unlockId: string }
  | { ok: false; error: string; cost?: number; balance?: number };

export const TRANSACTIONS_PAGE_SIZE = 10;

/** Cost tiers mirror the Postgres get_unlock_cost() function (server is authoritative). */
export function unlockCostForBudget(budget: number): number {
  if (budget <= 100) return 5;
  if (budget <= 300) return 10;
  if (budget <= 800) return 20;
  if (budget <= 2000) return 35;
  if (budget <= 5000) return 55;
  return 80;
}

export function formatEur(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} €`;
}

export function creditsLabel(n: number): string {
  return n === 1 ? "1 точка" : `${n} точки`;
}

export async function getCreditPackages(): Promise<CreditPackage[]> {
  const { data, error } = await supabase
    .from("credit_packages")
    .select("id, name, credits, price_eur, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    credits: p.credits,
    priceEur: Number(p.price_eur),
    sortOrder: p.sort_order,
  }));
}

export async function getCreditBalance(userId: string): Promise<number> {
  const { data, error } = await supabase.from("profiles").select("credits").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data?.credits ?? 0;
}

/** Вярно, когато потребителът вече е похарчил поне веднъж кредити. */
export async function hasSpentCredits(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("credit_transactions")
    .select("id")
    .eq("user_id", userId)
    .in("type", ["unlock", "promo_spend"])
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function getTransactions(page: number): Promise<{ items: CreditTransaction[]; hasMore: boolean }> {
  const from = page * TRANSACTIONS_PAGE_SIZE;
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("id, amount, type, task_id, counterparty_id, balance_after, description, created_at")
    .order("created_at", { ascending: false })
    .range(from, from + TRANSACTIONS_PAGE_SIZE);
  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > TRANSACTIONS_PAGE_SIZE;
  return {
    items: rows.slice(0, TRANSACTIONS_PAGE_SIZE).map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type,
      taskId: t.task_id,
      counterpartyId: t.counterparty_id,
      balanceAfter: t.balance_after,
      description: t.description,
      createdAt: t.created_at,
    })),
    hasMore,
  };
}

export async function getMyUnlock(taskId: string, userId: string) {
  const { data, error } = await supabase
    .from("task_unlocks")
    .select("id, credits_spent, unlocked_at, expires_at")
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUnlockedContact(ownerId: string): Promise<string | null> {
  const { data } = await supabase.from("profile_contacts").select("phone").eq("user_id", ownerId).maybeSingle();
  return data?.phone ?? null;
}

export async function unlockTaskContact(taskId: string): Promise<UnlockResult> {
  const { data, error } = await supabase.rpc("unlock_task_contact", { _task_id: taskId });
  if (error) throw error;
  const r = data as Record<string, unknown>;
  if (r?.["ok"]) {
    return {
      ok: true,
      already: Boolean(r["already"]),
      phone: (r["phone"] as string | null) ?? null,
      name: (r["name"] as string | null) ?? null,
      creditsSpent: Number(r["credits_spent"] ?? 0),
      unlockId: String(r["unlock_id"] ?? ""),
    };
  }
  return {
    ok: false,
    error: String(r?.["error"] ?? "UNKNOWN"),
    cost: r?.["cost"] as number | undefined,
    balance: r?.["balance"] as number | undefined,
  };
}

export async function getMyUnlockedTasks(): Promise<UnlockedTask[]> {
  const { data, error } = await supabase
    .from("task_unlocks")
    .select(
      "id, task_id, credits_spent, unlocked_at, expires_at, tasks(title, budget, category, status, deleted_at, user_id)",
    )
    .order("unlocked_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    id: string;
    task_id: string;
    credits_spent: number;
    unlocked_at: string;
    expires_at: string;
    tasks: {
      title: string;
      budget: number;
      category: string;
      status: string;
      deleted_at: string | null;
      user_id: string;
    } | null;
  }[];

  const ownerIds = [...new Set(rows.map((r) => r.tasks?.user_id).filter(Boolean) as string[])];
  const ownerNames = await fetchPublicNames(ownerIds);
  const phones: Record<string, string | null> = {};
  if (ownerIds.length) {
    const { data: contacts } = await supabase.from("profile_contacts").select("user_id, phone").in("user_id", ownerIds);
    (contacts ?? []).forEach((c) => {
      phones[c.user_id] = c.phone;
    });
  }

  return rows.map((r) => ({
    unlockId: r.id,
    taskId: r.task_id,
    creditsSpent: r.credits_spent,
    unlockedAt: r.unlocked_at,
    expiresAt: r.expires_at,
    title: r.tasks?.title ?? "Задача",
    budget: Number(r.tasks?.budget ?? 0),
    category: r.tasks?.category ?? "",
    ownerName: (r.tasks?.user_id ? ownerNames[r.tasks.user_id] : null) ?? FALLBACK_NAME,
    phone: r.tasks?.user_id ? (phones[r.tasks.user_id] ?? null) : null,
    taskStatus: r.tasks?.status ?? "active",
    taskDeleted: Boolean(r.tasks?.deleted_at),
  }));
}
