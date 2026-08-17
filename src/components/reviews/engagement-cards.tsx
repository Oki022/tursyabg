import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, HandshakeIcon, Star, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useMyEngagements, useRespondEngagement } from "@/lib/reviews-api";
import { daysLeft, reviewErrorBg, type Engagement } from "@/services/reviews";

/** Client-side prompt: "[Име] твърди, че е свършил тази задача. Вярно ли е?" */
export function ConfirmClaimCard({ engagement }: { engagement: Engagement }) {
  const respond = useRespondEngagement();

  const run = async (confirm: boolean) => {
    try {
      await respond.mutateAsync({ engagementId: engagement.id, confirm });
      toast.success(
        confirm ? "Потвърдено! Вече можете да си оставите отзиви." : "Отбелязахме, че не е така.",
      );
    } catch (e) {
      toast.error(reviewErrorBg(e));
    }
  };

  return (
    <div className="min-w-0 rounded-2xl border border-primary/40 bg-primary/[0.04] p-4">
      <p className="flex items-start gap-2 break-words text-sm font-medium text-foreground">
        <HandshakeIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          {engagement.professionalName ?? "Изпълнител"} твърди, че е свършил „{engagement.taskTitle}“.
          Вярно ли е?
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" className="gap-1.5" disabled={respond.isPending} onClick={() => void run(true)}>
          <CheckCircle2 className="h-4 w-4" /> Да, потвърждавам
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={respond.isPending}
          onClick={() => void run(false)}
        >
          <XCircle className="h-4 w-4" /> Не, не е така
        </Button>
      </div>
    </div>
  );
}

/** Persistent "write your review" card shown until submitted or expired. */
export function PendingReviewCard({ engagement, isClient }: { engagement: Engagement; isClient: boolean }) {
  const left = daysLeft(engagement.reviewDeadline);
  const other = isClient ? engagement.professionalName : engagement.clientName;
  return (
    <div className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <p className="flex items-start gap-2 break-words text-sm font-medium text-foreground">
        <Star className="mt-0.5 h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
        <span>
          Остави отзив за {other ?? "потребителя"} по „{engagement.taskTitle}“.
        </span>
      </p>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" /> Остават {left === 1 ? "1 ден" : `${left} дни`}
      </p>
      <Button asChild size="sm" className="mt-3 w-full sm:w-auto">
        <Link to="/review/$engagementId" params={{ engagementId: engagement.id }}>
          Напиши отзив
        </Link>
      </Button>
    </div>
  );
}

/** Everything awaiting the current user: claims to confirm + reviews to write. */
export function EngagementInbox({ taskId }: { taskId?: string }) {
  const { user } = useAuth();
  const { data: engagements = [] } = useMyEngagements(Boolean(user));
  if (!user) return null;

  const scoped = taskId ? engagements.filter((e) => e.taskId === taskId) : engagements;
  const claims = scoped.filter((e) => e.status === "claimed" && e.clientId === user.id);
  const pending = scoped.filter(
    (e) =>
      e.status === "confirmed" &&
      !e.myReviewId &&
      daysLeft(e.reviewDeadline) > 0 &&
      (e.clientId === user.id || e.professionalId === user.id),
  );

  if (claims.length === 0 && pending.length === 0) return null;

  return (
    <div className="min-w-0 space-y-3">
      {claims.map((e) => (
        <ConfirmClaimCard key={e.id} engagement={e} />
      ))}
      {pending.map((e) => (
        <PendingReviewCard key={e.id} engagement={e} isClient={e.clientId === user.id} />
      ))}
    </div>
  );
}