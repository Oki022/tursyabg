import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth";
import { NotificationList } from "@/components/notifications/notification-list";
import {
  useMarkAllNotificationsRead,
  useNotifications,
  useUnreadNotifications,
} from "@/lib/notifications-api";

function BellButton({ unread }: { unread: number }) {
  return (
    <Button variant="ghost" size="icon" className="relative h-9! w-9! text-foreground [&_svg]:size-[22px]" aria-label="Известия">
      <Bell strokeWidth={1.6} />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Button>
  );
}

function PanelHeader({ withCloseSpace }: { withCloseSpace: boolean }) {
  return (
    <div
      className={`flex shrink-0 items-center border-b border-border ${
        withCloseSpace ? "min-h-16 px-5 py-4" : "min-h-11 px-3 py-2.5"
      }`}
    >
      <span
        className={
          withCloseSpace
            ? "pr-12 text-xl font-bold tracking-tight text-foreground"
            : "text-sm font-semibold"
        }
      >
        Известия
      </span>
    </div>
  );
}


function PanelFooter({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="shrink-0 border-t border-border p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <Link
        to="/notifications"
        onClick={onNavigate}
        className="block rounded-md px-3 py-2 text-center text-sm font-medium text-primary hover:bg-accent"
      >
        Виж всички
      </Link>
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const enabled = Boolean(user);
  const unreadQuery = useUnreadNotifications(enabled);
  const listQuery = useNotifications(enabled && open, 20);
  const markAll = useMarkAllNotificationsRead();
  const unread = unreadQuery.data ?? 0;
  const items = listQuery.data ?? [];

  // Snapshot which items were unread when the panel opened, so the styling
  // stays visible for the session while the badge clears immediately.
  const [sessionUnread, setSessionUnread] = useState<Set<string> | undefined>(undefined);
  const snapshotTaken = useRef(false);

  useEffect(() => {
    if (!open) {
      snapshotTaken.current = false;
      setSessionUnread(undefined);
      return;
    }
    if (snapshotTaken.current || listQuery.isLoading) return;
    snapshotTaken.current = true;
    setSessionUnread(new Set(items.filter((n) => !n.readAt).map((n) => n.id)));
    if (items.some((n) => !n.readAt)) markAll.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, listQuery.isLoading]);

  const body = (
    <>
      <PanelHeader withCloseSpace={isMobile} />
      <div
        className={
          isMobile
            ? "min-h-0 flex-1 overflow-y-auto overscroll-contain"
            : "max-h-[380px] flex-1 overflow-y-auto"
        }
      >
        <NotificationList
          items={items}
          isLoading={listQuery.isLoading}
          unreadIds={sessionUnread}
          onNavigate={() => setOpen(false)}
        />
      </div>
      <PanelFooter onNavigate={() => setOpen(false)} />
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <span>
            <BellButton unread={unread} />
          </span>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="flex h-[100dvh] w-full max-w-full flex-col gap-0 p-0 pt-[env(safe-area-inset-top)] sm:max-w-md"
        >
          <SheetTitle className="sr-only">Известия</SheetTitle>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <span>
          <BellButton unread={unread} />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(360px,calc(100vw-1.5rem))] p-0">
        {body}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
