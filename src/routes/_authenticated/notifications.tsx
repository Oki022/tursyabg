import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { NotificationList } from "@/components/notifications/notification-list";
import { useMarkAllNotificationsRead, useNotifications, useUnreadNotifications } from "@/lib/notifications-api";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Известия — Търся" },
      { name: "description", content: "Всички твои известия за задачи, съобщения, кредити и промоции в Търся." },
      { property: "og:title", content: "Известия — Търся" },
      { property: "og:description", content: "Следи новините по своите задачи и съобщения." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const listQuery = useNotifications(true, 100);
  const unreadQuery = useUnreadNotifications(true);
  const markAll = useMarkAllNotificationsRead();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Известия</h1>
        {(unreadQuery.data ?? 0) > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
            Маркирай всички като прочетени
          </Button>
        )}
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <NotificationList items={listQuery.data ?? []} isLoading={listQuery.isLoading} />
      </div>
    </div>
  );
}
