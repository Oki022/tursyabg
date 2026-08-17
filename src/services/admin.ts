import { supabase } from "@/integrations/supabase/client";
import { getImageUrls } from "@/services/storage";

export type RefundStatus = "pending" | "approved" | "rejected";
export type ReportStatus = "pending" | "reviewed" | "dismissed";
export type AppRole = "user" | "moderator" | "admin";

export type StaffRole = { isAdmin: boolean; isModerator: boolean };

export async function getMyStaffRole(): Promise<StaffRole> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return { isAdmin: false, isModerator: false };
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
  const roles = (data ?? []).map((r) => r.role);
  return { isAdmin: roles.includes("admin"), isModerator: roles.includes("moderator") };
}

export type DashboardStats = {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  total_tasks: number;
  active_tasks: number;
  tasks_7d: number;
  tasks_30d: number;
  credits_sold: number;
  revenue_total: number;
  revenue_7d: number;
  revenue_30d: number;
  unlocks_total: number;
  pending_refunds: number;
  auto_refunds_30d: number;
  manual_refunds_30d: number;
  flagged_users: number;
  assigned_tasks: number;
  pending_reports: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc("admin_dashboard_stats");
  if (error) throw error;
  return data as unknown as DashboardStats;
}

export async function getDailySeries() {
  const { data, error } = await supabase.rpc("admin_daily_series");
  if (error) throw error;
  return (data ?? []) as { day: string; signups: number; tasks: number }[];
}

/* ---------------- refunds ---------------- */

export type AdminRefundRequest = {
  id: string;
  status: RefundStatus;
  reason: string;
  details: string;
  adminNote: string;
  resolution: string;
  autoRule: string | null;
  createdAt: string;
  resolvedAt: string | null;
  userId: string;
  userName: string;
  credits: number;
  taskId: string | null;
  taskTitle: string;
};

export const REFUND_REASON_BG: Record<string, string> = {
  fake_task: "Фалшива задача",
  already_taken: "Вече е заета",
  no_response: "Няма отговор",
  wrong_category: "Грешна категория",
  other: "Друго",
};

export const AUTO_RULE_BG: Record<string, string> = {
  already_taken_closed: "Задачата е затворена след отключването",
  no_response_confirmed: "Няма отговор след 5 дни и изпратено съобщение",
  fake_task_reported: "Задачата е докладвана от 3+ потребители",
};

export async function getRefundRequests(status: RefundStatus | "all"): Promise<AdminRefundRequest[]> {
  let query = supabase
    .from("credit_refund_requests")
    .select(
      "id, status, reason, details, admin_note, resolution, auto_rule, created_at, resolved_at, user_id, unlock_id, profiles(full_name), task_unlocks(credits_spent, task_id, tasks(title))",
    )
    .order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    id: string;
    status: RefundStatus;
    reason: string;
    details: string;
    admin_note: string;
    resolution: string;
    auto_rule: string | null;
    created_at: string;
    resolved_at: string | null;
    user_id: string;
    profiles: { full_name: string | null } | null;
    task_unlocks: { credits_spent: number; task_id: string; tasks: { title: string } | null } | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    reason: r.reason,
    details: r.details,
    adminNote: r.admin_note ?? "",
    resolution: r.resolution ?? "manual",
    autoRule: r.auto_rule,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    userId: r.user_id,
    userName: r.profiles?.full_name ?? "Потребител",
    credits: r.task_unlocks?.credits_spent ?? 0,
    taskId: r.task_unlocks?.task_id ?? null,
    taskTitle: r.task_unlocks?.tasks?.title ?? "Задача",
  }));
}

export async function resolveRefund(input: { requestId: string; approve: boolean; note: string }) {
  const { data, error } = await supabase.rpc("admin_resolve_refund", {
    _request_id: input.requestId,
    _approve: input.approve,
    _note: input.note,
  });
  if (error) throw error;
  const r = data as Record<string, unknown>;
  if (!r?.["ok"]) throw new Error(String(r?.["error"] ?? "UNKNOWN"));
  return r;
}

