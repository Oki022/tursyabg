import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useCancelAccountDeletion, useReactivateAccount } from "@/lib/account-api";
import { toastError } from "@/lib/toast-error";

function formatDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("bg-BG", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Показва се веднага след вход, ако профилът е деактивиран (или е заявено
 * изтриване). Предлага възстановяване или отказ от изтриването.
 */
export function AccountStatusGate() {
  const { user, logout, refreshUser } = useAuth();
  const reactivate = useReactivateAccount();
  const cancelDeletion = useCancelAccountDeletion();
  const [busy, setBusy] = useState(false);

  if (!user?.deactivated) return null;

  const pendingDeletion = Boolean(user.deletionScheduledFor);

  const restore = async () => {
    setBusy(true);
    try {
      if (pendingDeletion) {
        await cancelDeletion.mutateAsync();
        toast.success("Изтриването е отказано. Профилът ти е активен отново.");
      } else {
        await reactivate.mutateAsync();
        toast.success("Профилът ти е активен отново.");
      }
      await refreshUser();
    } catch (err) {
      toastError(err, { title: "Профилът не беше възстановен" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-background/90 p-4 backdrop-blur">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-card p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">
              {pendingDeletion ? "Профилът ти е заявен за изтриване" : "Профилът ти е деактивиран"}
            </h2>
            {pendingDeletion ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Ще бъде изтрит окончателно на{" "}
                <span className="font-medium text-foreground">{formatDate(user.deletionScheduledFor)}</span>. До
                тази дата можеш да откажеш изтриването и всичко се връща както преди. Задачите ти
                възстановяват предишния си статус.
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Задачите ти са скрити и не можеш да публикуваш или да пишеш съобщения. Можеш да
                активираш профила си веднага и задачите ти ще се върнат в предишното си състояние.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button onClick={restore} disabled={busy} className="gap-2 sm:flex-1">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {pendingDeletion ? "Откажи изтриването" : "Активирай профила"}
          </Button>
          <Button variant="outline" onClick={() => void logout()} disabled={busy} className="sm:flex-1">
            Излез
          </Button>
        </div>
      </div>
    </div>
  );
}
