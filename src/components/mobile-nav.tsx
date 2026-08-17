import { Link } from "@tanstack/react-router";
import { Home, Search, PlusCircle, MessageCircle, CircleUserRound } from "lucide-react";

const items = [
  { to: "/", label: "Начало", icon: Home, exact: true },
  { to: "/tasks", label: "Задачи", icon: Search, exact: false },
  { to: "/post", label: "Възложи", icon: PlusCircle, exact: false },
  { to: "/messages", label: "Съобщения", icon: MessageCircle, exact: false },
  { to: "/profile", label: "Профил", icon: CircleUserRound, exact: false },
] as const;

const base =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium text-muted-foreground transition-colors";
const active =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px] font-semibold text-primary";

export function MobileNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-full border-t border-border/60 bg-background/95 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Мобилна навигация"
    >
      <div className="flex w-full max-w-full items-stretch gap-1 px-2 py-1">
        {items.map(({ to, label, icon: Icon, exact }) => (
          <Link
            key={to}
            to={to}
            className={base}
            activeOptions={exact ? { exact: true } : undefined}
            activeProps={{ className: active }}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="w-full truncate text-center">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
