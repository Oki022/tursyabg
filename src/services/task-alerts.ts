import { supabase } from "@/integrations/supabase/client";

/** A saved search: every field is optional, NULL means "any". */
export type TaskAlert = {
  id: string;
  category: string | null;
  /** Municipality name, as stored in tasks.city. */
  city: string | null;
  /** Region (област) slug. */
  region: string | null;
  createdAt: string;
};

export type TaskAlertInput = {
  category?: string | null;
  city?: string | null;
  region?: string | null;
};

export const MAX_TASK_ALERTS = 10;

function clean(input: TaskAlertInput) {
  return {
    category: input.category || null,
    city: input.city || null,
    region: input.region || null,
  };
}

export function sameAlert(a: TaskAlertInput, b: TaskAlertInput): boolean {
  const x = clean(a);
  const y = clean(b);
  return x.category === y.category && x.city === y.city && x.region === y.region;
}

export async function getMyTaskAlerts(): Promise<TaskAlert[]> {
  const { data, error } = await supabase
    .from("task_alerts")
    .select("id, category, city, region, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    category: r.category,
    city: r.city,
    region: r.region,
    createdAt: r.created_at,
  }));
}

/** Throws Error("ALERT_EXISTS") or Error("ALERT_LIMIT") for the two expected failures. */
export async function createTaskAlert(userId: string, input: TaskAlertInput): Promise<void> {
  const { error } = await supabase.from("task_alerts").insert({ user_id: userId, ...clean(input) });
  if (!error) return;
  if (error.code === "23505") throw new Error("ALERT_EXISTS");
  if ((error.message ?? "").includes("ALERT_LIMIT")) throw new Error("ALERT_LIMIT");
  throw error;
}

export async function deleteTaskAlert(id: string): Promise<void> {
  const { error } = await supabase.from("task_alerts").delete().eq("id", id);
  if (error) throw error;
}
