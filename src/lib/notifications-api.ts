import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "@/services/notifications";

export const notificationKeys = {
  list: ["notifications", "list"] as const,
  unread: ["notifications", "unread"] as const,
};

export function useNotificationsRealtime(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    return subscribeToNotifications(() => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    });
  }, [enabled, qc]);
}

export function useNotifications(enabled: boolean, limit?: number) {
  useNotificationsRealtime(enabled);
  return useQuery({
    queryKey: [...notificationKeys.list, limit ?? 20],
    enabled,
    queryFn: () => getNotifications(limit),
  });
}

export function useUnreadNotifications(enabled: boolean) {
  useNotificationsRealtime(enabled);
  return useQuery({
    queryKey: notificationKeys.unread,
    enabled,
    queryFn: getUnreadNotificationCount,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
