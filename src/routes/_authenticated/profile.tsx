import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Mail,
  Phone,
  LogOut,
  ClipboardList,
  Wallet,
  ShieldCheck,
  Bell,
  ChevronRight,
  KeyRound,
  Eye,
  MapPin,
  Pencil,
  Rocket,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/back-link";
import { UserAvatar } from "@/components/user-avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TaskCard } from "@/components/task-card";
import { useAuth, getInitials } from "@/lib/auth";
import { categories, type TaskStatus } from "@/lib/mock-data";
import { useMyTasks } from "@/lib/tasks-api";
import { useOwnerPromotions } from "@/lib/promotions-api";
import { PROMO_LABELS, remainingLabel, type TaskPromotion } from "@/services/promotions";
import { PromoteDialog } from "@/components/promotions/promote-dialog";
import { PromotedBadge, TopBadge, UrgentBadge } from "@/components/promotions/promo-badges";
import { OwnerTaskControls } from "@/components/tasks/owner-task-controls";
import { DeleteTaskDialog } from "@/components/tasks/delete-task-dialog";
import { CreditBalanceCard } from "@/components/credits/credit-balance-card";
import { useFavouritesCount } from "@/lib/favourites-api";
import { useMySkills } from "@/lib/skills-api";
import { usePublicProfile } from "@/lib/reviews-api";
import { RatingInline } from "@/components/reviews/stars";
import { buildLocation, formatLocation } from "@/lib/locations";
import { EngagementInbox } from "@/components/reviews/engagement-cards";

import type { Task } from "@/lib/mock-data";
import { toast } from "sonner";

type TaskTabValue = "active" | "pending" | "archive";

const ARCHIVE_AFTER_MS = 90 * 24 * 60 * 60 * 1000;

/** Inactive or assigned tasks older than 3 months get the archived badge. */
function isArchived(task: Task): boolean {
  if (task.status !== "inactive" && task.status !== "assigned") return false;
  const iso = task.statusChangedAtIso ?? task.createdAtIso;
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() > ARCHIVE_AFTER_MS;
}

/** UI grouping only — the underlying status values stay intact. */
function tabForStatus(status: TaskStatus | undefined): TaskTabValue {
  if (status === "pending" || status === "pending_payment") return "pending";
  if (status === "inactive" || status === "assigned") return "archive";
  return "active";
}

const TASK_TABS: { value: TaskTabValue; label: string; empty: string }[] = [
  { value: "active", label: "Активни", empty: "Нямаш активни задачи в момента." },
  { value: "pending", label: "Изчакващи", empty: "Нямаш задачи, чакащи одобрение или плащане." },
  { value: "archive", label: "Архив", empty: "Нямаш неактивни или възложени задачи." },
];

