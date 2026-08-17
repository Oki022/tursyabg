import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  canBumpTask,
  getPromotionsByOwner,
  getTaskPromotions,
  listPromoProducts,
} from "@/services/promotions";

export function usePromoProducts() {
  return useQuery({ queryKey: ["promotions", "products"], queryFn: listPromoProducts, staleTime: 5 * 60_000 });
}

export function useTaskPromotions(taskId?: string) {
  return useQuery({
    queryKey: ["promotions", "task", taskId],
    enabled: Boolean(taskId),
    queryFn: () => getTaskPromotions(taskId!),
  });
}

export function useOwnerPromotions(userId?: string) {
  return useQuery({
    queryKey: ["promotions", "owner", userId],
    enabled: Boolean(userId),
    queryFn: () => getPromotionsByOwner(userId!),
  });
}

export function useCanBump(taskId?: string) {
  return useQuery({
    queryKey: ["promotions", "can-bump", taskId],
    enabled: Boolean(taskId),
    queryFn: () => canBumpTask(taskId!),
  });
}

export function useInvalidatePromotions() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["promotions"] });
    void qc.invalidateQueries({ queryKey: ["tasks"] });
  };
}
