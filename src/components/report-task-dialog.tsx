import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flag } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { getMyReport, reportTask, REPORT_REASON_BG } from "@/services/admin";

export function ReportTaskDialog({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");

  const mine = useQuery({
    queryKey: ["task-report", taskId, user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => getMyReport(taskId),
  });

  const submit = useMutation({
    mutationFn: () => reportTask({ taskId, reason, details }),
    onSuccess: () => {
      toast.success("Благодарим! Докладът е изпратен към екипа.");
      setOpen(false);
      setDetails("");
      void qc.invalidateQueries({ queryKey: ["task-report", taskId] });
    },
    onError: (e: Error) => {
      toast.error(e.message === "DUPLICATE" ? "Вече си докладвал тази задача." : "Докладът не беше изпратен.");
    },
  });

  const alreadyReported = Boolean(mine.data);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="w-full gap-2 text-muted-foreground"
        disabled={alreadyReported}
        onClick={() => {
          if (!user) {
            void navigate({ to: "/auth", search: { redirect: `/task/${taskId}` } });
            return;
          }
          setOpen(true);
        }}
      >
        <Flag className="h-3.5 w-3.5" />
        {alreadyReported ? "Задачата е докладвана" : "Докладвай"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Докладвай задачата</DialogTitle>
            <DialogDescription>Екипът ни ще прегледа сигнала. Докладът е анонимен за другия потребител.</DialogDescription>
          </DialogHeader>

          <RadioGroup value={reason} onValueChange={setReason} className="gap-2">
            {Object.entries(REPORT_REASON_BG).map(([value, label]) => (
              <div key={value} className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2">
                <RadioGroupItem value={value} id={`report-${value}`} />
                <Label htmlFor={`report-${value}`} className="cursor-pointer text-sm font-normal">
                  {label}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            placeholder="Опиши накратко проблема (по избор)"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Отказ</Button>
            <Button disabled={submit.isPending} onClick={() => submit.mutate()}>Изпрати доклад</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
