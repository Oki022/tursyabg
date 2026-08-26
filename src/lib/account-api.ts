import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelAccountDeletion,
  deactivateAccount,
  exportMyData,
  getAccountState,
  listDeletionRequests,
  reactivateAccount,
  requestAccountDeletion,
} from "@/services/account";

export function useAccountState(userId?: string) {
  return useQuery({
    queryKey: ["account-state", userId],
    queryFn: getAccountState,
    enabled: Boolean(userId),
  });
}

function useAccountMutation<T>(fn: () => Promise<T>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["account-state"] });
      void qc.invalidateQueries({ queryKey: ["my-tasks"] });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export const useDeactivateAccount = () => useAccountMutation(deactivateAccount);
export const useReactivateAccount = () => useAccountMutation(reactivateAccount);
export const useRequestAccountDeletion = () => useAccountMutation(requestAccountDeletion);
export const useCancelAccountDeletion = () => useAccountMutation(cancelAccountDeletion);

export function useExportMyData() {
  return useMutation({ mutationFn: exportMyData });
}

export function useDeletionRequests(status?: string) {
  return useQuery({
    queryKey: ["admin-deletion-requests", status ?? "all"],
    queryFn: () => listDeletionRequests(status),
  });
}

/** Свалящ JSON файл с данните на потребителя. */
export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
