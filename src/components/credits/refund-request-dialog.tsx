import { useState } from "react";
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

const REASONS: { value: RefundReason; label: string }[] = [
  { value: "fake_task", label: "Фалшива или подвеждаща задача" },
  { value: "already_taken", label: "Задачата вече е възложена" },
  { value: "no_response", label: "Клиентът не отговаря" },
  { value: "wrong_category", label: "Грешна категория" },
  { value: "other", label: "Друга причина" },
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

  const submit = async () => {
    if (!unlockId || !reason) {
      toast.error("Моля избери причина.");
      return;
    }
    try {
      await refund.mutateAsync({ unlockId, reason, details: details.trim().slice(0, 1000) });
      toast.success("Заявката за връщане е изпратена.", {
        description: "Ще я разгледаме до 3 работни дни.",
      });
      onOpenChange(false);
      setReason(undefined);
      setDetails("");
    } catch {
      toast.error("Заявката не беше изпратена.", {
        description: "Възможно е вече да си подал заявка или срокът от 14 дни да е изтекъл.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Заяви връщане на кредити</DialogTitle>
          <DialogDescription>
            Ако задачата е некоректна, можеш да поискаш връщане на изразходваните кредити в рамките на 14 дни.
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