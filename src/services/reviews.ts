import { supabase } from "@/integrations/supabase/client";

export type EngagementStatus = "claimed" | "confirmed" | "rejected" | "expired";
export type ReviewDirection = "client_to_pro" | "pro_to_client";

export type Engagement = {
  id: string;
  taskId: string;
  taskTitle: string;
  taskCategory: string;
  status: EngagementStatus;
  clientId: string;
  professionalId: string;
  clientName: string | null;
  professionalName: string | null;
  claimedAt: string;
  confirmedAt: string | null;
  reviewDeadline: string | null;
  myReviewId: string | null;
  otherSubmitted: boolean;
};

export type PublicProfile = {
  id: string;
  fullName: string | null;
  city: string | null;
  createdAt: string;
  completedJobs: number;
  ratingAsPro: number | null;
  reviewCountAsPro: number;
  ratingAsClient: number | null;
  reviewCountAsClient: number;
};

export type PublicReview = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  category: string;
  reviewerId: string;
  reviewerName: string | null;
};

export type TaskUnlocker = {
  userId: string;
  fullName: string | null;
  unlockedAt: string;
  ratingAsPro: number | null;
  reviewCountAsPro: number;
  hasEngagement: boolean;
};

export const REVIEWS_PAGE_SIZE = 10;

export const DOUBLE_BLIND_NOTE =
  "Отзивите са двустранни и остават скрити, докато и двете страни не напишат своя — или докато не изтекат 14 дни. Така никой не може да отговори „с око за око“.";

export const REVIEW_PLACEHOLDER: Record<ReviewDirection, string> = {
  client_to_pro:
    "Как беше свършена работата? Спази ли се уговореното време, качеството и цената?",
  pro_to_client:
    "Ясно ли беше описана задачата? Как беше комуникацията и плащането?",
};

export const REVIEW_HEADING: Record<ReviewDirection, string> = {
  client_to_pro: "Оцени изпълнителя",
  pro_to_client: "Оцени клиента",
};

function unwrap(data: unknown): Record<string, unknown> {
  return (data ?? {}) as Record<string, unknown>;
}

async function rpcOk(fn: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc(fn as any, args as any);
  if (error) throw error;
  const r = unwrap(data);
  if (!r["ok"]) throw new Error(String(r["error"] ?? "UNKNOWN"));
  return r;
}

export async function claimEngagement(taskId: string) {
  return rpcOk("claim_engagement", { _task_id: taskId });
}

export async function respondEngagement(engagementId: string, confirm: boolean) {
  return rpcOk("respond_engagement", { _engagement_id: engagementId, _confirm: confirm });
}

export async function assignEngagement(taskId: string, professionalId: string) {
  return rpcOk("assign_engagement", { _task_id: taskId, _professional_id: professionalId });
}

export async function submitReview(input: { engagementId: string; rating: number; comment: string }) {
  return rpcOk("submit_review", {
    _engagement_id: input.engagementId,
    _rating: input.rating,
    _comment: input.comment,
  });
}

export async function getMyEngagements(): Promise<Engagement[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc("my_engagements" as any);
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    taskId: r.task_id,
    taskTitle: r.task_title,
    taskCategory: r.task_category,
    status: r.status,
    clientId: r.client_id,
    professionalId: r.professional_id,
    clientName: r.client_name,
    professionalName: r.professional_name,
    claimedAt: r.claimed_at,
    confirmedAt: r.confirmed_at,
    reviewDeadline: r.review_deadline,
    myReviewId: r.my_review_id,
    otherSubmitted: Boolean(r.other_submitted),
  }));
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc("public_profile" as any, { _user_id: userId });
  if (error) throw error;
  const r = data as Record<string, unknown> | null;
  if (!r) return null;
  return {
    id: String(r["id"]),
    fullName: (r["full_name"] as string | null) ?? null,
    city: (r["city"] as string | null) ?? null,
    createdAt: String(r["created_at"]),
    completedJobs: Number(r["completed_jobs"] ?? 0),
    ratingAsPro: r["rating_as_pro"] == null ? null : Number(r["rating_as_pro"]),
    reviewCountAsPro: Number(r["review_count_as_pro"] ?? 0),
    ratingAsClient: r["rating_as_client"] == null ? null : Number(r["rating_as_client"]),
    reviewCountAsClient: Number(r["review_count_as_client"] ?? 0),
  };
}

export async function getPublicReviews(
  userId: string,
  direction: ReviewDirection,
  page: number,
): Promise<PublicReview[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc("public_reviews" as any, {
    _user_id: userId,
    _direction: direction,
    _limit: REVIEWS_PAGE_SIZE,
    _offset: page * REVIEWS_PAGE_SIZE,
  });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
    category: r.category,
    reviewerId: r.reviewer_id,
    reviewerName: r.reviewer_name,
  }));
}

export async function getTaskUnlockers(taskId: string): Promise<TaskUnlocker[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc("task_unlockers" as any, { _task_id: taskId });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    userId: r.user_id,
    fullName: r.full_name,
    unlockedAt: r.unlocked_at,
    ratingAsPro: r.rating_as_pro == null ? null : Number(r.rating_as_pro),
    reviewCountAsPro: Number(r.review_count_as_pro ?? 0),
    hasEngagement: Boolean(r.has_engagement),
  }));
}

export async function reportReview(input: { reviewId: string; reason: string; details: string }) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("NOT_AUTHENTICATED");
  const { error } = await supabase.from("review_reports").insert({
    review_id: input.reviewId,
    reporter_id: uid,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reason: input.reason as any,
    details: input.details,
  });
  if (error) throw error;
}

export function formatReviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString("bg-BG", { day: "numeric", month: "long", year: "numeric" });
}

export function daysLeft(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

export const REVIEW_ERROR_BG: Record<string, string> = {
  NOT_AUTHENTICATED: "Влез в профила си, за да продължиш.",
  NOT_UNLOCKED: "Трябва първо да отключиш контакта по задачата.",
  ALREADY_CLAIMED: "Вече си заявил тази задача.",
  OWN_TASK: "Това е твоята задача.",
  TASK_NOT_FOUND: "Задачата не е намерена.",
  FORBIDDEN: "Нямаш права за това действие.",
  ALREADY_RESOLVED: "Заявката вече е обработена.",
  NOT_CONFIRMED: "Работата още не е потвърдена от клиента.",
  WINDOW_CLOSED: "Срокът за отзив изтече.",
  DUPLICATE: "Вече си оставил отзив за тази работа.",
  COMMENT_TOO_SHORT: "Коментарът трябва да е поне 10 символа.",
  COMMENT_TOO_LONG: "Коментарът е твърде дълъг.",
  INVALID_RATING: "Избери оценка от 1 до 5 звезди.",
  SELF: "Не можеш да посочиш себе си.",
};

export function reviewErrorBg(e: unknown): string {
  const code = e instanceof Error ? e.message : "UNKNOWN";
  return REVIEW_ERROR_BG[code] ?? "Действието не беше изпълнено.";
}