import { useState } from "react";
import { Link } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRequestRefund } from "@/lib/credits-api";
import type { RefundReason } from "@/services/credits";
import { toast } from "sonner";

const REASONS: { value: RefundReason; label: string; hint: string }[] = [
  {
    value: "fake_task",
    label: "Фалшива или подвеждаща задача",
    hint: "Ако 3+ различни потребители са докладвали задачата, връщането е автоматично.",
  },
  {
    value: "already_taken",
    label: "Задачата вече е възложена",
    hint: "Ако възложителят е затворил задачата след твоето отключване, връщането е автоматично.",
  },
  {
    value: "no_response",
    label: "Клиентът не отговаря",
    hint: "Изпрати съобщение и изчакай 5 дни — без отговор кредитите се връщат автоматично.",
  },
  { value: "wrong_category", label: "Грешна категория", hint: "Разглежда се от екипа ни." },
  { value: "other", label: "Друга причина", hint: "Разглежда се от екипа ни." },
];

export function RefundRequestDialog({
  open,
  onOpenChange,
  unlockId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unlockId: string | null;
}) {
  const [reason, setReason] = useState<RefundReason | undefined>(undefined);
  const [details, setDetails] = useState("");
  const refund = useRequestRefund();
  const hint = REASONS.find((r) => r.value === reason)?.hint;

  const submit = async () => {
    if (!unlockId || !reason) {
      toast.error("Моля избери причина.");
      return;
    }
    try {
      const res = await refund.mutateAsync({ unlockId, reason, details: details.trim().slice(0, 1000) });
      if (!res.ok) {
        if (res.error === "TOO_EARLY") {
          const when = res.availableAt
            ? new Date(res.availableAt).toLocaleDateString("bg-BG", { day: "numeric", month: "long" })
            : null;
          toast.error("Още е рано за тази заявка.", {
            description: when
              ? `Изчакай 5 дни след отключването — можеш да заявиш от ${when}.`
              : "Изчакай 5 дни след отключването на контакта.",
          });
          return;
        }
        const map: Record<string, string> = {
          DUPLICATE: "Вече си подал заявка за това отключване.",
          WINDOW_EXPIRED: "Срокът от 14 дни е изтекъл.",
          NOT_FOUND: "Отключването не беше намерено.",
          NOT_AUTHENTICATED: "Трябва да си влязъл в профила си.",
        };
        toast.error(map[res.error] ?? "Заявката не беше изпратена.");
        return;
      }
      if (res.auto) {
        toast.success("Кредитите ти са върнати веднага.", {
          description: `Възстановени: ${res.credits ?? 0} кредита.`,
        });
      } else {
        toast.success("Заявката за връщане е изпратена.", {
          description: "Ще я разгледаме до 3 работни дни.",
        });
      }
      onOpenChange(false);
      setReason(undefined);
      setDetails("");
    } catch {
      toast.error("Заявката не беше изпратена. Опитай отново.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Заяви връщане на кредити</DialogTitle>
          <DialogDescription>
            Ако задачата е некоректна, можеш да поискаш връщане в рамките на 14 дни. Част от случаите се
            одобряват автоматично.{" "}
            <Link to="/refund-policy" className="font-medium text-primary hover:underline">
              Правила
            </Link>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Причина</Label>
          <Select value={reason} onValueChange={(v) => setReason(v as RefundReason)}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Избери причина" />
            </SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="refund-details">Подробности</Label>
          <Textarea
            id="refund-details"
            rows={4}
            maxLength={1000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Опиши какво се случи..."
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="sm:flex-1">
            Отказ
          </Button>
          <Button onClick={submit} disabled={refund.isPending} className="sm:flex-1">
            {refund.isPending ? "Изпращане..." : "Изпрати заявка"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}