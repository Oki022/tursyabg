import { Link } from "@tanstack/react-router";
import { ClipboardList, Plus, MessageCircle, User as UserIcon, LogOut, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";
import { useAuth, getInitials } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  return (
    <header
      className="fixed bottom-0 left-0 right-0 z-50 w-full border-t border-border/60 shadow-2xl md:sticky md:bottom-auto md:top-0 md:z-40 md:border-b md:border-t-0 md:shadow-none bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ClipboardList className="h-5 w-5" />
          </span>
          <span className="text-lg tracking-tight">ЗадачаНет</span>
        </Link>
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
          <Link to="/messages" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" activeProps={{ className: "rounded-md px-3 py-2 text-sm font-medium text-foreground" }}>
            Съобщения
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {user && <NotificationBell />}
          {user && (
            <Button asChild variant="ghost" size="icon" className="md:hidden" aria-label="Съобщения">
              <Link to="/messages">
                <MessageCircle className="h-5 w-5" />
              </Link>
            </Button>
          )}
          {!user ? (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
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
                    className="ml-0.5 rounded-full ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label="Меню на профила"
                  >
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <span className="truncate">{user.name}</span>
                    {user.role === "worker" && user.verified && (
                      <BadgeCheck className="h-4 w-4 fill-[#1da1f2] text-white" />
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      <UserIcon className="mr-2 h-4 w-4" />
                      Моят профил
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="cursor-pointer">
                      <ClipboardList className="mr-2 h-4 w-4" />
                      Моите задачи
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