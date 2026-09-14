import { Link, useRouterState } from "@tanstack/react-router";
import { CircleUserRound, LogOut, MessageCircle, Plus, Settings, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";
import { FavouritesNavLink } from "@/components/favourites-nav-link";
import { MessagesNavLink } from "@/components/messages-nav-link";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { cn } from "@/lib/utils";
import { useCreditBalance } from "@/lib/credits-api";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV_UNDERLINE =
  "after:absolute after:inset-x-5 after:bottom-1 after:h-[2px] after:origin-left after:rounded-full after:bg-gradient-to-r after:from-orange-500 after:to-rose-500 after:transition-transform after:duration-200 after:ease-out";

const NAV_BASE =
  "relative rounded-full px-5 py-2 text-base tracking-[0.015em] transition-all duration-200 ease-out motion-reduce:transition-none";

const navLinkIdle = `${NAV_BASE} font-medium text-muted-foreground after:scale-x-0 hover:bg-gradient-to-r hover:from-orange-500/10 hover:to-rose-500/10 hover:text-foreground hover:after:scale-x-100 ${NAV_UNDERLINE}`;
const navLinkActive = `${NAV_BASE} bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text font-semibold text-transparent after:scale-x-100 ${NAV_UNDERLINE}`;

export function SiteHeader() {
  const { user, loading, hasStoredSession, logout } = useAuth();
  // Сесията се пази в браузъра, затова сървърът не я знае при първото рисуване.
  // Докато не се изясни, показваме неутрални места със същите размери,
  // вместо да предполагаме, че потребителят не е влязъл.
  const authState: "in" | "out" | "pending" = user
    ? "in"
    : loading
      ? hasStoredSession === false
        ? "out"
        : "pending"
      : "out";
  const balance = useCreditBalance(user?.id);
  const credits = balance.data ?? user?.credits ?? 0;
  const hidden = useHideOnScroll();
  const isHome = useRouterState({ select: (s) => s.location.pathname }) === "/";
  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full max-w-full border-b border-border/60 bg-background/80 backdrop-blur transition-transform duration-300 ease-out supports-[backdrop-filter]:bg-background/60 motion-reduce:transition-none",
        hidden && "md:-translate-y-full motion-reduce:translate-y-0",
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-2 px-4 md:grid md:grid-cols-[1fr_auto_1fr]">
        <Logo size="md" />
        {!isHome && (
          <nav className="hidden items-center gap-2 justify-self-center md:flex">
            <Link to="/" className={navLinkIdle} activeOptions={{ exact: true }} activeProps={{ className: navLinkActive }}>
              Начало
            </Link>
            <Link to="/tasks" className={navLinkIdle} activeProps={{ className: navLinkActive }}>
              Намери работа
            </Link>
          </nav>
        )}
        <div className="flex items-center gap-2 justify-self-end md:col-start-3">
          {authState === "pending" && <AuthClusterPlaceholder />}
          {authState === "in" && <MessagesNavLink />}
          {authState === "in" && <FavouritesNavLink />}
          {authState === "in" && <NotificationBell />}
          {authState === "out" ? (
            <>
              <Button asChild variant="ghost" className="h-9 px-4 text-sm font-medium">
                <Link to="/auth" search={{ mode: "login" }}>Вход</Link>
              </Button>
              <Button asChild className="h-9 px-4 text-sm font-semibold">
                <Link to="/auth" search={{ mode: "register" }}>Регистрация</Link>
              </Button>
              <ThemeToggle />
            </>
          ) : authState === "in" ? (
            <>
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="ml-0.5 hidden h-9 w-9 items-center justify-center rounded-full text-foreground ring-offset-background transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:flex"
                    aria-label="Меню на профила"
                  >
                    <CircleUserRound className="h-[22px] w-[22px]" strokeWidth={1.6} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <span className="truncate">{user?.name}</span>
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
                    <Link to="/settings/security" className="cursor-pointer">
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
          ) : null}
          {authState === "in" && (
            <Link
              to="/post"
              aria-label="Възложи работа"
              className="ml-1 hidden h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-3.5 text-sm font-semibold text-white shadow-sm shadow-rose-500/20 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:inline-flex"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Възложи
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function AuthClusterPlaceholder() {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-9 w-9 animate-pulse rounded-full bg-muted/60" />
      ))}
      <span className="ml-0.5 hidden h-9 w-9 animate-pulse rounded-full bg-muted/60 md:block" />
      <span className="ml-1 hidden h-9 w-[124px] animate-pulse rounded-full bg-muted/60 md:block" />
    </div>
  );
}