import { createFileRoute } from "@tanstack/react-router";
import { SettingsPageShell } from "@/components/settings-page-shell";

export const Route = createFileRoute("/_authenticated/settings/profile")({
  head: () => ({
    meta: [
      { title: "Редакция на профил — ЗадачаНет" },
      { name: "description", content: "Промени името, снимката и данните за контакт в профила си." },
      { property: "og:title", content: "Редакция на профил — ЗадачаНет" },
      { property: "og:description", content: "Промени данните в своя профил в ЗадачаНет." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsProfilePage,
});

function SettingsProfilePage() {
  return (
    <SettingsPageShell
      title="Редакция на профил"
      description="Тук ще можеш да редактираш името, снимката, местоположението и данните си за контакт."
    >
      <div className="rounded-2xl border border-border/60 bg-card p-5 text-sm text-muted-foreground shadow-sm">
        Скоро: редакция на профилни данни.
      </div>
    </SettingsPageShell>
  );
}