const SETTINGS_ITEMS: { icon: typeof Wallet; label: string; to: string }[] = [
  { icon: ShieldCheck, label: "Влизане и сигурност", to: "/settings/security" },
  { icon: Wallet, label: "Баланс и плащания", to: "/settings/billing" },
  { icon: KeyRound, label: "Отключени задачи", to: "/unlocked" },
  { icon: Bell, label: "Нотификации", to: "/settings/notifications" },
];

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, logout } = useAuth();
  const { data: tasks = [] } = useMyTasks(user?.id);
  const { data: promotions = {} } = useOwnerPromotions(user?.id);
  const [promoteTaskId, setPromoteTaskId] = useState<string | null>(null);
  const navigate = useNavigate();
  const [tab, setTab] = useState<TaskTabValue>("active");
  const favouritesCount = useFavouritesCount();
  const mySkills = useMySkills(user?.id);
  const publicProfile = usePublicProfile(user?.id);
  const profileCity = user?.city ?? publicProfile.data?.city ?? null;
  const profileNeighborhood = user?.neighborhood ?? publicProfile.data?.neighborhood ?? null;
  const locationLabel = profileCity
    ? formatLocation(buildLocation(profileCity, profileNeighborhood))
    : "";
  const overallCount =
    (publicProfile.data?.reviewCountAsPro ?? 0) + (publicProfile.data?.reviewCountAsClient ?? 0);
  const overallRating =
    overallCount > 0
      ? ((publicProfile.data?.ratingAsPro ?? 0) * (publicProfile.data?.reviewCountAsPro ?? 0) +
          (publicProfile.data?.ratingAsClient ?? 0) * (publicProfile.data?.reviewCountAsClient ?? 0)) /
        overallCount
      : null;


  const byStatus = useMemo(() => {
    const map: Record<TaskTabValue, typeof tasks> = {
      active: [],
      pending: [],
      archive: [],
    };
    if (!user) return map;
    for (const t of tasks) {
      if (t.userId !== user.id) continue;
      map[tabForStatus(t.status)].push(t);
    }
    return map;
  }, [tasks, user]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-sm text-muted-foreground">
        Зареждане...
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    toast.success("Излязохте от профила си.");
    navigate({ to: "/" });
  };


  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 md:py-12">
      <BackLink className="mb-4" />
      {/* Header card */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <UserAvatar userId={user.id} name={user.name} src={user.avatarUrl} className="h-16 w-16 md:h-20 md:w-20" textClassName="text-lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
                  {user.name}
                </h1>
              </div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {locationLabel && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{locationLabel}</span>
                  </span>
                )}
                <RatingInline
                  rating={overallRating}
                  count={overallCount}
                />
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Възлагай задачи и отключвай контакти без ограничения.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/settings/security">
              <Pencil className="h-4 w-4" /> Редактирай профила
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="gap-1.5 px-2">
            <Link to="/user/$id" params={{ id: user.id }}>
              <Eye className="h-4 w-4" /> Виж публичния ми профил и отзиви
            </Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <InfoRow icon={<Mail className="h-4 w-4" />} label="Имейл" value={user.email} />
          <InfoRow
            icon={<Phone className="h-4 w-4" />}
            label="Телефон"
            value={user.phone || "Не е въведен"}
          />
        </div>

        {/* Моите умения, част от профила */}
        <div className="mt-5 min-w-0 rounded-xl border border-border bg-background p-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Моите умения</h2>
          </div>
          {mySkills.isLoading ? (
            <div className="mt-3 h-7 animate-pulse rounded-lg bg-muted" />
          ) : (mySkills.data?.categories.length ?? 0) + (mySkills.data?.tags.length ?? 0) === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Все още нямаш умения. Добави категории или свои етикети, за да те намират по-лесно.
            </p>
          ) : (
            <div className="mt-3 flex min-w-0 flex-wrap gap-1.5">
              {(mySkills.data?.categories ?? []).map((id) => (
                <span
                  key={id}
                  className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {categories.find((c) => c.id === id)?.name ?? id}
                </span>
              ))}
              {(mySkills.data?.tags ?? []).map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>


      {/* Кредити */}
      <CreditBalanceCard className="mt-4" />

      {/* Role-specific sections */}
      <div className="mt-6 grid gap-6">
        <EngagementInbox />

        {/* Твоите задачи */}
        <section className="min-w-0 rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Твоите задачи</h2>
            <Button asChild size="sm" variant="outline">
              <Link to="/post">Възложи нова</Link>
            </Button>
          </div>
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as TaskTabValue)}
            className="mt-4"
          >
            <TabsList className="flex h-auto w-full max-w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {TASK_TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs md:text-sm"
                >
                  {t.label} ({byStatus[t.value].length})
                </TabsTrigger>
              ))}
            </TabsList>
            {TASK_TABS.map((t) => (
              <TabsContent key={t.value} value={t.value} className="mt-4">
                {byStatus[t.value].length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {byStatus[t.value].map((task) => (
                      <OwnerTaskCard
                        key={task.id}
                        task={task}
                        archived={isArchived(task)}
                        repostable={t.value === "archive"}
                        promotions={promotions[task.id] ?? []}
                        onPromote={() => setPromoteTaskId(task.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                    <ClipboardList className="mx-auto mb-2 h-6 w-6 opacity-60" />
                    {t.empty}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
          {promoteTaskId && (
            <PromoteDialog
              taskId={promoteTaskId}
              open={Boolean(promoteTaskId)}
              onOpenChange={(open) => !open && setPromoteTaskId(null)}
            />
          )}
        </section>

        {/* Настройки */}
        <section className="min-w-0 rounded-2xl border border-border/60 bg-card p-5 shadow-sm md:p-7">
          <h2 className="text-lg font-semibold text-foreground">Настройки</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {SETTINGS_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-3 transition-colors hover:bg-accent/40"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                  {item.to === "/favourites" && (favouritesCount.data ?? 0) > 0 && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {favouritesCount.data}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </section>



        <div className="pb-2 pt-2 text-center">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-destructive hover:underline"
          >
            <LogOut className="h-4 w-4" />
            Изход
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

/** Owner view of a task: promo state, views and a promote shortcut. */
function OwnerTaskCard({
  task,
  promotions,
  onPromote,
  archived = false,
  repostable = false,
}: {
  task: Task;
  promotions: TaskPromotion[];
  onPromote: () => void;
  archived?: boolean;
  repostable?: boolean;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <TaskCard task={{ ...task, isTop: promotions.some((p) => p.type === "top"), isUrgent: promotions.some((p) => p.type === "urgent") }} />
      <div className="min-w-0 rounded-xl border border-border/60 bg-card p-2 text-[11px]">
        {archived && (
          <p className="mb-1 rounded-full bg-muted px-2 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Архивирана
          </p>
        )}
        {promotions.length > 0 && <PromotedBadge className="mb-1" />}
        <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
          <Eye className="h-3 w-3 shrink-0" />
          <span className="break-words">{task.viewCount ?? 0} преглеждания</span>
        </div>
        {promotions.length > 0 ? (
          <div className="mt-1.5 flex flex-col gap-1">
            {promotions.map((p) => (
              <div key={p.id} className="flex min-w-0 flex-wrap items-center gap-1">
                {p.type === "top" ? (
                  <TopBadge />
                ) : p.type === "urgent" ? (
                  <UrgentBadge />
                ) : (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-foreground">
                    {PROMO_LABELS[p.type]}
                  </span>
                )}
                <span className="break-words text-muted-foreground">
                  {remainingLabel(p.expiresAt).replace("Активна още ", "")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-muted-foreground">Няма активни промоции.</p>
        )}
        {!archived && (
          <Button size="sm" variant="outline" className="mt-2 h-7 w-full gap-1 text-[11px]" onClick={onPromote}>
            <Rocket className="h-3 w-3" />
            {promotions.length > 0 ? "Управлявай" : "Промотирай"}
          </Button>
        )}
        {repostable && (
          <>
            <Button asChild size="sm" variant="outline" className="mt-2 h-7 w-full gap-1 text-[11px]">
              <Link to="/post" search={{ repost: task.id }}>
                <RotateCcw className="h-3 w-3" />
                Публикувай отново
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="mt-1 h-7 w-full gap-1 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3 w-3" />
              Изтрий
            </Button>
            <DeleteTaskDialog taskId={task.id} open={deleteOpen} onOpenChange={setDeleteOpen} />
          </>
        )}
        {(task.status === "active" || task.status === "assigned") && (
          <div className="mt-2">
            <OwnerTaskControls task={task} compact />
          </div>
        )}
        {task.status === "pending" && (
          <div className="mt-2 space-y-1.5 rounded-xl bg-amber-50 p-2 text-[11px] leading-snug text-amber-900">
            <p className="font-medium">В проверка</p>
            <p>Задачата ще стане публична след проверката. Ще получиш известие.</p>
            <Button asChild size="sm" variant="outline" className="h-auto w-full py-1.5 text-[11px]">
              <Link to="/task/$id/edit" params={{ id: task.id }}>
                Редактирай задачата
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
