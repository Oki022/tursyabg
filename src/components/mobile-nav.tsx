import { Link } from "@tanstack/react-router";
import { Home, Search, Plus, MessageCircle, CircleUserRound } from "lucide-react";
import { UnreadBadge } from "@/components/unread-badge";

const items = [
  { to: "/", label: "Начало", icon: Home, exact: true },
  { to: "/tasks", label: "Търси", icon: Search, exact: false },
  { to: "/messages", label: "Съобщения", icon: MessageCircle, exact: false },
  { to: "/profile", label: "Профил", icon: CircleUserRound, exact: false },
] as const;

const base =
  "group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium text-muted-foreground transition-all duration-150 active:scale-95 active:opacity-70";
const active =
  "group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 py-2 text-[11px] font-semibold text-primary transition-all duration-150 active:scale-95";

export function MobileNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 w-full max-w-full border-t border-border/60 bg-background/95 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Мобилна навигация"
    >
      <div className="flex w-full max-w-full items-end gap-1 px-2 py-1">
        {items.slice(0, 2).map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        <Link
          to="/post"
          aria-label="Възложи работа"
          className="relative -mt-4 flex min-w-0 flex-1 flex-col items-center justify-end gap-1 px-1 pb-2 text-[11px] font-medium text-muted-foreground transition-all duration-150 active:scale-95"
          activeProps={{ className: "relative -mt-4 flex min-w-0 flex-1 flex-col items-center justify-end gap-1 px-1 pb-2 text-[11px] font-semibold text-primary transition-all duration-150 active:scale-95" }}
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-md shadow-rose-500/20 ring-2 ring-background transition-transform duration-150 active:scale-95">
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="w-full truncate text-center">Възложи</span>
        </Link>

        {items.slice(2).map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </div>
    </nav>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  exact,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact: boolean;
}) {
  return (
    <Link
      to={to}
      className={base}
      activeOptions={exact ? { exact: true } : undefined}
      activeProps={{ className: active }}
    >
      {({ isActive }) => (
        <>
          <span
            className={`h-1 w-6 rounded-full transition-all duration-200 ${
              isActive ? "bg-gradient-to-r from-orange-500 to-rose-500 opacity-100" : "opacity-0"
            }`}
          />
          <span className="relative">
            <Icon className="h-5 w-5 shrink-0" />
            {to === "/messages" && <UnreadBadge className="absolute -right-2.5 -top-1.5" />}
          </span>
          <span className="w-full truncate text-center">{label}</span>
        </>
      )}
    </Link>
  );
}
