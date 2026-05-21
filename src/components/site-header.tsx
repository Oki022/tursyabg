import { Link } from "@tanstack/react-router";
import { ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/post">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Възложи задача</span>
              <span className="sm:hidden">Нова</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}