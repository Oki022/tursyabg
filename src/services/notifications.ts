import { supabase } from "@/integrations/supabase/client";
import { fetchPublicNames, FALLBACK_NAME } from "@/lib/public-profiles";

export type NotificationType =
  | "new_message"
  | "contact_unlocked"
  | "task_favourited"
  | "task_expiring"
  | "task_expired"
  | "promo_expiring"
  | "credits_low"
  | "refund_approved"
  | "refund_rejected"
  | "task_reported"
  | "task_still_open"
  | "task_freshness"
  | "refund_auto_approved"
  | "credits_adjusted"
  | "account_restored"
  | "task_removed"
  | "task_category_changed"
  | "review_removed"
  | "engagement_claimed"
  | "engagement_confirmed"
  | "engagement_rejected"
  | "engagement_reminder"
  | "review_requested"
  | "review_reminder"
  | "review_published"
  | "content_rejected"
  | "content_held"
  | "content_approved"
  | "moderation_warning"
  | "account_suspended"
  | "account_banned"
  | "contact_message"
  | "account_deletion_scheduled"
  | "account_deletion_cancelled"
  | "task_alert"
  | "payment_completed"
  | "credits_expiring";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  taskId: string | null;
  actorId: string | null;
  actorName: string | null;
  readAt: string | null;
  createdAt: string;
};

export const NOTIFICATIONS_PAGE_SIZE = 20;

export function relativeTimeBg(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "сега";
  if (min < 60) return `преди ${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `преди ${h} ч`;
  const d = Math.floor(h / 24);
  if (d === 1) return "вчера";
  if (d < 30) return `преди ${d} дни`;
  const m = Math.floor(d / 30);
  return `преди ${m} мес`;
}

// Chat messages surface via the messages icon/badge, never in the bell.
export async function getNotifications(limit = NOTIFICATIONS_PAGE_SIZE): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, task_id, actor_id, read_at, created_at")
    .neq("type", "new_message")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const actorNames = await fetchPublicNames((data ?? []).map((n) => n.actor_id));
  return (data ?? []).map((n) => ({
    id: n.id,
    type: n.type as NotificationType,
    title: n.title,
    body: n.body,
    link: n.link,
    taskId: n.task_id,
    actorId: n.actor_id,
    actorName: n.actor_id ? (actorNames[n.actor_id] ?? FALLBACK_NAME) : null,
    readAt: n.read_at,
    createdAt: n.created_at,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .neq("type", "new_message")
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}

export function subscribeToNotifications(onChange: () => void): () => void {
  const channel = supabase
    .channel(`notifications-live-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => onChange())
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
