import { useState } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useAssignEngagement, useTaskUnlockers } from "@/lib/reviews-api";
import { RatingInline } from "@/components/reviews/stars";
import { reviewErrorBg } from "@/services/reviews";

const EXTERNAL = "external";

/**
 * After the owner closes a task we ask which unlocker got the job. Selecting
 * someone creates a pre-confirmed engagement (the client confirms it himself).
 */
export function AssignProfessionalDialog({
  taskId,
  open,
  onOpenChange,
}: {
  taskId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: unlockers = [], isLoading } = useTaskUnlockers(taskId, open);
  const assign = useAssignEngagement();
  const [selected, setSelected] = useState<string>(EXTERNAL);

  const submit = async () => {
    if (selected === EXTERNAL) {
      onOpenChange(false);
      return;
    }
    try {
      await assign.mutateAsync({ taskId, professionalId: selected });
      onOpenChange(false);
      toast.success("Благодарим! Вече можеш да оставиш отзив за изпълнителя.");
    } catch (e) {
      toast.error(reviewErrorBg(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Кой изпълни задачата?</DialogTitle>
          <DialogDescription>
            Посочи изпълнителя, за да можете да си оставите отзиви. Това помага на другите потребители
            да преценят на кого да се доверят.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="h-20 animate-pulse rounded-xl bg-muted" />
        ) : (
          <RadioGroup value={selected} onValueChange={setSelected} className="gap-2">
            {unlockers.map((u) => (
              <div
                key={u.userId}
                className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2"
              >
                <RadioGroupItem
                  value={u.userId}
                  id={`pro-${u.userId}`}
                  disabled={u.hasEngagement}
                />
                <Label htmlFor={`pro-${u.userId}`} className="min-w-0 flex-1 font-normal">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {u.fullName ?? "Изпълнител"}
                  </span>
                  <RatingInline rating={u.ratingAsPro} count={u.reviewCountAsPro} />
                </Label>
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <RadioGroupItem value={EXTERNAL} id="pro-external" />
              <Label htmlFor="pro-external" className="text-sm font-normal">
                Друг / външен изпълнител
              </Label>
            </div>
          </RadioGroup>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            По-късно
          </Button>
          <Button disabled={assign.isPending} onClick={() => void submit()}>
            Потвърди
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}