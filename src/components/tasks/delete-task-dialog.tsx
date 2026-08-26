import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useDeletePreview, useDeleteTask } from "@/lib/tasks-api";
import { toastError } from "@/lib/toast-error";


const REASONS = [
  { value: "completed", label: "Задачата вече е свършена" },
  { value: "not_needed", label: "Вече не ми трябва" },
  { value: "mistake", label: "Публикувах я по погрешка" },
  { value: "other", label: "Друга причина" },
] as const;

/** Owner delete flow, shows exactly who gets refunded before anything happens. */
export function DeleteTaskDialog({
  taskId,
  open,
  onOpenChange,
  redirectTo,
}: {
  taskId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  redirectTo?: "profile";
}) {
  const navigate = useNavigate();
  const [reason, setReason] = useState<string>("not_needed");
  const { data: preview, isLoading } = useDeletePreview(taskId, open);
  const remove = useDeleteTask();

  const unlockers = preview?.unlockers ?? 0;
  const credits = preview?.credits ?? 0;

  const confirm = async () => {
    try {
      const res = await remove.mutateAsync({
        taskId,
        reason: REASONS.find((r) => r.value === reason)?.label ?? "Друга причина",
      });
      onOpenChange(false);
      toast.success("Задачата е изтрита.", {
        description:
          res.refundedUsers > 0
            ? `Върнахме ${res.refundedCredits} кредита на ${res.refundedUsers} майстор(а).`
            : "Няма майстори за възстановяване на кредити.",
      });
      if (redirectTo === "profile") void navigate({ to: "/profile" });
    } catch (err) {
      toastError(err, { title: "Задачата не беше изтрита" });
    }

  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Изтриване на задачата</DialogTitle>
          <DialogDescription>
            Задачата ще изчезне от борсата и от търсачките. Действието не може да бъде върнато.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {unlockers > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-snug text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {unlockers} майстор(а) вече платиха за контакта ти. При изтриване автоматично им
                  връщаме общо {credits} кредита и ги уведомяваме.
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm">Защо изтриваш задачата?</Label>
              <RadioGroup value={reason} onValueChange={setReason} className="gap-2">
                {REASONS.map((r) => (
                  <label
                    key={r.value}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-secondary/60"
                  >
                    <RadioGroupItem value={r.value} />
                    <span>{r.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={remove.isPending}>
            Отказ
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={remove.isPending}>
            {remove.isPending ? "Изтриване..." : "Изтрий задачата"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
