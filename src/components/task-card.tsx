import { Link } from "@tanstack/react-router";
import { MapPin, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TopBadge, UrgentBadge } from "@/components/promotions/promo-badges";
import { FavouriteButton } from "@/components/favourite-button";
import { getCategory, type Task } from "@/lib/mock-data";
import { formatLocation } from "@/lib/locations";
import { TaskThumb } from "@/components/task-thumb";


export function TaskCard({ task }: { task: Task }) {
  const cat = getCategory(task.category);
  const Icon = cat.icon;
  const thumb = task.image;

  return (
    <div className="relative h-full">
    <Link
      to="/task/$id"
      params={{ id: task.id }}
      aria-label={task.title}
      className={`group flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        task.isTop ? "border-primary/40 bg-primary/[0.04] shadow-primary/10" : "border-border/50"
      }`}
    >
      <div className="relative w-full overflow-hidden bg-muted">
        <TaskThumb
          src={thumb}
          category={task.category}
          title={`${task.title}, ${cat.name}${task.location ? `, ${task.location}` : ""}`}
          iconClassName="h-10 w-10"
          className="aspect-[4/3] w-full"
        />
        <div className="pointer-events-none absolute left-0 top-0 right-12 p-1.5">
          <Badge
            variant="secondary"
            className="min-w-0 w-auto max-w-full gap-1 rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] font-medium leading-tight shadow-sm backdrop-blur sm:px-2 sm:text-[11px]"
          >
            <Icon className="hidden h-3 w-3 shrink-0 sm:block" />
            <span className="truncate whitespace-nowrap">{cat.name}</span>
          </Badge>
        </div>
        {(task.isTop || task.isUrgent) && (
          <div className="pointer-events-none absolute bottom-0 right-0 flex min-w-0 max-w-[50%] flex-col items-end gap-1 p-1.5">
            {task.isTop && <TopBadge />}
            {task.isUrgent && <UrgentBadge />}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-2.5">
        <h3 className="break-words text-[13px] font-medium leading-snug text-foreground line-clamp-2">
          {task.title}
        </h3>
        <p className="text-sm font-bold text-primary md:text-base">{task.budget} €</p>
        <div className="mt-auto flex min-w-0 flex-col gap-0.5 pt-1 text-[11px] text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{formatLocation(task.location)}</span>
          </span>
          <span className="flex min-w-0 items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">{task.postedAt}</span>
          </span>
          {typeof task.unlockCount === "number" && (task.maxUnlocks ?? 5) - task.unlockCount <= 2 && (
            <span className="truncate font-semibold text-primary">
              {(task.maxUnlocks ?? 5) - task.unlockCount > 0
                ? `Остават ${(task.maxUnlocks ?? 5) - task.unlockCount} места`
                : "Местата са запълнени"}
            </span>
          )}
        </div>
      </div>
    </Link>
      <FavouriteButton taskId={task.id} ownerId={task.userId} className="absolute right-1.5 top-1.5 z-10" />
    </div>
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

