import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, KeyRound, AlertTriangle } from "lucide-react";
import { SettingsPageShell } from "@/components/settings-page-shell";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/security")({
  head: () => ({
    meta: [
      { title: "Влизане и сигурност — ЗадачаНет" },
      { name: "description", content: "Смени паролата си и управлявай сигурността и статуса на акаунта си." },
      { property: "og:title", content: "Влизане и сигурност — ЗадачаНет" },
      { property: "og:description", content: "Настройки за сигурност на профила в ЗадачаНет." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsSecurityPage,
});

function SettingsSecurityPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleDeactivate = () => {
    toast.success("Профилът ти е деактивиран. Можеш да го активираш при следващо влизане.");
  };

  const handleDelete = async () => {
    toast.success("Заявката за изтриване на профила е приета.");
    await logout();
    navigate({ to: "/" });
  };

  return (
    <SettingsPageShell
      title="Влизане и сигурност"
      description="Управлявай паролата и достъпа до своя акаунт."
    >
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Вход в акаунта</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Имейл за вход: <span className="font-medium text-foreground">{user?.email}</span>
        </p>
        <Button variant="outline" className="mt-4 gap-2">
          <KeyRound className="h-4 w-4" />
          Смени паролата
        </Button>
      </div>

      {/* Опасна зона */}
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <h2 className="text-lg font-semibold text-destructive">Действия по моя профил</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Тези действия са необратими или ще ограничат достъпа ти до платформата.
        </p>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-background px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Деактивирай профила</p>
              <p className="text-xs text-muted-foreground">
                Задачите ти се скриват, но данните се запазват.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleDeactivate}>
              Деактивирай
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-background px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Изтрий профила</p>
              <p className="text-xs text-muted-foreground">
                Профилът и всички твои задачи се премахват завинаги.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Изтрий профила
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Сигурен ли си?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Това действие е необратимо. Профилът, задачите и съобщенията ти ще бъдат
                    изтрити завинаги.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Откажи</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Да, изтрий
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </SettingsPageShell>
  );
}
