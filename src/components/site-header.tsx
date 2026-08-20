import { Link } from "@tanstack/react-router";
import { UnreadBadge } from "@/components/unread-badge";
import { Plus, CircleUserRound, LogOut, BadgeCheck, MessageCircle, Settings, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";
import { FavouritesNavLink } from "@/components/favourites-nav-link";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { cn } from "@/lib/utils";
import { useCreditBalance } from "@/lib/credits-api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function SiteHeader() {
  const { user, logout } = useAuth();
  const balance = useCreditBalance(user?.id);
  const credits = balance.data ?? user?.credits ?? 0;
  const hidden = useHideOnScroll(10);
  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full max-w-full border-b border-border/60 bg-background/80 backdrop-blur transition-transform duration-300 ease-out supports-[backdrop-filter]:bg-background/60 motion-reduce:transition-none",
        hidden && "md:-translate-y-full motion-reduce:translate-y-0",
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-2 px-4">
        <Logo size="md" />
        <nav className="hidden items-center gap-1 md:flex">
          <Link to="/" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeOptions={{ exact: true }} activeProps={{ className: "rounded-md px-3 py-2 text-sm font-medium text-foreground" }}>
            Начало
          </Link>
          <Link to="/tasks" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "rounded-md px-3 py-2 text-sm font-medium text-foreground" }}>
            Намери задачи
          </Link>
          <Link to="/post" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "rounded-md px-3 py-2 text-sm font-medium text-foreground" }}>
            Възложи задача
          </Link>
          <Link to="/messages" className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-foreground" }}>
            Съобщения
            <UnreadBadge />
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {user && <FavouritesNavLink />}
          {user && <NotificationBell />}
          {!user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth" search={{ mode: "login" }}>Вход</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth" search={{ mode: "register" }}>Регистрация</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="sm" variant="outline" className="hidden gap-1.5 sm:inline-flex">
                <Link to="/post">
                  <Plus className="h-4 w-4" />
                  <span>Възложи</span>
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="ml-0.5 hidden rounded-full p-0.5 text-foreground ring-offset-background transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:block"
                    aria-label="Меню на профила"
                  >
                    <CircleUserRound className="h-7 w-7" strokeWidth={1.75} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <span className="truncate">{user.name}</span>
                    {user.verified && (
                      <BadgeCheck className="h-4 w-4 fill-[#1da1f2] text-white" />
                    )}
                  </DropdownMenuLabel>
                  <div className="mx-1 mb-1 flex items-center justify-between gap-2 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 px-2.5 py-2">
                    <span className="min-w-0 truncate text-sm font-bold text-primary">
                      Кредити: {credits}
                    </span>
                    <Link
                      to="/settings/billing"
                      className="shrink-0 rounded-full bg-gradient-to-r from-primary to-accent px-2.5 py-1 text-[11px] font-semibold text-primary-foreground"
                    >
                      Купи кредити
                    </Link>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      <CircleUserRound className="mr-2 h-4 w-4" />
                      Моят профил
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/messages" className="cursor-pointer">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Съобщения
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/favourites" className="cursor-pointer">
                      <Heart className="mr-2 h-4 w-4" />
                      Любими задачи
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings/profile" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Настройки
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Изход
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>
    </header>
  );
}