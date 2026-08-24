import { useEffect, useState } from "react";
import { CheckCircle2, EyeOff, Megaphone, UserX } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAssignEngagement, useSubmitReview, useTaskUnlockers } from "@/lib/reviews-api";
import { useCloseTask } from "@/lib/tasks-api";
import { useTaskPromotions } from "@/lib/promotions-api";
import { RatingInline, StarSelector } from "@/components/reviews/stars";
import { PROMO_LABELS, remainingLabel } from "@/services/promotions";
import {
  DOUBLE_BLIND_NOTE,
  REVIEW_PLACEHOLDER,
  formatReviewDate,
  reviewErrorBg,
} from "@/services/reviews";

const EXTERNAL = "__external";
const CANCELLED = "__cancelled";
const MAX = 1000;

/**
 * Closing a task always asks who won it. Selecting an unlocker creates a
 * confirmed engagement and immediately offers the client the review form.
 */
export function CloseTaskDialog({
  taskId,
  open,
  onOpenChange,
  /** When the task is already closed we only offer picking the professional. */
  assignOnly = false,
}: {
  taskId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assignOnly?: boolean;
}) {
  const { data: unlockers = [], isLoading } = useTaskUnlockers(taskId, open);
  const { data: activePromos = [] } = useTaskPromotions(open ? taskId : undefined);
  const assign = useAssignEngagement();
  const close = useCloseTask();
  const submitReview = useSubmitReview();

  const [selected, setSelected] = useState<string>("");
  const [engagementId, setEngagementId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open) {
      setSelected("");
      setEngagementId(null);
      setRating(0);
      setComment("");
    }
  }, [open]);

  const available = unlockers.filter((u) => !u.hasEngagement);
  const busy = assign.isPending || close.isPending;

  const confirmChoice = async () => {
    if (!selected) {
      toast.error("Избери един от вариантите.");
      return;
    }
    try {
      if (selected === EXTERNAL) {
        await close.mutateAsync({ taskId, outcome: "external" });
        onOpenChange(false);
        toast.success("Задачата е затворена.");
        return;
      }
      if (selected === CANCELLED) {
        await close.mutateAsync({ taskId, outcome: "cancelled" });
        onOpenChange(false);
        toast.success("Задачата е деактивирана.");
        return;
      }
      const res = await assign.mutateAsync({ taskId, professionalId: selected });
      setEngagementId(String(res["engagement_id"]));
      toast.success("Изпълнителят е записан. Остави отзив сега или по-късно.");
    } catch (e) {
      toast.error(reviewErrorBg(e));
    }
  };

  const sendReview = async () => {
    if (!engagementId) return;
    if (rating < 1) {
      toast.error("Избери оценка от 1 до 5 звезди.");
      return;
    }
    if (comment.trim().length < 10) {
      toast.error("Коментарът трябва да е поне 10 символа.");
      return;
    }
    try {
      await submitReview.mutateAsync({ engagementId, rating, comment: comment.trim() });
      onOpenChange(false);
      toast.success("Благодарим! Отзивът ще стане видим, когато и другата страна напише своя.");
    } catch (e) {
      toast.error(reviewErrorBg(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        {engagementId ? (
          <>
            <DialogHeader>
              <DialogTitle>Оцени изпълнителя</DialogTitle>
              <DialogDescription>
                Отзивът отнема по-малко от минута и помага на другите потребители.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-start gap-2 rounded-2xl bg-secondary/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{DOUBLE_BLIND_NOTE}</span>
            </div>

            <StarSelector value={rating} onChange={setRating} />
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, MAX))}
              placeholder={REVIEW_PLACEHOLDER.client_to_pro}
              rows={5}
              className="w-full min-w-0 resize-none"
            />

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Ще напиша по-късно
              </Button>
              <Button disabled={submitReview.isPending} onClick={() => void sendReview()}>
                Изпрати отзив
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Кой свърши задачата?</DialogTitle>
              <DialogDescription>
                {available.length > 0
                  ? "Затваряш задачата, защото си намерил изпълнител. Посочи кого нае, за да можете да си оставите отзиви."
                  : "Никой изпълнител още не е отключил контакта ти по тази задача, затова няма кого да посочиш."}
              </DialogDescription>
            </DialogHeader>

            {isLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-muted" />
            ) : (
              <RadioGroup value={selected} onValueChange={setSelected} className="gap-2">
                {available.map((u) => (
                  <div
                    key={u.userId}
                    className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2"
                  >
                    <RadioGroupItem value={u.userId} id={`pro-${u.userId}`} />
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={u.avatarUrl ?? undefined} alt={u.fullName ?? "Изпълнител"} />
                      <AvatarFallback>{(u.fullName ?? "И").slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <Label htmlFor={`pro-${u.userId}`} className="min-w-0 flex-1 font-normal">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {u.fullName ?? "Изпълнител"}
                      </span>
                      <RatingInline rating={u.ratingAsPro} count={u.reviewCountAsPro} />
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        Отключи на {formatReviewDate(u.unlockedAt)}
                      </span>
                    </Label>
                  </div>
                ))}

                {!assignOnly && (
                  <>
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                      <RadioGroupItem value={EXTERNAL} id="pro-external" />
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      <Label htmlFor="pro-external" className="text-sm font-normal">
                        Наех външен изпълнител
                      </Label>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                      <RadioGroupItem value={CANCELLED} id="pro-cancelled" />
                      <UserX className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <Label htmlFor="pro-cancelled" className="text-sm font-normal">
                        Отказах се от задачата
                      </Label>
                    </div>
                  </>
                )}
            </RadioGroup>
            )}

            {activePromos.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                <span>
                  По тази задача тече активна промоция:{" "}
                  {activePromos
                    .map((p) => `${PROMO_LABELS[p.type]} (${remainingLabel(p.expiresAt).toLowerCase()})`)
                    .join(", ")}
                  . При затваряне на задачата останалото време от промоцията се губи и не може да се
                  прехвърли на друга задача.
                </span>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Отказ
              </Button>
              <Button disabled={busy || !selected} onClick={() => void confirmChoice()}>
                Потвърди
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
