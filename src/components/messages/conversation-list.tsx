import { Link } from "@tanstack/react-router";
import { Inbox, Loader2 } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/auth";
import { TaskThumb } from "@/components/task-thumb";
import { useConversations } from "@/lib/messages-api";
import type { ConversationSummary } from "@/services/messages";

export function relativeTimeBg(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "сега";
  if (min < 60) return `преди ${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `преди ${h} ч`;
  const d = Math.floor(h / 24);
  if (d === 1) return "вчера";
  if (d < 30) return `преди ${d} дни`;
  return new Date(iso).toLocaleDateString("bg-BG", { day: "numeric", month: "short" });
}

type Props = {
  selectedId?: string;
  onSelect?: (conversation: ConversationSummary) => void;
  variant?: "desktop" | "mobile";
};

export function ConversationList({ selectedId, onSelect, variant = "desktop" }: Props) {
  const query = useConversations(true);
  const items = (query.data?.pages ?? []).flatMap((p) => p.items);

  if (query.isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">Разговорите не можаха да се заредят.</p>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          Опитай отново
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <Inbox className="h-7 w-7 text-slate-400" />
        </div>
        <h2 className="text-base font-semibold text-foreground">Още нямаш съобщения</h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          Свържи се с автор на задача и разговорът ще се появи тук.
        </p>
        <Button asChild className="mt-1">
          <Link to="/tasks">Разгледай задачите</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={variant === "mobile" ? "min-w-0 divide-y divide-border/60" : "min-w-0 space-y-1 p-2"}>

      {items.map((c) => {
        const content = (
          <>
            <span className="relative shrink-0">
              <UserAvatar userId={c.otherUserId} name={c.otherUserName} src={c.otherUserAvatar} className="h-12 w-12" textClassName="text-sm" />
              <TaskThumb
                src={c.taskImage}
                category={c.taskCategory}
                title={c.taskTitle}
                deleted={c.taskDeleted}
                iconClassName="h-3 w-3"
                className="absolute -bottom-1 -right-1 h-5 w-5 rounded-md border border-background shadow-sm"
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{c.otherUserName}</p>
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                  {relativeTimeBg(c.lastMessageAt)}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">{c.taskTitle}</p>
              <p className="truncate text-xs text-slate-500">{c.lastMessage}</p>
            </div>
            {c.unread > 0 && (
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-r from-orange-500 to-rose-500" />
            )}
          </>
        );

        const className =
          variant === "mobile"
            ? "flex w-full min-w-0 items-center gap-3 px-4 py-4 text-left transition-colors active:bg-slate-100"
            : `flex w-full min-w-0 items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                selectedId === c.id ? "bg-slate-100" : "hover:bg-slate-50"
              }`;


        return variant === "mobile" ? (
          <Link key={c.id} to="/messages/$conversationId" params={{ conversationId: c.id }} className={className}>
            {content}
          </Link>
        ) : (
          <button key={c.id} type="button" onClick={() => onSelect?.(c)} className={className}>
            {content}
          </button>
        );
      })}

      {query.hasNextPage && (
        <div className="flex justify-center py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : "Зареди още"}
          </Button>
        </div>
      )}
    </div>
  );
}
