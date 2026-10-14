import { Link, useNavigate } from "@tanstack/react-router";
import { BellRing,
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
  Coins as CoinsIcon,
  ShieldCheck,
  Trash2,
  Tags,
  MessageSquareOff,
  ShieldAlert,
  ShieldX,
  Bell,
  UserX,
  Mail,
  CalendarClock,
  Handshake,
  Star,
  Heart,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTimeBg, type AppNotification, type NotificationType } from "@/services/notifications";
import { useMarkNotificationRead } from "@/lib/notifications-api";

const FALLBACK_ICON = Bell;

const ICONS: Partial<Record<NotificationType, React.ComponentType<{ className?: string }>>> = {
  new_message: MessageSquare,
  contact_unlocked: Unlock,
  task_favourited: Heart,
  task_expiring: Clock,
  task_expired: CalendarX,
  promo_expiring: Sparkles,
  credits_low: Coins,
  refund_approved: CheckCircle2,
  refund_rejected: XCircle,
  task_reported: Flag,
  task_still_open: HelpCircle,
  task_freshness: RefreshCw,
  task_alert: BellRing,
  refund_auto_approved: BadgeCheck,
  credits_adjusted: CoinsIcon,
  account_restored: ShieldCheck,
  task_removed: Trash2,
  task_category_changed: Tags,
  review_removed: MessageSquareOff,
  content_rejected: ShieldX,
  content_held: ShieldAlert,
  content_approved: CheckCircle2,
  moderation_warning: ShieldAlert,
  account_suspended: ShieldAlert,
  account_banned: UserX,
  contact_message: Mail,
  account_deletion_scheduled: CalendarClock,
  account_deletion_cancelled: RefreshCw,
  engagement_claimed: Handshake,
  engagement_confirmed: Handshake,
  engagement_rejected: XCircle,
  engagement_reminder: Clock,
  review_requested: Star,
  review_reminder: Star,
  review_published: Star,
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
          Тук ще виждаш новини за задачите, съобщенията и точките си.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {items.map((n) => {
        const Icon = ICONS[n.type] ?? FALLBACK_ICON;
        const unread = unreadIds ? unreadIds.has(n.id) : !n.readAt;
        if (n.type === "contact_unlocked" && n.actorId) {
          const markIfUnread = () => {
            if (unread) markRead.mutate(n.id);
            onNavigate?.();
          };
          return (
            <li key={n.id} className={`flex items-start gap-3 px-3 py-3 ${unread ? "bg-primary/5" : ""}`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="break-words text-sm font-semibold text-foreground">{n.title}</span>
                  {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </span>
                <span className="mt-0.5 block break-words text-xs text-muted-foreground">
                  <Link
                    to="/user/$id"
                    params={{ id: n.actorId }}
                    onClick={markIfUnread}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {n.actorName ?? "Потребител"}
                  </Link>{" "}
                  отключи контакта по задачата ти.
                </span>
                <span className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                  {n.taskId && (
                    <Link
                      to="/task/$id"
                      params={{ id: n.taskId }}
                      onClick={markIfUnread}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      Виж задачата
                    </Link>
                  )}
                  {relativeTimeBg(n.createdAt)}
                </span>
              </span>
            </li>
          );
        }
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => {
                if (unread) markRead.mutate(n.id);
                onNavigate?.();
                if (n.link) {
                  const [path, qs] = n.link.split("?");
                  void navigate({
                    to: path as unknown as "/",
                    ...(qs ? { search: Object.fromEntries(new URLSearchParams(qs)) as never } : {}),
                  });
                }
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
