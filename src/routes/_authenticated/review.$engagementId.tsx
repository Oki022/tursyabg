import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useMyEngagements, useSubmitReview } from "@/lib/reviews-api";
import { StarSelector } from "@/components/reviews/stars";
import {
  DOUBLE_BLIND_NOTE,
  REVIEW_HEADING,
  REVIEW_PLACEHOLDER,
  daysLeft,
  reviewErrorBg,
  type ReviewDirection,
} from "@/services/reviews";

export const Route = createFileRoute("/_authenticated/review/$engagementId")({
  head: () => ({
    meta: [
      { title: "Остави отзив | ТърсяБГ" },
      { name: "description", content: "Оцени съвместната работа с 1 до 5 звезди и кратък коментар." },
      { property: "og:title", content: "Остави отзив | ТърсяБГ" },
      { property: "og:description", content: "Двустранни отзиви след потвърдена работа." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReviewPage,
});

const MAX = 1000;

function ReviewPage() {
  const { engagementId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: engagements = [], isLoading } = useMyEngagements(Boolean(user));
  const submit = useSubmitReview();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const engagement = useMemo(
    () => engagements.find((e) => e.id === engagementId),
    [engagements, engagementId],
  );

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-10">
        <div className="h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  if (!engagement) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="text-xl font-semibold">Не намерихме тази работа</h1>
        <Button asChild className="mt-4">
          <Link to="/profile">Към профила</Link>
        </Button>
      </div>
    );
  }

  const direction: ReviewDirection =
    user?.id === engagement.clientId ? "client_to_pro" : "pro_to_client";
  const counterpart =
    direction === "client_to_pro" ? engagement.professionalName : engagement.clientName;
  const left = daysLeft(engagement.reviewDeadline);
  const done = Boolean(engagement.myReviewId);
  const tooShort = comment.trim().length < 10;

  const handleSubmit = async () => {
    if (rating < 1) {
      toast.error("Избери оценка от 1 до 5 звезди.");
      return;
    }
    if (tooShort) {
      toast.error("Коментарът трябва да е поне 10 символа.");
      return;
    }
    try {
      const res = await submit.mutateAsync({ engagementId, rating, comment: comment.trim() });
      toast.success(
        res["revealed"]
          ? "Отзивът е публикуван, и двата отзива вече са видими."
          : "Благодарим! Отзивът ти е записан и ще стане видим, когато и другата страна напише своя.",
      );
      void navigate({ to: "/profile" });
    } catch (e) {
      toast.error(reviewErrorBg(e));
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8 md:py-12">
      <BackLink className="mb-4" />

      <div className="min-w-0 rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-7">
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">{REVIEW_HEADING[direction]}</h1>
        <p className="mt-1 break-words text-sm text-muted-foreground">
          {counterpart ?? "Потребител"}, задача „{engagement.taskTitle}“
        </p>

        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-secondary/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>{DOUBLE_BLIND_NOTE}</span>
        </div>

        {done ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            Вече остави отзив за тази работа. Той ще стане видим, когато и другата страна напише своя
            или след изтичане на срока.
          </div>
        ) : (
          <>
            <div className="mt-6">
              <p className="text-sm font-semibold text-foreground">Оценка</p>
              <div className="mt-2">
                <StarSelector value={rating} onChange={setRating} />
              </div>
            </div>

            <div className="mt-6 min-w-0">
              <p className="text-sm font-semibold text-foreground">Коментар</p>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, MAX))}
                placeholder={REVIEW_PLACEHOLDER[direction]}
                rows={6}
                className="mt-2 w-full min-w-0 resize-none"
              />
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{tooShort ? "Минимум 10 символа" : "Готово"}</span>
                <span>
                  {comment.length} / {MAX}
                </span>
              </div>
            </div>

            <Button
              size="lg"
              className="mt-5 w-full"
              disabled={submit.isPending}
              onClick={() => void handleSubmit()}
            >
              Изпрати отзив
            </Button>
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
              Отзивите са постоянни и не могат да се редактират. Остават{" "}
              {left === 1 ? "1 ден" : `${left} дни`} до края на срока.
            </p>
          </>
        )}
      </div>
    </div>
  );
}