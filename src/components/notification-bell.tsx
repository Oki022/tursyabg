import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell, Hammer, Sparkles, MessageSquare, Clock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type Notification = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  time: string;
  delayed?: boolean;
  unread?: boolean;
};

const NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    icon: Hammer,
    title: "Нова задача във вашия район",
    description: "Ремонт на баня — София, Лозенец (Изпратено с 5 мин. закъснение)",
    time: "преди 2 мин",
    delayed: true,
    unread: true,
  },
  {
    id: "n2",
    icon: MessageSquare,
    title: "Ново съобщение от Иван Петров",
    description: "Кога бихте могли да започнете?",
    time: "преди 18 мин",
    unread: true,
  },
  {
    id: "n3",
    icon: Sparkles,
    title: "Вашата задача е публикувана",
    description: "Почистване на апартамент — видима за изпълнители.",
    time: "преди 1 ч",
  },
];

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const unread = NOTIFICATIONS.filter((n) => n.unread).length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Известия">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-sm font-semibold">Известия</span>
          <button className="text-xs text-muted-foreground hover:text-foreground">
            Маркирай всички като прочетени
          </button>
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {NOTIFICATIONS.map((n) => {
            const Icon = n.icon;
            return (
              <div
                key={n.id}
                className={`flex items-start gap-3 border-b border-border/60 px-3 py-3 last:border-b-0 ${
                  n.unread ? "bg-primary/5" : ""
                }`}
              >
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    {n.unread && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.description}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{n.time}</span>
                    {n.delayed && (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                        5 мин. закъснение
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          Новите задачи се изпращат на изпълнителите с 5 минути закъснение, за да дадем приоритет на възложителите.
        </div>
        <div className="border-t border-border p-2">
          <Link
            to="/messages"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-center text-sm font-medium text-primary hover:bg-accent"
          >
            Отвори съобщенията
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}