/* ---------------- tasks ---------------- */

export type AdminTask = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  budget: number;
  city: string | null;
  neighborhood: string | null;
  createdAt: string;
  userId: string;
  authorName: string;
  images: string[];
  reportCount: number;
};

export type AdminTaskFilters = {
  status: string;
  category: string;
  city: string;
  days: string;
  reportedOnly: boolean;
};

export async function getAdminTasks(filters: AdminTaskFilters): Promise<AdminTask[]> {
  let query = supabase
    .from("tasks")
    .select(
      "id, title, description, category, status, budget, city, neighborhood, created_at, user_id, profiles(full_name), task_images(image_url, sort_order)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.status !== "all") query = query.eq("status", filters.status as never);
  if (filters.category !== "all") query = query.eq("category", filters.category);
  if (filters.city !== "all") query = query.eq("city", filters.city);
  if (filters.days !== "all") {
    const since = new Date(Date.now() - Number(filters.days) * 86400000).toISOString();
    query = query.gte("created_at", since);
  }

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    id: string;
    title: string;
    description: string;
    category: string;
    status: string;
    budget: number;
    city: string | null;
    neighborhood: string | null;
    created_at: string;
    user_id: string;
    profiles: { full_name: string | null } | null;
    task_images: { image_url: string; sort_order: number }[] | null;
  }[];

  const { data: reports } = await supabase.from("task_reports").select("task_id").eq("status", "pending");
  const counts = new Map<string, number>();
  (reports ?? []).forEach((r) => counts.set(r.task_id, (counts.get(r.task_id) ?? 0) + 1));

  const mapped = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      status: r.status,
      budget: Number(r.budget),
      city: r.city,
      neighborhood: r.neighborhood,
      createdAt: r.created_at,
      userId: r.user_id,
      authorName: r.profiles?.full_name ?? "Потребител",
      images: await getImageUrls(
        (r.task_images ?? []).sort((a, b) => a.sort_order - b.sort_order).map((i) => i.image_url),
      ),
      reportCount: counts.get(r.id) ?? 0,
    })),
  );

  return filters.reportedOnly ? mapped.filter((t) => t.reportCount > 0) : mapped;
}

export async function deactivateTask(taskId: string, reason: string) {
  const { error } = await supabase.from("tasks").update({ status: "inactive" }).eq("id", taskId);
  if (error) throw error;
  await supabase.rpc("log_admin_action", {
    _action_type: "task_deactivated",
    _target_type: "task",
    _target_id: taskId,
    _details: { reason },
  });
}

export async function activateTask(taskId: string) {
  const { error } = await supabase.from("tasks").update({ status: "active" }).eq("id", taskId);
  if (error) throw error;
  await supabase.rpc("log_admin_action", {
    _action_type: "task_activated",
    _target_type: "task",
    _target_id: taskId,
    _details: {},
  });
}

export async function updateTaskCategory(taskId: string, category: string) {
  const { data, error } = await supabase.rpc("admin_correct_task_category", {
    _task_id: taskId,
    _category: category,
  });
  if (error) throw error;
  const r = data as Record<string, unknown>;
  if (!r?.["ok"]) throw new Error(String(r?.["error"] ?? "UNKNOWN"));
}

export async function deleteTask(taskId: string, reason: string, fraudulent = false) {
  const { data, error } = await supabase.rpc("admin_delete_task", {
    _task_id: taskId,
    _reason: reason,
    _fraudulent: fraudulent,
  });
  if (error) throw error;
  const r = data as Record<string, unknown>;
  if (!r?.["ok"]) throw new Error(String(r?.["error"] ?? "UNKNOWN"));
}

