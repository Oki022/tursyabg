import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  assignEngagement,
  claimEngagement,
  getMyEngagements,
  getPublicProfile,
  getPublicReviews,
  getTaskUnlockers,
  respondEngagement,
  submitReview,
  type ReviewDirection,
} from "@/services/reviews";

export function useMyEngagements(enabled = true) {
  return useQuery({
    queryKey: ["engagements", "mine"],
    enabled,
    queryFn: getMyEngagements,
  });
}

export function usePublicProfile(userId?: string) {
  return useQuery({
    queryKey: ["public-profile", userId],
    enabled: Boolean(userId),
    queryFn: () => getPublicProfile(userId!),
  });
}

export function usePublicReviews(userId: string | undefined, direction: ReviewDirection, page: number) {
  return useQuery({
    queryKey: ["public-reviews", userId, direction, page],
    enabled: Boolean(userId),
    queryFn: () => getPublicReviews(userId!, direction, page),
  });
}

export function useTaskUnlockers(taskId?: string, enabled = true) {
  return useQuery({
    queryKey: ["task-unlockers", taskId],
    enabled: Boolean(taskId) && enabled,
    queryFn: () => getTaskUnlockers(taskId!),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["engagements"] });
    void qc.invalidateQueries({ queryKey: ["task-unlockers"] });
    void qc.invalidateQueries({ queryKey: ["public-profile"] });
    void qc.invalidateQueries({ queryKey: ["public-reviews"] });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    void qc.invalidateQueries({ queryKey: ["task"] });
    void qc.invalidateQueries({ queryKey: ["feed"] });
  };
}

export function useClaimEngagement() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: claimEngagement, onSuccess: invalidate });
}

export function useRespondEngagement() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { engagementId: string; confirm: boolean }) =>
      respondEngagement(v.engagementId, v.confirm),
    onSuccess: invalidate,
  });
}

export function useAssignEngagement() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { taskId: string; professionalId: string }) =>
      assignEngagement(v.taskId, v.professionalId),
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useSubmitReview() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: submitReview, onSuccess: invalidate });
}