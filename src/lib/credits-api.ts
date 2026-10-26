import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCreditBalance,
  getCreditPackages,
  getMyCreditExpiry,
  getMyUnlock,
  getMyUnlockedTasks,
  getTransactions,
  hasSpentCredits,
  unlockTaskContact,
} from "@/services/credits";
import { captureIssue } from "@/lib/monitoring/client";

/** Bonus points about to expire and the expiry rules. */
export function useMyCreditExpiry(userId?: string) {
  return useQuery({
    queryKey: ["credits", "expiry", userId],
    enabled: Boolean(userId),
    queryFn: getMyCreditExpiry,
    staleTime: 60 * 1000,
  });
}

export function useCreditPackages() {
  return useQuery({ queryKey: ["credits", "packages"], queryFn: getCreditPackages, staleTime: 5 * 60 * 1000 });
}

export function useCreditBalance(userId?: string) {
  return useQuery({
    queryKey: ["credits", "balance", userId],
    enabled: Boolean(userId),
    queryFn: () => getCreditBalance(userId!),
  });
}

/** Дали потребителят вече е похарчил кредити (за показване на съответния текст). */
export function useHasSpentCredits(userId?: string) {
  return useQuery({
    queryKey: ["credits", "hasSpent", userId],
    enabled: Boolean(userId),
    queryFn: () => hasSpentCredits(userId!),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreditTransactions(page: number) {
  return useQuery({
    queryKey: ["credits", "transactions", page],
    queryFn: () => getTransactions(page),
    placeholderData: (prev) => prev,
  });
}

export function useMyUnlock(taskId: string, userId?: string) {
  return useQuery({
    queryKey: ["credits", "unlock", taskId, userId],
    enabled: Boolean(userId && taskId),
    queryFn: () => getMyUnlock(taskId, userId!),
  });
}

export function useUnlockedTasks(enabled = true) {
  return useQuery({ queryKey: ["credits", "unlocked"], enabled, queryFn: getMyUnlockedTasks });
}

export function useUnlockTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => unlockTaskContact(taskId),
    onError: (error, taskId) => {
      // Credits may have been debited without the contact being revealed.
      captureIssue({ area: "credits.spend", action: "unlock task contact", error, extra: { task_id: taskId } });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["credits"] });
    },
  });
}
