import { budgetParts, formatTaskBudget } from "@/lib/budget-range";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  MessageSquare,
  Rocket,
  ShieldCheck,
  ShieldAlert,
  Maximize2,
  ExternalLink,
} from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { findOrCreateConversation, useSendMessage, useThread } from "@/lib/messages-api";
import { getCategory } from "@/lib/mock-data";
import { formatLocation } from "@/lib/locations";

import { useMyUnlock } from "@/lib/credits-api";
import { useTask } from "@/lib/tasks-api";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { UnlockContactCard } from "@/components/credits/unlock-contact-card";
import { OwnerTaskControls } from "@/components/tasks/owner-task-controls";
import { ReportTaskDialog } from "@/components/report-task-dialog";
import { PromoteDialog } from "@/components/promotions/promote-dialog";
import { useTaskPromotions } from "@/lib/promotions-api";
import { PROMO_LABELS, remainingLabel } from "@/services/promotions";
import { TopBadge, UrgentBadge } from "@/components/promotions/promo-badges";
import { Crown, Siren, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";
import { CONTACT_MASK_WARNING, containsContactInfo, isValidBgPhone } from "@/lib/phone";
import { RequirePhoneNotice } from "@/components/require-phone-notice";
import { ShareButton } from "@/components/share-button";
import { FavouriteButton } from "@/components/favourite-button";
import { ClaimTaskButton } from "@/components/tasks/claim-task-button";
import { EngagementInbox } from "@/components/reviews/engagement-cards";
import { fetchTaskSeo } from "@/lib/seo-loaders";
import { breadcrumbLd, clampDescription, jsonLd, seo } from "@/lib/seo";
import { absoluteUrl, BRAND } from "@/lib/brand";
import { slugify } from "@/lib/geo";
import { BackLink } from "@/components/back-link";
import { TaskThumb } from "@/components/task-thumb";
import { ImageLightbox } from "@/components/image-lightbox";

/** "DD.MM в HH:MM" for the last real content edit. */
function editedLabel(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} в ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const Route = createFileRoute("/task/$id")({
  loader: ({ params }) => fetchTaskSeo(params.id),
  head: ({ params, loaderData }) => {
    const path = `/task/${params.id}`;
    if (!loaderData) {
      return seo({ title: "Задачата не е намерена", description: "Тази задача вече не е активна.", path, noindex: true });
    }
    const t = loaderData;
    const location = [t.city, t.neighborhood].filter(Boolean).join(", ");
    const cat = getCategory(t.category);
    const budget = formatTaskBudget(t.budget, t.budgetRange);
    const { meta, links } = seo({
      title: clampDescription(`${t.title}, ${location || "България"} | ${budget}`, 58),
      description: clampDescription(
        `${t.description} Бюджет: ${budget}. Локация: ${location || "България"}. Категория: ${cat.name}.`,
      ),
      path,
      image: t.image,
      type: "article",
    });
    return {
      meta,
      links,
      scripts: [
        jsonLd({
          "@context": "https://schema.org",
          "@type": "Service",
          name: t.title,
          description: t.description,
          serviceType: cat.name,
          category: cat.name,
          url: absoluteUrl(path),
          ...(t.image ? { image: t.image } : {}),
          areaServed: { "@type": "City", name: t.city ?? "България", addressCountry: "BG" },
          offers: {
            "@type": "Offer",
            ...(t.budgetRange ? {} : { price: t.budget, priceCurrency: "EUR" }),
            availability: t.status === "active" ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            validFrom: t.createdAt,
            validThrough: t.expiresAt,
            url: absoluteUrl(path),
          },
          provider: { "@type": "Organization", name: BRAND, url: absoluteUrl("/") },
        }),
        breadcrumbLd([
          { name: "Начало", path: "/" },
          { name: "Задачи", path: "/tasks" },
          ...(t.city ? [{ name: t.city, path: `/city/${slugify(t.city)}` }] : []),
          { name: t.title, path },
        ]),
      ],
    };
  },
  component: TaskDetails,
  notFoundComponent: () => (
    <div className="container mx-auto px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Задачата не е намерена</h1>
      <Button asChild className="mt-4">
        <Link to="/tasks">Назад</Link>
      </Button>
    </div>
  ),
});

function TaskDetails() {
  const { id } = Route.useParams();
  const seoTask = Route.useLoaderData();
  const { data: task, isLoading } = useTask(id);
  const { user } = useAuth();
  const [active, setActive] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const galleryButtonRef = useRef<HTMLButtonElement>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const navigate = useNavigate();
  const send = useSendMessage();
  const existingThread = useThread(conversationId);
  const previousMessages = (existingThread.data?.pages ?? []).flatMap((page) => page.items);

  const isOwner = Boolean(user && task?.userId && user.id === task.userId);
  const myUnlock = useMyUnlock(task?.id ?? "", user?.id);
  const hasPhone = Boolean(user?.phone && isValidBgPhone(user.phone));
  const [promoteOpen, setPromoteOpen] = useState(false);
  const taskPromotions = useTaskPromotions(task?.id);
  const activePromotions = taskPromotions.data ?? [];
  const hasTop = activePromotions.some((p) => p.type === "top");
  const hasUrgent = activePromotions.some((p) => p.type === "urgent");

  useEffect(() => {
    if (!messageOpen || !user || !task?.userId || user.id === task.userId) return;
    let cancelled = false;
    findOrCreateConversation(task.id, task.userId)
      .then((id) => {
        if (!cancelled) setConversationId(id);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [messageOpen, user, task?.id, task?.userId]);

  // Дясната карта следва хедъра: под него, когато е видим, и нагоре, когато се скрие.
  const headerHidden = useHideOnScroll();

  // SSR / първо зареждане: рендираме съдържанието от loader-а, за да го виждат
  // и търсачките (клиентската заявка го подменя веднага след hydration).
  if (isLoading) {
    if (!seoTask) {
      return (
        <div className="container mx-auto max-w-6xl px-4 py-10">
          <div className="h-[320px] w-full animate-pulse rounded-3xl bg-muted sm:h-[420px]" />
          <div className="mt-6 h-8 w-2/3 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-4 w-full animate-pulse rounded bg-muted" />
        </div>
      );
    }
    const seoLocation = [seoTask.city, seoTask.neighborhood].filter(Boolean).join(", ");
    return (
      <div className="container mx-auto max-w-6xl px-4 py-10">
        {seoTask.image && (
          <img
            src={seoTask.image}
            alt={`${seoTask.title}, ${getCategory(seoTask.category).name}`}
            width={1400}
            height={933}
            fetchPriority="high"
            className="aspect-[3/2] w-full rounded-3xl object-cover"
          />
        )}
        <h1 className="mt-6 break-words text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {seoTask.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {getCategory(seoTask.category).name}
          {seoLocation ? ` · ${seoLocation}` : ""} · {formatTaskBudget(seoTask.budget, seoTask.budgetRange)}
        </p>
        <h2 className="mt-8 text-lg font-semibold text-foreground">Описание</h2>
        <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed text-foreground/90">
          {seoTask.description}
        </p>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Задачата не е намерена</h1>
        <Button asChild className="mt-4">
          <Link to="/tasks">Назад</Link>
        </Button>
      </div>
    );
  }

  const cat = getCategory(task.category);
  const Icon = cat.icon;
  const images = task.gallery ?? [];

  const userBlock = (
    <>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Потребител
      </div>
      <div className="mt-3 flex items-center gap-3">
        <UserAvatar userId={task.userId} name={task.author} className="h-12 w-12" iconStrokeWidth={0.75} />
        <div className="min-w-0">
          {task.userId ? (
            <Link
              to="/user/$id"
              params={{ id: task.userId }}
              className="block truncate text-sm font-semibold text-foreground hover:underline"
            >
              {task.author}
            </Link>
          ) : (
            <div className="truncate text-sm font-semibold text-foreground">{task.author}</div>
          )}
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" /> Член от 2026 г.
          </div>
        </div>
      </div>
    </>
  );

  // Само община/квартал, без точен адрес. Отваря Google Maps в нов раздел:
  // без API ключ, без вграден iframe и без данни към Google, докато потребителят не кликне.
  const locationText = formatLocation(task.location);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${locationText.replace(/^общ\.\s*/, "Община ")}, България`,
  )}`;

  const locationBlock = (
    <>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Локация
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Виж ${locationText} в Google Maps`}
        className="group relative mt-3 block h-32 overflow-hidden rounded-2xl bg-secondary ring-1 ring-border transition hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {/* Стилизирана карта; цветовете идват от темата, затова работи и в светъл, и в тъмен режим. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 400 160"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
        >
          <g className="text-foreground" fill="currentColor" opacity="0.05">
            <rect x="10" y="10" width="72" height="46" rx="6" />
            <rect x="16" y="86" width="58" height="58" rx="6" />
            <rect x="118" y="8" width="62" height="40" rx="6" />
            <rect x="122" y="112" width="60" height="40" rx="6" />
            <rect x="214" y="100" width="64" height="48" rx="6" />
            <rect x="306" y="10" width="80" height="40" rx="6" />
            <rect x="314" y="84" width="74" height="62" rx="6" />
          </g>
          <ellipse cx="262" cy="36" rx="34" ry="20" fill="#22c55e" opacity="0.18" />
          <path
            d="M-10 132 C 60 112, 110 152, 180 130 S 300 102, 410 120"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="10"
            strokeLinecap="round"
            opacity="0.35"
          />
          <g className="text-foreground" fill="none" stroke="currentColor" strokeLinecap="round">
            <path d="M-10 72 L 410 64" strokeWidth="8" opacity="0.16" />
            <path d="M100 -10 L 108 170" strokeWidth="6" opacity="0.13" />
            <path d="M292 -10 C 282 60, 302 110, 288 170" strokeWidth="6" opacity="0.13" />
            <path d="M-10 32 L 180 36" strokeWidth="3" opacity="0.1" />
            <path d="M200 104 L 410 100" strokeWidth="3" opacity="0.1" />
            <path d="M30 170 L 58 72" strokeWidth="3" opacity="0.1" />
            <path d="M186 -10 L 194 64" strokeWidth="3" opacity="0.1" />
          </g>
          <g className="text-primary" fill="currentColor" stroke="currentColor">
            <circle cx="200" cy="80" r="48" opacity="0.1" stroke="none" />
            <circle cx="200" cy="80" r="48" fill="none" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.4" />
          </g>
        </svg>

        <div className="absolute inset-0 grid place-items-center">
          <div className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-md ring-1 ring-border transition-transform group-hover:scale-105">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground">
              <MapPin className="h-3.5 w-3.5" />
            </span>
            {locationText}
          </div>
        </div>

        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border transition-colors group-hover:text-foreground">
          Google Maps <ExternalLink className="h-3 w-3" />
        </span>
      </a>
    </>
  );

  const prev = () => setActive((index) => (index - 1 + images.length) % images.length);
  const next = () => setActive((index) => (index + 1) % images.length);

  const openMessageModal = () => {
    if (!user) {
      void navigate({ to: "/auth", search: { redirect: `/task/${task.id}` } });
      return;
    }
    setMessageOpen(true);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      toast.error("Моля въведете съобщение");
      return;
    }
    if (!user || !task.userId) return;
    if (!hasPhone) {
      toast.error("Добави телефон в профила си, за да пишеш съобщения.");
      return;
    }
    setSending(true);
    try {
      const convId = conversationId ?? (await findOrCreateConversation(task.id, task.userId));
      setConversationId(convId);
      await send.mutateAsync({
        conversationId: convId,
        receiverId: task.userId,
        taskId: task.id,
        content: messageText,
      });
      setMessageOpen(false);
      setMessageText("");
      toast.success("✅ Съобщението е изпратено успешно!", {
        description: "Виж разговора в Съобщения.",
        action: { label: "Отвори", onClick: () => void navigate({ to: "/messages" }) },
      });
      if (containsContactInfo(messageText)) {
        toast.warning("Контактите са скрити автоматично", { description: CONTACT_MASK_WARNING });
      }
    } catch {
      toast.error("Съобщението не беше изпратено.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 md:py-10">
      <BackLink className="mb-5" />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.8fr)]">
        <div className="min-w-0">
          <div className="group relative overflow-hidden rounded-3xl bg-muted shadow-xl shadow-primary/10 ring-1 ring-border/60">
            <div className="relative h-[320px] w-full sm:h-[420px] lg:h-[520px]">
              {images.length === 0 && (
                <TaskThumb
                  title={task.title}
                  category={task.category}
                  iconClassName="h-16 w-16"
                  className="absolute inset-0 h-full w-full"
                />
              )}
              {images.map((src, index) => (
                <img
                  key={src}
                  src={src}
                  alt={`${task.title}, снимка ${index + 1}`}
                  loading={index === 0 ? "eager" : "lazy"}
                  {...(index === 0 ? { fetchPriority: "high" as const } : {})}
                  decoding={index === 0 ? "sync" : "async"}
                  width={1400}
                  height={933}
                  className={`absolute inset-0 mx-auto h-full w-full object-contain transition-opacity duration-300 ${index === active ? "opacity-100" : "opacity-0"}`}
                />
              ))}
              {images.length > 0 && (
                <button
                  type="button"
                  ref={galleryButtonRef}
                  onClick={() => setLightboxOpen(true)}
                  aria-label={`Отвори снимка ${active + 1} на цял екран`}
                  className="absolute inset-0 z-0 cursor-zoom-in transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <span className="pointer-events-none absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-slate-900/60 text-white opacity-0 backdrop-blur transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none">
                    <Maximize2 className="h-4 w-4" aria-hidden="true" />
                  </span>
                </button>
              )}

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prev}
                    className="absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-background/95 text-foreground shadow-lg backdrop-blur transition hover:scale-105"
                    aria-label="Предишна снимка"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    className="absolute right-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-background/95 text-foreground shadow-lg backdrop-blur transition hover:scale-105"
                    aria-label="Следваща снимка"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-slate-900/50 px-3 py-2 backdrop-blur">
                    {images.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setActive(index)}
                        aria-label={`Снимка ${index + 1}`}
                        className={`h-1.5 rounded-full transition-all ${index === active ? "w-7 bg-white" : "w-1.5 bg-white/60 hover:bg-white"}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
              <Icon className="h-3.5 w-3.5" /> {cat.name}
            </Badge>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> {task.postedAt}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {formatLocation(task.location)}
            </span>
            {task.contentEditedAt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
                Редактирано: {editedLabel(task.contentEditedAt)}
              </span>
            )}
          </div>

          {isOwner && task.adminHiddenAt && (
            <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Задачата е скрита от администратор и не се показва публично. Не може да бъде активирана
              или публикувана отново. Ако смяташ, че има грешка, пиши ни през страницата Контакти.
            </p>
          )}

          {(hasTop || hasUrgent) && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {hasUrgent && <UrgentBadge className="px-3 py-1 text-[11px]" />}
              {hasTop && <TopBadge className="px-3 py-1 text-[11px]" />}
            </div>
          )}

          <div className="mt-4 flex items-start justify-between gap-3">
            <h1 className="break-words text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              {task.title}
            </h1>
            <div className="mt-1 flex shrink-0 items-center gap-2">
              <FavouriteButton
                taskId={task.id}
                ownerId={task.userId}
                size="md"
                className="border border-border/60"
              />
              <ShareButton path={`/task/${task.id}`} title={task.title} />
            </div>
          </div>

          <section className="mt-8 rounded-3xl border border-border/60 bg-card p-6 shadow-sm md:p-7">
            <h2 className="text-lg font-semibold text-foreground">Описание</h2>
            <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed text-foreground/90">
              {task.description}
            </p>
          </section>

          {/* На десктоп потребителят и локацията са в основната колона, за да остане
              дясната карта къса и да се побира на екрана. На мобилен са в картата. */}
          <section className="mt-8 hidden gap-8 rounded-3xl border border-border/60 bg-card p-6 shadow-sm md:p-7 lg:grid lg:grid-cols-2">
            <div className="min-w-0">{userBlock}</div>
            <div className="min-w-0">{locationBlock}</div>
          </section>
        </div>

        <aside
          className={`transition-[top] duration-300 lg:sticky lg:self-start ${
            headerHidden ? "lg:top-4" : "lg:top-24"
          }`}
        >
          <div className="rounded-3xl bg-card p-6 shadow-2xl shadow-primary/15 ring-1 ring-border/60">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Бюджет
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className={`font-bold text-foreground ${task.budgetRange ? "text-3xl" : "text-4xl"}`}>
                {budgetParts(task.budget, task.budgetRange).main}
              </div>
              {!task.budgetRange && (
                <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
                  Фиксиран
                </span>
              )}
            </div>
            {budgetParts(task.budget, task.budgetRange).hint && (
              <div className="mt-1 text-sm text-muted-foreground">
                {budgetParts(task.budget, task.budgetRange).hint}
              </div>
            )}

            <div className="mt-6 space-y-3">
              {isOwner && (
                <>
                  <Button size="lg" className="w-full gap-2" onClick={() => setPromoteOpen(true)}>
                    <Rocket className="h-4 w-4" />
                    {activePromotions.length > 0 ? "Управлявай промоциите" : "Промотирай"}
                  </Button>
                  {activePromotions.length > 0 && (
                    <div className="space-y-1.5 rounded-2xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                      {activePromotions.map((p) => {
                        const PromoIcon =
                          p.type === "top" ? Crown : p.type === "urgent" ? Siren : ArrowUpCircle;
                        return (
                          <div key={p.id} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <PromoIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="font-semibold text-foreground">{PROMO_LABELS[p.type]}</span>
                            <span> {remainingLabel(p.expiresAt)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
              {!isOwner && (
                <UnlockContactCard
                  taskId={task.id}
                  ownerId={task.userId}
                  budget={task.budget}
                  unlockCost={task.unlockCost}
                  unlockCount={task.unlockCount}
                  maxUnlocks={task.maxUnlocks}
                  taskStatus={task.status}
                />
              )}
              {isOwner && <OwnerTaskControls task={task} redirectAfterDelete="profile" />}
              {!isOwner && myUnlock.data && (
                <Button size="lg" className="w-full gap-2" onClick={openMessageModal}>
                  <MessageSquare className="h-4 w-4" /> Изпрати съобщение
                </Button>
              )}
              {!isOwner && user && task.status === "active" && (
                <ClaimTaskButton taskId={task.id} size="lg" />
              )}
            </div>

            <div className="mt-4">
              <EngagementInbox taskId={task.id} />
            </div>

            <div className="mt-5 flex items-center gap-1.5 rounded-2xl bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Безопасно общуване през платформата.
            </div>

            {!isOwner && (
              <div className="mt-3">
                <ReportTaskDialog taskId={task.id} />
              </div>
            )}

            {isOwner && (
              <PromoteDialog taskId={task.id} open={promoteOpen} onOpenChange={setPromoteOpen} />
            )}

            <div className="lg:hidden">
              <div className="mt-6 border-t border-border/60 pt-5">{userBlock}</div>
              <div className="mt-6 border-t border-border/60 pt-5">{locationBlock}</div>
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">
              Изпрати съобщение до {task.author}
            </DialogTitle>
            <DialogDescription>
              Започнете разговор относно тази задача.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3 ring-1 ring-border/60">
            <TaskThumb
              src={task.gallery?.[0]}
              category={task.category}
              title={task.title}
              iconClassName="h-5 w-5"
              className="h-12 w-12 shrink-0 rounded-lg"
            />
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Задача
              </div>
              <div className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">
                {task.title}
              </div>
            </div>
          </div>

          {previousMessages.length > 0 && (
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl bg-muted/60 p-3 ring-1 ring-border/60">
              {previousMessages.map((m) => (
                <div key={m.id} className={`flex ${m.senderId === user?.id ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm ${
                      m.senderId === user?.id
                        ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white"
                        : "bg-card text-foreground ring-1 ring-border/60"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          )}

          {user && !hasPhone && (
            <RequirePhoneNotice
              title="Добави телефон, за да пишеш съобщения"
              description="Телефонът остава скрит и се вижда само след платено отключване."
            />
          )}

          <Textarea
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            placeholder="Напишете вашето съобщение тук..."
            rows={6}
            disabled={!hasPhone}
            className="resize-none disabled:opacity-60"
          />

          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <p className="leading-relaxed">
              <span className="font-semibold">За вашата сигурност</span>, общувайте и плащайте само през платформата.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setMessageOpen(false)}
              className="sm:flex-1"
            >
              Отказ
            </Button>
            <Button onClick={handleSendMessage} disabled={sending || !hasPhone} className="sm:flex-1 gap-2">
              <MessageSquare className="h-4 w-4" /> Изпрати
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {lightboxOpen && images.length > 0 && (
        <ImageLightbox
          images={images}
          index={active}
          onIndexChange={setActive}
          title={task.title}
          onClose={() => {
            setLightboxOpen(false);
            galleryButtonRef.current?.focus();
          }}
        />
      )}

    </div>
  );
}