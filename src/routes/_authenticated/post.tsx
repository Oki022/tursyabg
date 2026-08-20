import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCreateTask, useTask } from "@/lib/tasks-api";
import {
  IMAGE_HELD_BG,
  IMAGE_REJECT_BG,
  categoryBg,
  moderationErrorBg,
} from "@/lib/moderation-messages";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { RequirePhoneNotice } from "@/components/require-phone-notice";
import { TaskForm } from "@/components/tasks/task-form";
import { contentQualityErrorBg } from "@/lib/content-quality";
import { CONTACT_MASK_WARNING, containsContactInfo, isValidBgPhone } from "@/lib/phone";

export const Route = createFileRoute("/_authenticated/post")({
  validateSearch: (search: Record<string, unknown>): { repost?: string } =>
    typeof search["repost"] === "string" && search["repost"]
      ? { repost: search["repost"] as string }
      : {},
  head: () => ({
    meta: [
      { title: "Възложи задача | ТърсяБГ" },
      { name: "description", content: "Опиши своята задача и я публикувай за минути. Получи предложения от подходящи изпълнители." },
    ],
  }),
  component: PostPage,
});

function PostPage() {
  const navigate = useNavigate();
  const createTask = useCreateTask();
  const { user } = useAuth();
  const hasPhone = Boolean(user?.phone && isValidBgPhone(user.phone));
  const { repost } = Route.useSearch();
  const source = useTask(repost ?? "");
  const initial =
    repost && source.data
      ? {
          title: source.data.title,
          category: source.data.category,
          description: source.data.description,
          budget: source.data.budget,
          location: source.data.location,
        }
      : undefined;

  if (repost && source.isLoading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 text-center text-sm text-muted-foreground">
        Зареждане на данните от предишната задача...
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Възложи задача</h1>
        <p className="mt-2 text-muted-foreground">
          Опиши какво ти трябва. Безплатно е и отнема по-малко от минута.
        </p>
      </div>

      {user && !hasPhone && (
        <RequirePhoneNotice
          className="mb-6"
          title="Липсва телефон в профила ти"
          description="За да публикуваш задача, добави телефон за контакт. Той остава скрит и се вижда само от майстор, който плати за отключване."
        />
      )}

      <TaskForm
        key={initial ? `repost-${repost}` : "new"}
        mode="create"
        {...(initial ? { initial } : {})}
        submitting={createTask.isPending}
        disabled={!hasPhone}
        submitLabel="Публикувай задачата"
        onError={(m) => toast.error(m)}
        onSubmit={async ({ values, files }) => {
          if (!hasPhone) {
            toast.error("Добави телефон в профила си, за да публикуваш задача.");
            return;
          }
          try {
            const result = await createTask.mutateAsync({ ...values, files });
            if (result.rejected.length > 0) {
              toast.error(`${result.rejected.length} снимка(и) не бяха приети`, {
                description: `${IMAGE_REJECT_BG} Причина: ${categoryBg(result.rejected[0])}.`,
              });
            }
            if (result.held > 0) {
              toast.warning("Снимки в проверка", { description: IMAGE_HELD_BG });
            }
            if (result.pending) {
              toast.warning("Задачата се проверява", {
                description:
                  "Проверяваме съдържанието, преди задачата да стане публична. Ще те уведомим, когато бъде публикувана.",
              });
            } else {
              toast.success("🎉 Задачата е публикувана успешно!", {
                description: "Скоро ще получиш първите предложения.",
              });
            }
            if (containsContactInfo(`${values.title} ${values.description}`)) {
              toast.warning("Контактите са скрити автоматично", { description: CONTACT_MASK_WARNING });
            }
            navigate({ to: "/posted/$id", params: { id: result.id } });
          } catch (err) {
            const raw = err instanceof Error ? err.message : "";
            const quality = contentQualityErrorBg(raw);
            if (quality) {
              toast.error(quality.title, { description: quality.description });
              return;
            }
            const moderation = moderationErrorBg(raw);
            if (moderation) {
              toast.error(moderation.title, { description: moderation.description });
              return;
            }
            const limitReached = raw.includes("FREE_TASK_LIMIT") || raw.includes("лимит");
            if (raw.includes("PHONE_REQUIRED")) {
              toast.error("Добави телефон в профила си, за да публикуваш задача.");
              return;
            }
            toast.error(
              limitReached ? "Достигна лимита от 5 безплатни задачи този месец." : "Задачата не беше публикувана.",
              { description: limitReached ? "Опитай отново следващия месец." : raw || undefined },
            );
          }
        }}
      />
    </div>
  );
}
