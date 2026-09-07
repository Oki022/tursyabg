import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Send, ShieldAlert, Loader2, Flag } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { useConversation, useMarkAsRead, useSendMessage, useThread } from "@/lib/messages-api";
import type { ChatMessage } from "@/services/messages";
import { CONTACT_MASK_WARNING, containsContactInfo, isValidBgPhone } from "@/lib/phone";
import { toastError } from "@/lib/toast-error";

import { RequirePhoneNotice } from "@/components/require-phone-notice";
import { TaskThumb } from "@/components/task-thumb";
import { ReportContentDialog } from "@/components/moderation/report-content-dialog";
import { toast } from "sonner";

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Днес";
  if (same(d, yesterday)) return "Вчера";
  return d.toLocaleDateString("bg-BG", { day: "numeric", month: "long", year: "numeric" });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });
}

export function ChatThread({ conversationId }: { conversationId: string }) {
  const { user } = useAuth();
  const { data: conversation } = useConversation(conversationId);
  const thread = useThread(conversationId);
  const send = useSendMessage();
  const markRead = useMarkAsRead();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const markMutate = markRead.mutate;

  const messages: ChatMessage[] = useMemo(
    () =>
      (thread.data?.pages ?? [])
        .flatMap((p) => p.items)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [thread.data],
  );

  useEffect(() => {
    if (conversationId) markMutate(conversationId);
  }, [conversationId, markMutate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversationId]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !conversation) return;
    if (!user?.phone || !isValidBgPhone(user.phone)) {
      toast.error("Добави телефон в профила си, за да пишеш съобщения.");
      return;
    }
    setText("");
    try {
      await send.mutateAsync({
        conversationId,
        receiverId: conversation.otherUserId,
        taskId: conversation.taskId,
        content,
      });
      if (containsContactInfo(content)) {
        toast.warning("Контактите са скрити автоматично", { description: CONTACT_MASK_WARNING });
      }
    } catch (err) {
      setText(content);
      toastError(err, { title: "Съобщението не беше изпратено" });
    }
  };


  if (thread.isLoading) {
    return (
      <div className="flex-1 space-y-3 p-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-12 animate-pulse rounded-2xl bg-muted ${i % 2 ? "ml-auto w-1/2" : "w-2/3"}`}
          />
        ))}
      </div>
    );
  }

  if (thread.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">Съобщенията не можаха да се заредят.</p>
        <Button variant="outline" size="sm" onClick={() => thread.refetch()}>
          Опитай отново
        </Button>
      </div>
    );
  }

  let lastDay = "";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {conversation && (
        <div className="flex shrink-0 items-center gap-3 border-b border-border/60 bg-background px-4 py-3 md:bg-card">
          <Link
            to="/task/$id"
            params={{ id: conversation.taskId }}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl transition-colors hover:bg-accent/40"
          >
            <TaskThumb
              src={conversation.taskImage}
              category={conversation.taskCategory}
              title={conversation.taskTitle}
              deleted={conversation.taskDeleted}
              iconClassName="h-5 w-5"
              className="h-11 w-11 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{conversation.taskTitle}</p>
              <p className="text-xs text-muted-foreground">{conversation.taskBudget} €</p>
            </div>
          </Link>
          <Link
            to="/user/$id"
            params={{ id: conversation.otherUserId }}
            aria-label={`Виж профила на ${conversation.otherUserName}`}
            className="flex shrink-0 items-center gap-2 rounded-xl px-1 py-1 transition-colors hover:bg-accent/40"
          >
            <UserAvatar userId={conversation.otherUserId} name={conversation.otherUserName} className="h-8 w-8" textClassName="text-[11px]" />
            <span className="hidden max-w-[9rem] truncate text-xs font-medium text-foreground sm:inline">
              {conversation.otherUserName}
            </span>
          </Link>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-ms-overflow-style:none] [scrollbar-width:none] md:[scrollbar-width:thin] [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:block">
        {thread.hasNextPage && (
          <div className="mb-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => thread.fetchNextPage()}
              disabled={thread.isFetchingNextPage}
            >
              {thread.isFetchingNextPage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Покажи по-стари съобщения"
              )}
            </Button>
          </div>
        )}

        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>За твоята сигурност общувай и плащай само през платформата.</span>
        </div>

        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Няма съобщения още. Напиши първото!
          </p>
        )}

        <div className="space-y-2">
          {messages.map((m) => {
            const mine = m.senderId === user?.id;
            const day = dayLabel(m.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <div key={m.id}>
                {showDay && (
                  <div className="my-4 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {day}
                  </div>
                )}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className="group min-w-0 max-w-[80%]">
                    <div
                      className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm ${
                        mine
                          ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white"
                          : "bg-slate-100 text-slate-900"
                      }`}
                    >
                      {m.content}
                    </div>
                    <div
                      className={`mt-1 flex items-center gap-1 text-[11px] text-muted-foreground ${
                        mine ? "justify-end" : "justify-start"
                      }`}
                    >
                      {timeLabel(m.createdAt)}
                      {!mine && (
                        <ReportContentDialog
                          contentType="message"
                          contentId={m.id}
                          trigger={
                            <button
                              type="button"
                              aria-label="Докладвай съобщението"
                              className="rounded p-0.5 text-muted-foreground/70 transition hover:text-foreground"
                            >
                              <Flag className="h-3 w-3" />
                            </button>
                          }
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend();
        }}
        className="sticky bottom-0 z-10 flex shrink-0 items-center gap-2 border-t border-border/60 bg-background/95 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:pb-3"
      >
        {user && (!user.phone || !isValidBgPhone(user.phone)) ? (
          <RequirePhoneNotice
            className="w-full"
            title="Добави телефон, за да пишеш съобщения"
            description="Телефонът остава скрит, служи само за потвърждаване на профила ти."
          />
        ) : (
          <>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Напиши съобщение..."
          className="h-11 min-w-0 flex-1 rounded-full"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!text.trim() || send.isPending}
          className="h-11 w-11 shrink-0 rounded-full"
          aria-label="Изпрати"
        >
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
          </>
        )}
      </form>
    </div>
  );
}