/** Context the admin needs to judge a refund request without leaving the queue. */
export type RefundEvidence = {
  found: boolean;
  task_status?: string;
  days_since_unlock?: number;
  messages_sent?: number;
  owner_replies?: number;
  report_count?: number;
  auto_refunds_30d?: number;
  user_unlocks?: number;
  user_refund_requests?: number;
  flagged?: boolean;
};

export async function getRefundEvidence(requestId: string): Promise<RefundEvidence> {
  const { data, error } = await supabase.rpc("admin_refund_evidence", { _request_id: requestId });
  if (error) throw error;
  return (data ?? { found: false }) as unknown as RefundEvidence;
}

/* ---------------- reports ---------------- */

export const REPORT_REASON_BG: Record<string, string> = {
  spam: "Спам",
  fraud: "Измама",
  inappropriate: "Неподходящо съдържание",
  wrong_category: "Грешна категория",
  duplicate: "Дублирана задача",
  other: "Друго",
};

export type AdminReport = {
  id: string;
  taskId: string;
  taskTitle: string;
  reason: string;
  details: string;
  status: ReportStatus;
  createdAt: string;
  reporterName: string;
};

export async function getPendingReports(): Promise<AdminReport[]> {
  const { data, error } = await supabase
    .from("task_reports")
    .select("id, task_id, reason, details, status, created_at, profiles(full_name), tasks(title)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as {
    id: string;
    task_id: string;
    reason: string;
    details: string;
    status: ReportStatus;
    created_at: string;
    profiles: { full_name: string | null } | null;
    tasks: { title: string } | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    taskId: r.task_id,
    taskTitle: r.tasks?.title ?? "Задача",
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: r.created_at,
    reporterName: r.profiles?.full_name ?? "Потребител",
  }));
}

export async function setReportStatus(reportId: string, status: ReportStatus) {
  const { error } = await supabase.from("task_reports").update({ status }).eq("id", reportId);
  if (error) throw error;
  await supabase.rpc("log_admin_action", {
    _action_type: "report_" + status,
    _target_type: "task_report",
    _target_id: reportId,
    _details: {},
  });
}

export async function reportTask(input: { taskId: string; reason: string; details: string }) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("NOT_AUTHENTICATED");
  const { error } = await supabase.from("task_reports").insert({
    task_id: input.taskId,
    reporter_id: uid,
    reason: input.reason as never,
    details: input.details,
  });
  if (error) {
    if (error.code === "23505") throw new Error("DUPLICATE");
    throw error;
  }
}

export async function getMyReport(taskId: string) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data } = await supabase
    .from("task_reports")
    .select("id, status")
    .eq("task_id", taskId)
    .eq("reporter_id", uid)
    .maybeSingle();
  return data;
}

/* ---------------- users ---------------- */

export type AdminUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  createdAt: string;
  credits: number;
  bannedAt: string | null;
  banReason: string | null;
  taskCount: number;
  unlockCount: number;
  totalSpentCredits: number;
  totalPaidEur: number;
  refundCount: number;
  refundFlagged: boolean;
  isModerator: boolean;
  isAdmin: boolean;
};

export async function getAdminUsers(search: string): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc("admin_list_users", { _search: search, _limit: 100 });
  if (error) throw error;
  return ((data ?? []) as never[]).map((u: Record<string, unknown>) => ({
    id: String(u["id"]),
    email: (u["email"] as string | null) ?? null,
    fullName: (u["full_name"] as string | null) ?? null,
    createdAt: String(u["created_at"]),
    credits: Number(u["credits"] ?? 0),
    bannedAt: (u["banned_at"] as string | null) ?? null,
    banReason: (u["ban_reason"] as string | null) ?? null,
    taskCount: Number(u["task_count"] ?? 0),
    unlockCount: Number(u["unlock_count"] ?? 0),
    totalSpentCredits: Number(u["total_spent_credits"] ?? 0),
    totalPaidEur: Number(u["total_paid_eur"] ?? 0),
    refundCount: Number(u["refund_count"] ?? 0),
    refundFlagged: Boolean(u["refund_flagged"]),
    isModerator: Boolean(u["is_moderator"]),
    isAdmin: Boolean(u["is_admin"]),
  }));
}

