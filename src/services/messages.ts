import { supabase } from "@/integrations/supabase/client";
import { resolveImageUrls } from "@/services/storage";
import { CATEGORY_IMAGES } from "@/lib/mock-data";

export const MESSAGES_PAGE_SIZE = 30;
export const CONVERSATIONS_PAGE_SIZE = 20;

export type ChatMessage = {
  id: string;
  conversationId: string | null;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
};

export type ConversationSummary = {
  id: string;
  taskId: string;
  taskTitle: string;
  taskBudget: number;
  taskImage: string;
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
};

type ConversationRow = {
  id: string;
  task_id: string;
  participant_a: string;
  participant_b: string;
  last_message_at: string;
  tasks: {
    id: string;
    title: string;
    budget: number;
    category: string;
    task_images: { image_url: string; sort_order: number }[] | null;
  } | null;
};

const CONVERSATION_SELECT =
  "id, task_id, participant_a, participant_b, last_message_at, tasks(id, title, budget, category, task_images(image_url, sort_order))";

function mapMessage(row: {
  id: string;
  conversation_id: string | null;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    content: row.content,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Трябва да си влязъл в профила си.");
  return id;
}

/** Conversations for the signed-in user, newest activity first. */
export async function getConversations(
  cursor?: string,
): Promise<{ items: ConversationSummary[]; nextCursor?: string }> {
  const me = await currentUserId();

  let query = supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .or(`participant_a.eq.${me},participant_b.eq.${me}`)
    .order("last_message_at", { ascending: false })
    .limit(CONVERSATIONS_PAGE_SIZE);

  if (cursor) query = query.lt("last_message_at", cursor);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as ConversationRow[];
  if (rows.length === 0) return { items: [] };

  const ids = rows.map((r) => r.id);
  const otherIds = Array.from(
    new Set(rows.map((r) => (r.participant_a === me ? r.participant_b : r.participant_a))),
  );

  const [{ data: msgs }, { data: profiles }, imageMap] = await Promise.all([
    supabase
      .from("messages")
      .select("id, conversation_id, sender_id, receiver_id, content, created_at, read_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name").in("id", otherIds),
    resolveImageUrls(
      rows.flatMap((r) => (r.tasks?.task_images ?? []).map((i) => i.image_url)),
    ),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Потребител"]));
  const lastByConv = new Map<string, string>();
  const unreadByConv = new Map<string, number>();
  for (const m of msgs ?? []) {
    const cid = m.conversation_id;
    if (!cid) continue;
    if (!lastByConv.has(cid)) lastByConv.set(cid, m.content);
    if (m.receiver_id === me && !m.read_at) {
      unreadByConv.set(cid, (unreadByConv.get(cid) ?? 0) + 1);
    }
  }

  const items = rows.map((r) => {
    const otherId = r.participant_a === me ? r.participant_b : r.participant_a;
    const images = [...(r.tasks?.task_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const firstPath = images[0]?.image_url;
    const category = r.tasks?.category ?? "drugi";
    return {
      id: r.id,
      taskId: r.task_id,
      taskTitle: r.tasks?.title ?? "Задача",
      taskBudget: Number(r.tasks?.budget ?? 0),
      taskImage:
        (firstPath ? imageMap[firstPath] : undefined) ??
        CATEGORY_IMAGES[category] ??
        CATEGORY_IMAGES.drugi,
      otherUserId: otherId,
      otherUserName: nameById.get(otherId) ?? "Потребител",
      lastMessage: lastByConv.get(r.id) ?? "Няма съобщения още",
      lastMessageAt: r.last_message_at,
      unread: unreadByConv.get(r.id) ?? 0,
    } satisfies ConversationSummary;
  });

  return {
    items,
    nextCursor:
      rows.length === CONVERSATIONS_PAGE_SIZE ? rows[rows.length - 1].last_message_at : undefined,
  };
}

export async function getConversation(conversationId: string): Promise<ConversationSummary | null> {
  const me = await currentUserId();
  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as ConversationRow;
  const otherId = row.participant_a === me ? row.participant_b : row.participant_a;

  const images = [...(row.tasks?.task_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const [{ data: profile }, imageMap] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", otherId).maybeSingle(),
    resolveImageUrls(images.map((i) => i.image_url)),
  ]);
  const firstPath = images[0]?.image_url;
  const category = row.tasks?.category ?? "drugi";

  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.tasks?.title ?? "Задача",
    taskBudget: Number(row.tasks?.budget ?? 0),
    taskImage:
      (firstPath ? imageMap[firstPath] : undefined) ??
      CATEGORY_IMAGES[category] ??
      CATEGORY_IMAGES.drugi,
    otherUserId: otherId,
    otherUserName: profile?.full_name ?? "Потребител",
    lastMessage: "",
    lastMessageAt: row.last_message_at,
    unread: 0,
  };
}

/** Cursor-paginated messages, oldest -> newest in the returned array. */
export async function getMessages(
  conversationId: string,
  cursor?: string,
): Promise<{ items: ChatMessage[]; nextCursor?: string }> {
  let query = supabase
    .from("messages")
    .select("id, conversation_id, sender_id, receiver_id, content, created_at, read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(MESSAGES_PAGE_SIZE);

  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  return {
    items: rows.map(mapMessage).reverse(),
    nextCursor: rows.length === MESSAGES_PAGE_SIZE ? rows[rows.length - 1].created_at : undefined,
  };
}

/** Finds an existing conversation for this task + pair, or creates one atomically. */
export async function findOrCreateConversation(
  taskId: string,
  otherUserId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("find_or_create_conversation", {
    _task_id: taskId,
    _other_user: otherUserId,
  });
  if (error) throw error;
  return data as string;
}

export async function sendMessage(input: {
  conversationId: string;
  receiverId: string;
  taskId: string;
  content: string;
}): Promise<ChatMessage> {
  const me = await currentUserId();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      task_id: input.taskId,
      sender_id: me,
      receiver_id: input.receiverId,
      content: input.content.trim(),
    })
    .select("id, conversation_id, sender_id, receiver_id, content, created_at, read_at")
    .single();
  if (error) throw error;
  return mapMessage(data);
}

export async function markAsRead(conversationId: string): Promise<void> {
  const me = await currentUserId();
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("receiver_id", me)
    .is("read_at", null);
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await supabase.auth.getUser();
  const me = data.user?.id;
  if (!me) return 0;
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", me)
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}

/** Subscribes to all message changes visible to the user. Returns an unsubscribe fn. */
export function subscribeToMessages(onChange: () => void): () => void {
  const channel = supabase
    .channel(`messages-live-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => onChange())
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
