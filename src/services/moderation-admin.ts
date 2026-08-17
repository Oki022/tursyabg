import { supabase } from "@/integrations/supabase/client";
import { resolveImageUrls } from "@/services/storage";

export type ModerationKind = "image" | "text" | "report";
export type ModerationStatus = "pending" | "approved" | "rejected";

export type ModerationItem = {
  id: string;
  kind: ModerationKind;
  contentType: string;
  contentId: string | null;
  taskId: string | null;
  taskTitle: string | null;
  userId: string | null;
  userName: string | null;
  reporterName: string | null;
  severity: "high" | "medium" | "low";
  status: ModerationStatus;
  reason: string;
  category: string;
  matchedPattern: string | null;
  excerpt: string;
  details: Record<string, unknown>;
  createdAt: string;
  imageUrl: string | null;
  score: number | null;
  labels: Record<string, number>;
  accountAgeDays: number;
  trustLevel: number;
  priorViolations: number;
};

type Row = {
  id: string;
  kind: ModerationKind;
  content_type: string;
  content_id: string | null;
  task_id: string | null;
  task_title: string | null;
  user_id: string | null;
  user_name: string | null;
  reporter_id: string | null;
  reporter_name: string | null;
  severity: "high" | "medium" | "low";
  status: ModerationStatus;
  reason: string;
  category: string;
  matched_pattern: string | null;
  excerpt: string;
  details: Record<string, unknown>;
  created_at: string;
  image_path: string | null;
  moderation_score: number | null;
  moderation_labels: Record<string, number> | null;
  account_age_days: number;
  trust_level: number;
  prior_violations: number;
};

export async function getModerationQueue(status: ModerationStatus | "all" = "pending"): Promise<ModerationItem[]> {
  const { data, error } = await supabase.rpc("admin_moderation_queue", { _status: status, _limit: 200 });
  if (error) throw error;
  const rows = (data ?? []) as unknown as Row[];
  const signed = await resolveImageUrls(rows.map((r) => r.image_path).filter(Boolean) as string[]);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    contentType: r.content_type,
    contentId: r.content_id,
    taskId: r.task_id,
    taskTitle: r.task_title,
    userId: r.user_id,
    userName: r.user_name,
    reporterName: r.reporter_name,
    severity: r.severity,
    status: r.status,
    reason: r.reason,
    category: r.category,
    matchedPattern: r.matched_pattern,
    excerpt: r.excerpt ?? "",
    details: r.details ?? {},
    createdAt: r.created_at,
    imageUrl: r.image_path ? (signed[r.image_path] ?? null) : null,
    score: r.moderation_score,
    labels: r.moderation_labels ?? {},
    accountAgeDays: r.account_age_days ?? 0,
    trustLevel: r.trust_level ?? 0,
    priorViolations: Number(r.prior_violations ?? 0),
  }));
}

export async function resolveModerationItem(input: { id: string; approve: boolean; reason?: string }) {
  const { data, error } = await supabase.rpc("admin_resolve_moderation", {
    _item_id: input.id,
    _approve: input.approve,
    _reason: input.reason ?? "",
  });
  if (error) throw error;
  const r = (data ?? {}) as Record<string, unknown>;
  if (!r["ok"]) throw new Error(String(r["error"] ?? "UNKNOWN"));
}

/** Reporting for any content type (tasks, reviews, profiles, single messages). */
export async function reportContent(input: {
  contentType: "profile" | "message" | "task" | "review";
  contentId: string;
  reason: string;
  details?: string;
}) {
  const { data, error } = await supabase.rpc("report_content", {
    _content_type: input.contentType,
    _content_id: input.contentId,
    _reason: input.reason,
    _details: input.details ?? "",
  });
  if (error) throw error;
  const r = (data ?? {}) as Record<string, unknown>;
  if (!r["ok"]) throw new Error(String(r["error"] ?? "UNKNOWN"));
}
