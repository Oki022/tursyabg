import { createFileRoute } from "@tanstack/react-router";
import { SettingsPageShell } from "@/components/settings-page-shell";

export const Route = createFileRoute("/_authenticated/settings/notifications")({
  head: () => ({
    meta: [
      { title: "Нотификации — Търся" },
      { name: "description", content: "Избери за какво да получаваш известия по имейл и в приложението." },
      { property: "og:title", content: "Нотификации — Търся" },
      { property: "og:description", content: "Управлявай своите известия в Търся." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsNotificationsPage,
});

function SettingsNotificationsPage() {
  return (
    <SettingsPageShell
      title="Нотификации"
      description="Избери за какво да получаваш известия — нови задачи, съобщения и оферти."
    >
      <div className="rounded-2xl border border-border/60 bg-card p-5 text-sm text-muted-foreground shadow-sm">
        Скоро: настройки за известия.
      </div>
    </SettingsPageShell>
  );
}
