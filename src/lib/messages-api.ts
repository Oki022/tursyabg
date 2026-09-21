import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import {
  getConversation,
  getConversations,
  getMessages,
  getUnreadCount,
  markAsRead,
  sendMessage,
  subscribeToMessages,
  findOrCreateConversation,
  hideConversation,
} from "@/services/messages";

export const messageKeys = {
  conversations: ["messages", "conversations"] as const,
  conversation: (id: string) => ["messages", "conversation", id] as const,
  thread: (id: string) => ["messages", "thread", id] as const,
  unread: ["messages", "unread"] as const,
};

/** Single realtime subscription helper, invalidates the relevant caches. */
export function useMessagesRealtime(enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    return subscribeToMessages(() => {
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    });
  }, [enabled, queryClient]);
}

export function useConversations(enabled = true) {
  useMessagesRealtime(enabled);
  return useInfiniteQuery({
    queryKey: messageKeys.conversations,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getConversations(pageParam),
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useConversation(id?: string) {
  return useQuery({
    queryKey: messageKeys.conversation(id ?? ""),
    enabled: Boolean(id),
    queryFn: () => getConversation(id!),
  });
}

export function useThread(conversationId?: string) {
  return useInfiniteQuery({
    queryKey: messageKeys.thread(conversationId ?? ""),
    enabled: Boolean(conversationId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => getMessages(conversationId!, pageParam),
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sendMessage,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export function useUnreadCount(enabled: boolean) {
  useMessagesRealtime(enabled);
  return useQuery({
    queryKey: messageKeys.unread,
    enabled,
    queryFn: getUnreadCount,
  });
}
export function useHideConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: hideConversation,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export { findOrCreateConversation };
