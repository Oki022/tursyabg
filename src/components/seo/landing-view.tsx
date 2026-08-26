import { Link } from "@tanstack/react-router";
import { TaskCard, TaskCardSkeleton } from "@/components/task-card";
import { Button } from "@/components/ui/button";
import { useTasksFeed } from "@/lib/tasks-api";
import { categoryList } from "@/lib/geo";
import { useMunicipalities, useRegionCounts } from "@/lib/locations-api";
import { municipalityLabel, type Municipality } from "@/lib/locations";
import type { Category } from "@/lib/mock-data";

export function LandingView({
  h1,
  intro,
  municipality,
  category,
}: {
  h1: string;
  intro: string;
  municipality?: Municipality;
  category?: Category;
}) {
  const { data, isLoading } = useTasksFeed({
    category: category?.id,
    location: municipality?.name,
  });
  const tasks = data?.pages.flatMap((p) => p.items) ?? [];

  // Nearby = other общини in the same област, ranked by how many active tasks
  // they have, so a quiet община never renders an empty dead end.
  const { data: regionCounts = [] } = useRegionCounts(municipality?.regionSlug, category?.id);
  const { data: allMunicipalities = [] } = useMunicipalities();
  const bigCities = allMunicipalities.filter((m) => m.hasNeighborhoods).slice(0, 8);

  const nearby = municipality
    ? regionCounts
        .filter((c) => c.slug !== municipality.slug)
        .sort((a, b) => b.taskCount - a.taskCount)
        .slice(0, 8)
        .map((c) => ({ slug: c.slug, name: c.name, count: c.taskCount }))
    : bigCities.map((m) => ({ slug: m.slug, name: m.name, count: undefined as number | undefined }));

  const relatedCategories = categoryList.filter((c) => c.id !== category?.id).slice(0, 8);

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <nav aria-label="Навигация" className="mb-4 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link to="/" className="hover:text-foreground hover:underline">Начало</Link></li>
          <li aria-hidden="true">/</li>
          {municipality && (
            <>
              <li>
                <Link to="/city/$city" params={{ city: municipality.slug }} className="hover:text-foreground hover:underline">
                  {municipalityLabel(municipality.name, municipality.hasNeighborhoods)}
                </Link>
              </li>
              {category && <li aria-hidden="true">/</li>}
            </>
          )}
          {category && <li className="text-foreground">{category.name}</li>}
          {!category && !municipality && <li className="text-foreground">Задачи</li>}
        </ol>
      </nav>

      <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">{h1}</h1>
      {municipality && (
        <p className="mt-2 text-sm text-muted-foreground">Област {municipality.regionName}</p>
      )}

      <div className="mt-4 max-w-3xl space-y-3 text-[15px] leading-relaxed text-muted-foreground">
        {intro.split(/(?<=\.)\s(?=[А-ЯA-Z])/).reduce<string[][]>((acc, sentence, i) => {
          const bucket = Math.floor(i / 3);
          (acc[bucket] ??= []).push(sentence);
          return acc;
        }, []).map((group, i) => (
          <p key={i}>{group.join(" ")}</p>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/post">Публикувай задача безплатно</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/tasks" search={{ category: category?.id, location: municipality?.name }}>
            Всички активни задачи
          </Link>
        </Button>
      </div>

      <h2 className="mt-10 text-xl font-semibold text-foreground">
        Активни задачи{category ? `, ${category.name}` : ""}{municipality ? ` в ${municipalityLabel(municipality.name, municipality.hasNeighborhoods)}` : ""}
      </h2>

      {isLoading ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <TaskCardSkeleton key={i} />)}
        </div>
      ) : tasks.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          В момента няма активни задачи в тази комбинация. Виж близките общини и категории по-долу или публикувай своята задача.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => <TaskCard key={task.id} task={task} />)}
        </div>
      )}

      <section className="mt-12 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {municipality ? `Близки общини в област ${municipality.regionName}` : "Задачи в големите градове"}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {nearby.map((c) => (
              <li key={c.slug}>
                {category ? (
                  <Link
                    to="/city/$city/$category"
                    params={{ city: c.slug, category: category.id }}
                    className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {category.name} в {municipalityLabel(c.name)}
                    {c.count ? ` (${c.count})` : ""}
                  </Link>
                ) : (
                  <Link
                    to="/city/$city"
                    params={{ city: c.slug }}
                    className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {municipalityLabel(c.name)}
                    {c.count ? ` (${c.count})` : ""}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Свързани категории</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {relatedCategories.map((c) => (
              <li key={c.id}>
                {municipality ? (
                  <Link
                    to="/city/$city/$category"
                    params={{ city: municipality.slug, category: c.id }}
                    className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {c.name} в {municipalityLabel(municipality.name, municipality.hasNeighborhoods)}
                  </Link>
                ) : (
                  <Link
                    to="/categories/$category"
                    params={{ category: c.id }}
                    className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {c.name}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
