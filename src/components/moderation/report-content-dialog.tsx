import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { reportContent } from "@/services/moderation-admin";

const REASONS = [
  { value: "spam", label: "Спам или реклама" },
  { value: "fraud", label: "Измама или искане на пари предварително" },
  { value: "inappropriate", label: "Неподходящо, обидно или сексуално съдържание" },
  { value: "other", label: "Друго" },
];

const TITLES: Record<string, string> = {
  profile: "Докладвай профила",
  message: "Докладвай съобщението",
  task: "Докладвай задачата",
  review: "Докладвай отзива",
};

export function ReportContentDialog({
  contentType,
  contentId,
  trigger,
}: {
  contentType: "profile" | "message" | "task" | "review";
  contentId: string;
  trigger?: ReactNode;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");

  const submit = useMutation({
    mutationFn: () => reportContent({ contentType, contentId, reason, details }),
    onSuccess: () => {
      toast.success("Благодарим! Докладът е изпратен към модераторите.");
      setOpen(false);
      setDetails("");
    },
    onError: (e: unknown) => toastError(e, { title: "Докладът не беше изпратен" }),

  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o && !user) {
          void navigate({ to: "/auth", search: { mode: "login" } });
          return;
        }
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Flag className="h-4 w-4" /> Докладвай
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITLES[contentType] ?? "Докладвай"}</DialogTitle>
          <DialogDescription>
            Докладите се преглеждат от модератор. Злоупотребата с докладване също е нарушение.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={reason} onValueChange={setReason} className="gap-2">
          {REASONS.map((r) => (
            <div key={r.value} className="flex items-center gap-2">
              <RadioGroupItem value={r.value} id={`rc-${contentId}-${r.value}`} />
              <Label htmlFor={`rc-${contentId}-${r.value}`} className="text-sm font-normal">
                {r.label}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <Textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          placeholder="Опиши накратко какво е нередно (по избор)"
        />

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Отказ
          </Button>
          <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
            Изпрати доклад
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
