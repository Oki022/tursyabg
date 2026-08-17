import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { reportReview } from "@/services/reviews";

const REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "Спам" },
  { value: "fraud", label: "Невярна информация / измама" },
  { value: "inappropriate", label: "Обиден или неподходящ език" },
  { value: "other", label: "Друго" },
];

/** Report an unfair review for moderation. */
export function ReportReviewDialog({ reviewId }: { reviewId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("inappropriate");
  const [details, setDetails] = useState("");

  const submit = useMutation({
    mutationFn: () => reportReview({ reviewId, reason, details }),
    onSuccess: () => {
      toast.success("Благодарим! Отзивът е изпратен за проверка.");
      setOpen(false);
      setDetails("");
    },
    onError: () => toast.error("Отзивът вече е докладван или възникна грешка."),
  });

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <Flag className="h-3 w-3" /> Докладвай отзив
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Докладвай отзив</DialogTitle>
            <DialogDescription>
              Екипът ни ще прегледа отзива. Ако нарушава правилата, ще бъде скрит.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={reason} onValueChange={setReason} className="gap-2">
            {REASONS.map((r) => (
              <div key={r.value} className="flex items-center gap-2">
                <RadioGroupItem value={r.value} id={`rr-${r.value}`} />
                <Label htmlFor={`rr-${r.value}`} className="text-sm font-normal">
                  {r.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Опиши накратко проблема (по избор)"
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Откажи
            </Button>
            <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
              Изпрати
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}