async function callRpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw error;
  const r = data as Record<string, unknown>;
  if (!r?.["ok"]) throw new Error(String(r?.["error"] ?? "UNKNOWN"));
  return r;
}

export function adjustCredits(userId: string, amount: number, reason: string) {
  return callRpc("admin_adjust_credits", { _user_id: userId, _amount: amount, _reason: reason });
}

export function setBan(userId: string, banned: boolean, reason: string) {
  return callRpc("admin_set_ban", { _user_id: userId, _banned: banned, _reason: reason });
}

export function setModerator(userId: string, grant: boolean) {
  return callRpc("admin_set_role", { _user_id: userId, _role: "moderator", _grant: grant });
}

/* ---------------- payments ---------------- */

export type AdminPayment = {
  id: string;
  userId: string;
  userName: string;
  credits: number;
  amountEur: number;
  provider: string;
  status: string;
  externalReference: string | null;
  paymentIntentId: string | null;
  receiptUrl: string | null;
  createdAt: string;
};

export async function getAdminPayments(): Promise<AdminPayment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select(
      "id, user_id, credits, amount_eur, provider, status, stripe_session_id, stripe_payment_intent_id, receipt_url, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    (profiles ?? []).forEach((p) => names.set(p.id, p.full_name ?? "Потребител"));
  }
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    userName: names.get(r.user_id) ?? "Потребител",
    credits: r.credits,
    amountEur: Number(r.amount_eur),
    provider: r.provider,
    status: r.status,
    externalReference: r.stripe_session_id,
    paymentIntentId: r.stripe_payment_intent_id,
    receiptUrl: r.receipt_url,
    createdAt: r.created_at,
  }));
}

/* ---------------- audit ---------------- */

export type AuditEntry = {
  id: string;
  adminId: string | null;
  adminName: string;
  actionType: string;
  targetType: string;
  targetId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

export async function getAuditLog(filters: { admin: string; actionType: string }): Promise<AuditEntry[]> {
  let query = supabase
    .from("admin_actions")
    .select("id, admin_id, action_type, target_type, target_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  if (filters.admin !== "all") query = query.eq("admin_id", filters.admin);
  if (filters.actionType !== "all") query = query.eq("action_type", filters.actionType);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.admin_id).filter((v): v is string => Boolean(v)))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
    (profiles ?? []).forEach((p) => names.set(p.id, p.full_name ?? "Админ"));
  }
  return rows.map((r) => ({
    id: r.id,
    adminId: r.admin_id,
    adminName: r.admin_id ? (names.get(r.admin_id) ?? "Админ") : "Системата",
    actionType: r.action_type,
    targetType: r.target_type,
    targetId: r.target_id,
    details: (r.details ?? {}) as Record<string, unknown>,
    createdAt: r.created_at,
  }));
}

export const ACTION_TYPE_BG: Record<string, string> = {
  refund_approved: "Одобрено възстановяване",
  refund_rejected: "Отказано възстановяване",
  credits_adjusted: "Корекция на кредити",
  user_banned: "Блокиран потребител",
  user_unbanned: "Отблокиран потребител",
  role_granted: "Дадена роля",
  role_revoked: "Отнета роля",
  task_deleted: "Изтрита задача",
  task_deactivated: "Деактивирана задача",
  task_activated: "Активирана задача",
  task_category_changed: "Сменена категория",
  report_reviewed: "Прегледан доклад",
  report_dismissed: "Отхвърлен доклад",
};

export function formatDateBg(iso: string) {
  return new Date(iso).toLocaleString("bg-BG", { dateStyle: "short", timeStyle: "short" });
}
