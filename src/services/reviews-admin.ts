import { supabase } from "@/integrations/supabase/client";
import type { ReviewDirection } from "@/services/reviews";

export type AdminReview = {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  isVisible: boolean;
  hiddenAt: string | null;
  hiddenReason: string | null;
  direction: ReviewDirection;
  reviewerId: string;
  reviewerName: string | null;
  revieweeId: string;
  revieweeName: string | null;
  taskId: string;
  taskTitle: string | null;
  reportCount: number;
};

export type ReviewFlags = {
  rejectedClaimUsers: { user_id: string; full_name: string | null; rejected: number }[];
  mutualReviewers: { user_a: string; user_b: string; pairs: number }[];
  newAccountFiveStars: { user_id: string; full_name: string | null; five_stars: number }[];
  engagementsWithoutReviews: number;
};

export async function getAdminReviews(filter: string): Promise<AdminReview[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc("admin_list_reviews" as any, {
    _filter: filter,
    _limit: 100,
  });
  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.created_at,
    isVisible: r.is_visible,
    hiddenAt: r.hidden_at,
    hiddenReason: r.hidden_reason,
    direction: r.direction,
    reviewerId: r.reviewer_id,
    reviewerName: r.reviewer_name,
    revieweeId: r.reviewee_id,
    revieweeName: r.reviewee_name,
    taskId: r.task_id,
    taskTitle: r.task_title,
    reportCount: Number(r.report_count ?? 0),
  }));
}

export async function hideReview(reviewId: string, reason: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc("admin_hide_review" as any, {
    _review_id: reviewId,
    _reason: reason,
  });
  if (error) throw error;
  const r = (data ?? {}) as Record<string, unknown>;
  if (!r["ok"]) throw new Error(String(r["error"] ?? "UNKNOWN"));
}

export async function getReviewFlags(): Promise<ReviewFlags> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc("admin_review_flags" as any);
  if (error) throw error;
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    rejectedClaimUsers: (r["rejected_claim_users"] ?? []) as ReviewFlags["rejectedClaimUsers"],
    mutualReviewers: (r["mutual_reviewers"] ?? []) as ReviewFlags["mutualReviewers"],
    newAccountFiveStars: (r["new_account_five_stars"] ?? []) as ReviewFlags["newAccountFiveStars"],
    engagementsWithoutReviews: Number(r["engagements_without_reviews"] ?? 0),
  };
}