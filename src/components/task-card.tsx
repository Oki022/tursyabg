import { Link } from "@tanstack/react-router";
import { MapPin, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCategory, CATEGORY_IMAGES, type Task } from "@/lib/mock-data";

export function TaskCard({ task }: { task: Task }) {
  const cat = getCategory(task.category);
  const Icon = cat.icon;
  const thumb = task.image ?? CATEGORY_IMAGES[task.category] ?? CATEGORY_IMAGES.drugi;
  return (
    <Link
      to="/task/$id"
      params={{ id: task.id }}
      aria-label={task.title}
      className={`group flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        task.isTop ? "border-primary/40 bg-primary/[0.04] shadow-primary/10" : "border-border/50"
      }`}
    >
      <div className="relative w-full overflow-hidden bg-muted">
        <img
          src={thumb}
          alt={task.title}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover"
        />
        {(task.isTop || task.isUrgent) && (
          <div className="absolute right-2 top-2 flex max-w-[60%] flex-wrap justify-end gap-1">
            {task.isTop && (
              <span className="rounded-full bg-gradient-to-r from-primary to-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
                ТОП
              </span>
            )}
            {task.isUrgent && (
              <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive-foreground shadow-sm">
                Спешно
              </span>
            )}
          </div>
        )}
        <Badge
          variant="secondary"
          className="absolute left-2 top-2 max-w-[55%] gap-1 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur"
        >
          <Icon className="h-3 w-3 shrink-0" />
          <span className="max-w-[80px] truncate">{cat.name}</span>
        </Badge>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-2.5">
        <h3 className="text-[13px] font-medium leading-snug text-foreground line-clamp-2">
          {task.title}
        </h3>
        <p className="text-sm font-bold text-primary md:text-base">{task.budget} €</p>
        <div className="mt-auto flex min-w-0 flex-col gap-0.5 pt-1 text-[11px] text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{task.location}</span>
          </span>
          <span className="flex min-w-0 items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">{task.postedAt}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
export function TaskCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
      <div className="aspect-[4/3] w-full animate-pulse bg-muted" />
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        <div className="mt-auto h-3 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
