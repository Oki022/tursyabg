import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationList } from "@/components/notifications/notification-list";
import {
  useMarkAllNotificationsRead,
  useNotifications,
} from "@/lib/notifications-api";

const PAGE = 20;

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Известия | ТърсяБГ" },
      {
        name: "description",
        content: "Всички твои известия за задачи, съобщения, кредити и промоции в ТърсяБГ.",
      },
      { property: "og:title", content: "Известия | ТърсяБГ" },
      { property: "og:description", content: "Следи новините по своите задачи и съобщения." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const [limit, setLimit] = useState(PAGE);
  const listQuery = useNotifications(true, limit);
  const markAll = useMarkAllNotificationsRead();
  const items = listQuery.data ?? [];
  const canLoadMore = items.length >= limit;

  // Snapshot unread rows on first load so the styling stays for this visit,
  // while the badge clears right away.
  const [sessionUnread, setSessionUnread] = useState<Set<string> | undefined>(undefined);
  const snapshotTaken = useRef(false);
  useEffect(() => {
    if (snapshotTaken.current || listQuery.isLoading) return;
    snapshotTaken.current = true;
    setSessionUnread(new Set(items.filter((n) => !n.readAt).map((n) => n.id)));
    if (items.some((n) => !n.readAt)) markAll.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQuery.isLoading]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <Link
        to="/profile"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Назад към профила
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Известия</h1>

      {listQuery.isError ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert className="h-5 w-5" />
          </span>
          <p className="text-sm font-semibold text-foreground">Известията не се заредиха</p>
          <p className="text-xs text-muted-foreground">
            Нещо се обърка при връзката. Опитай отново след малко.
          </p>
          <Button size="sm" variant="outline" onClick={() => void listQuery.refetch()}>
            Опитай отново
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            <NotificationList items={items} isLoading={listQuery.isLoading} unreadIds={sessionUnread} />
          </div>
          {canLoadMore && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                disabled={listQuery.isFetching}
                onClick={() => setLimit((l) => l + PAGE)}
              >
                {listQuery.isFetching ? "Зареждане..." : "Покажи още"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
