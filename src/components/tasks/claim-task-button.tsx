import { useState } from "react";
import { Trophy } from "lucide-react";
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
import { useAuth } from "@/lib/auth";
import { useClaimEngagement, useMyEngagements } from "@/lib/reviews-api";
import { reviewErrorBg } from "@/services/reviews";

/** Shown to professionals who unlocked the task: "Спечелих тази задача". */
export function ClaimTaskButton({
  taskId,
  size = "default",
  className = "",
}: {
  taskId: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const claim = useClaimEngagement();
  const { data: engagements = [] } = useMyEngagements(Boolean(user));
  const mine = engagements.find((e) => e.taskId === taskId && e.professionalId === user?.id);

  if (!user) return null;

  if (mine) {
    const label =
      mine.status === "claimed"
        ? "Чака потвърждение от клиента"
        : mine.status === "confirmed"
          ? "Потвърдена работа"
          : mine.status === "rejected"
            ? "Клиентът не потвърди"
            : "Изтекла заявка";
    return (
      <p className={`text-xs text-muted-foreground ${className}`}>{label}</p>
    );
  }

  const submit = async () => {
    try {
      await claim.mutateAsync(taskId);
      setOpen(false);
      toast.success("Готово! Изпратихме на клиента заявка за потвърждение.");
    } catch (e) {
      toast.error(reviewErrorBg(e));
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size={size}
        className={`w-full min-w-0 gap-2 whitespace-normal ${className}`}
        onClick={() => setOpen(true)}
      >
        <Trophy className="h-4 w-4 shrink-0" /> Спечелих тази задача
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Спечели ли тази задача?</DialogTitle>
            <DialogDescription>
              Ще изпратим на клиента въпрос за потвърждение. След като потвърди, и двамата ще можете да
              си оставите отзив в рамките на 14 дни.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Откажи
            </Button>
            <Button disabled={claim.isPending} onClick={() => void submit()}>
              Да, аз я изпълних
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}