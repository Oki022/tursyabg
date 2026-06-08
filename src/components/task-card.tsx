import { Link } from "@tanstack/react-router";
import { MapPin, Clock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCategory, CATEGORY_IMAGES, type Task } from "@/lib/mock-data";

export function TaskCard({ task }: { task: Task }) {
  const cat = getCategory(task.category);
  const Icon = cat.icon;
  const thumb = task.image ?? CATEGORY_IMAGES[task.category] ?? CATEGORY_IMAGES.drugi;
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
      <Link
        to="/task/$id"
        params={{ id: task.id }}
        className="relative block w-full overflow-hidden bg-slate-100"
        aria-label={task.title}
      >
        <img
          src={thumb}
          alt={task.title}
          loading="lazy"
          className="mx-auto block h-[240px] w-full object-contain transition-transform duration-500 group-hover:scale-[1.03]"
        />
        <span className="absolute left-3 top-3">
          <Badge variant="secondary" className="gap-1.5 rounded-full bg-white/95 px-2.5 py-1 font-medium text-slate-900 shadow-sm backdrop-blur">
            <Icon className="h-3.5 w-3.5" />
            {cat.name}
          </Badge>
        </span>
        <span className="absolute right-3 top-3 rounded-full bg-slate-900/85 px-3 py-1 text-sm font-semibold text-white shadow-md backdrop-blur">
          {task.budget} €
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="mb-2 text-base font-semibold leading-snug text-slate-900 line-clamp-2">
          {task.title}
        </h3>
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {task.location}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {task.postedAt}
          </span>
        </div>
        <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{task.description}</p>
        <Button asChild size="sm" className="mt-auto w-full gap-1.5">
          <Link to="/task/$id" params={{ id: task.id }}>
            Виж задачата <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </article>
  );
}