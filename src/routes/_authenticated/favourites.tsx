import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { TaskCard, TaskCardSkeleton } from "@/components/task-card";
import { useFavouritesList, useToggleFavourite } from "@/lib/favourites-api";
import { pageTitle } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/favourites")({
  head: () => ({
    meta: [
      { title: pageTitle("Любими задачи") },
      { name: "description", content: "Задачите, които си запазил, на едно място." },
      { property: "og:title", content: pageTitle("Любими задачи") },
      { property: "og:description", content: "Задачите, които си запазил, на едно място." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FavouritesPage,
});

function FavouritesPage() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useFavouritesList();
  const toggle = useToggleFavourite();
  const items = data?.pages.flatMap((p) => p.items) ?? [];

  const remove = (taskId: string) =>
    toggle.mutate({ taskId, saved: true }, { onError: () => toast.error("Неуспешно премахване. Опитай пак.") });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 md:py-10">
      <BackLink />
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground md:text-3xl">Любими задачи</h1>
      <p className="mt-1 text-sm text-muted-foreground">Запазените от теб задачи, най-новите най-отгоре.</p>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <TaskCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <Heart className="mx-auto mb-3 h-8 w-8 text-muted-foreground opacity-60" />
          <p className="text-sm font-medium text-foreground">Още нямаш запазени задачи.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Натисни сърцето върху задача, за да я запазиш за по-късно.
          </p>
          <Button asChild className="mt-4">
            <Link to="/tasks">Разгледай задачите</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) =>
              item.task && !item.inactive ? (
                <TaskCard key={item.favouriteId} task={item.task} />
              ) : (
                <div key={item.favouriteId} className="relative min-w-0">
                  <div className="pointer-events-none opacity-50 grayscale">
                    {item.task ? (
                      <TaskCard task={item.task} />
                    ) : (
                      <div className="flex h-full min-h-40 flex-col justify-end rounded-xl border border-border/50 bg-muted p-3">
                        <p className="text-[13px] font-medium text-muted-foreground">Задачата е премахната</p>
                      </div>
                    )}
                  </div>
                  <span className="absolute inset-x-1.5 top-1.5 z-10 rounded-full bg-background/95 px-2 py-1 text-center text-[10px] font-semibold text-muted-foreground shadow-sm">
                    Задачата вече не е активна
                  </span>
                  <button
                    type="button"
                    aria-label="Премахни от любими"
                    onClick={() => remove(item.taskId)}
                    className="absolute bottom-1.5 right-1.5 z-10 grid h-8 w-8 place-items-center rounded-full bg-background/95 text-muted-foreground shadow-sm transition-transform active:scale-90"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ),
            )}
          </div>
          {hasNextPage && (
            <div className="mt-6 text-center">
              <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage ? "Зареждане..." : "Покажи още"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
