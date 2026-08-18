import { Link } from "@tanstack/react-router";
import { MapPin, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TopBadge, UrgentBadge } from "@/components/promotions/promo-badges";
import { getCategory, CATEGORY_IMAGES, type Task } from "@/lib/mock-data";

export function TaskCard({ task }: { task: Task }) {
  const cat = getCategory(task.category);
  const Icon = cat.icon;
  const thumb = task.image ?? CATEGORY_IMAGES[task.category] ?? CATEGORY_IMAGES.drugi;
  const srcSet = responsiveSrcSet(thumb);

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
          {...(srcSet ? { srcSet, sizes: "(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw" } : {})}
          alt={`${task.title}, ${cat.name}${task.location ? `, ${task.location}` : ""}`}
          loading="lazy"
          decoding="async"
          width={640}
          height={480}
          className="aspect-[4/3] w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-1.5 p-1.5">
          <Badge
            variant="secondary"
            className="min-w-0 max-w-[60%] gap-1 rounded-full bg-background/90 px-1.5 py-0.5 text-[9px] font-medium leading-tight shadow-sm backdrop-blur sm:px-2 sm:text-[11px]"
          >
            <Icon className="hidden h-3 w-3 shrink-0 sm:block" />
            <span className="truncate">{cat.name}</span>
          </Badge>
          {(task.isTop || task.isUrgent) && (
            <div className="flex min-w-0 max-w-[40%] flex-col items-end gap-1">
              {task.isTop && <TopBadge />}
              {task.isUrgent && <UrgentBadge />}
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 p-2.5">
        <h3 className="break-words text-[13px] font-medium leading-snug text-foreground line-clamp-2">
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

/** Unsplash/Supabase-friendly srcset so mobile never downloads a desktop-sized image. */
export function responsiveSrcSet(url?: string) {
  if (!url || !url.includes("images.unsplash.com")) return undefined;
  return [400, 640, 960]
    .map((w) => `${url.replace(/([?&])w=\d+/, `$1w=${w}`)} ${w}w`)
    .join(", ");
}
