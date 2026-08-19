import { useNavigate } from "@tanstack/react-router";
import {
  MessageSquare,
  Unlock,
  Clock,
  CalendarX,
  Sparkles,
  Coins,
  CheckCircle2,
  XCircle,
  Flag,
  BellOff,
  HelpCircle,
  RefreshCw,
  BadgeCheck,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTimeBg, type AppNotification, type NotificationType } from "@/services/notifications";
import { useMarkNotificationRead } from "@/lib/notifications-api";

const ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  new_message: MessageSquare,
  contact_unlocked: Unlock,
  task_expiring: Clock,
  task_expired: CalendarX,
  promo_expiring: Sparkles,
  credits_low: Coins,
  refund_approved: CheckCircle2,
  refund_rejected: XCircle,
  task_reported: Flag,
  task_still_open: HelpCircle,
  task_freshness: RefreshCw,
  refund_auto_approved: BadgeCheck,
};

export function NotificationList({
  items,
  isLoading,
  onNavigate,
  unreadIds,
}: {
  items: AppNotification[];
  isLoading: boolean;
  onNavigate?: () => void;
  /** When provided, controls which rows render as unread (session snapshot). */
  unreadIds?: Set<string>;
}) {
  const navigate = useNavigate();
  const markRead = useMarkNotificationRead();

  if (isLoading) {
    return (
      <div className="space-y-3 p-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground">
          <BellOff className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-foreground">Няма известия</p>
        <p className="text-xs text-muted-foreground">
          Тук ще виждаш новини за задачите, съобщенията и кредитите си.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {items.map((n) => {
        const Icon = ICONS[n.type] ?? MessageSquare;
        const unread = unreadIds ? unreadIds.has(n.id) : !n.readAt;
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => {
                if (unread) markRead.mutate(n.id);
                onNavigate?.();
                if (n.link) void navigate({ to: n.link as unknown as "/" });
              }}
              className={`flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-accent/60 ${
                unread ? "bg-primary/5" : ""
              }`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="break-words text-sm font-semibold text-foreground">{n.title}</span>
                  {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </span>
                {n.body && (
                  <span className="mt-0.5 block break-words text-xs text-muted-foreground">{n.body}</span>
                )}
                <span className="mt-1 block text-[11px] text-muted-foreground">{relativeTimeBg(n.createdAt)}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
