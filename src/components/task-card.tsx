import { Link } from "@tanstack/react-router";
import { MapPin, Clock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCategory, type Task } from "@/lib/mock-data";

export function TaskCard({ task }: { task: Task }) {
  const cat = getCategory(task.category);
  const Icon = cat.icon;
  return (
    <article className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
      <div className="mb-3 flex items-start justify-between gap-3">
        <Badge variant="secondary" className="gap-1.5 rounded-full px-2.5 py-1 font-medium">
          <Icon className="h-3.5 w-3.5" />
          {cat.name}
        </Badge>
        <span className="text-base font-semibold text-foreground whitespace-nowrap">
          {task.budget} €
        </span>
      </div>
      <h3 className="mb-2 text-base font-semibold leading-snug text-foreground line-clamp-2">
        {task.title}
      </h3>
      <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{task.description}</p>
      <div className="mt-auto flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {task.city}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {task.postedAt}
          </span>
        </div>
        <Button asChild size="sm" variant="ghost" className="h-8 gap-1 px-2 text-primary hover:text-primary">
          <Link to="/tasks/$taskId" params={{ taskId: task.id }}>
            Виж <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </article>
  );
}