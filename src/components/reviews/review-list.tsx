import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/auth";
import { getCategory } from "@/lib/mock-data";
import { formatReviewDate, REVIEWS_PAGE_SIZE, type PublicReview } from "@/services/reviews";
import { ReportReviewDialog } from "@/components/reviews/report-review-dialog";
import { ProfileLink, Stars } from "@/components/reviews/stars";

export function ReviewList({
  reviews,
  isLoading,
  page,
  onPage,
  emptyText,
}: {
  reviews: PublicReview[];
  isLoading: boolean;
  page: number;
  onPage: (p: number) => void;
  emptyText: string;
}) {
  if (isLoading) {
    return <div className="h-28 animate-pulse rounded-2xl bg-muted" />;
  }
  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }
  return (
    <div className="min-w-0 space-y-3">
      {reviews.map((r) => {
        const cat = getCategory(r.category);
        return (
          <article
            key={r.id}
            className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
          >
            <div className="flex min-w-0 items-start gap-3">
              <Avatar className="h-9 w-9 shrink-0 border border-border">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {getInitials(r.reviewerName ?? "Потребител")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <ProfileLink
                    userId={r.reviewerId}
                    className="truncate text-sm font-semibold text-foreground hover:underline"
                  >
                    {r.reviewerName ?? "Потребител"}
                  </ProfileLink>
                  <Stars value={r.rating} />
                  <span className="text-[11px] text-muted-foreground">{formatReviewDate(r.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-foreground/90">
                  {r.comment}
                </p>
                <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <Badge variant="secondary" className="rounded-full text-[10px]">
                    {cat.name}
                  </Badge>
                  <ReportReviewDialog reviewId={r.id} />
                </div>
              </div>
            </div>
          </article>
        );
      })}

      {(page > 0 || reviews.length === REVIEWS_PAGE_SIZE) && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
            Назад
          </Button>
          <span className="text-xs text-muted-foreground">Стр. {page + 1}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={reviews.length < REVIEWS_PAGE_SIZE}
            onClick={() => onPage(page + 1)}
          >
            Напред
          </Button>
        </div>
      )}
    </div>
  );
}