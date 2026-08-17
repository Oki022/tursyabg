import { useState } from "react";
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
    <Button variant="ghost" size="icon" className="relative text-slate-700" aria-label="Известия">
      <Bell className="h-5 w-5" strokeWidth={2.25} />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Button>
  );
}

function PanelHeader({ onMarkAll, canMarkAll }: { onMarkAll: () => void; canMarkAll: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
      <span className="text-sm font-semibold">Известия</span>
      {canMarkAll && (
        <button onClick={onMarkAll} className="text-xs text-muted-foreground hover:text-foreground">
          Маркирай всички като прочетени
        </button>
      )}
    </div>
  );
}

function PanelFooter({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="border-t border-border p-2">
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

  const body = (
    <>
      <PanelHeader onMarkAll={() => markAll.mutate()} canMarkAll={unread > 0} />
      <div className="max-h-[60vh] flex-1 overflow-y-auto md:max-h-[380px]">
        <NotificationList items={items} isLoading={listQuery.isLoading} onNavigate={() => setOpen(false)} />
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
        <SheetContent side="right" className="flex w-full max-w-full flex-col gap-0 p-0 sm:max-w-md">
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
