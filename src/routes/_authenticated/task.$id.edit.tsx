import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TaskForm } from "@/components/tasks/task-form";
import { useAuth } from "@/lib/auth";
import { useDeletePreview, useTask, useTaskImages, useUpdateTask } from "@/lib/tasks-api";
import { IMAGE_HELD_BG, IMAGE_REJECT_BG, categoryBg } from "@/lib/moderation-messages";
import { toastError } from "@/lib/toast-error";
import { CONTACT_MASK_WARNING, containsContactInfo } from "@/lib/phone";


export const Route = createFileRoute("/_authenticated/task/$id/edit")({
  head: () => ({
    meta: [
      { title: "Редакция на задача | ТърсяБГ" },
      { name: "description", content: "Обнови описанието, бюджета, снимките и локацията на своята задача." },
      { property: "og:title", content: "Редакция на задача | ТърсяБГ" },
      { property: "og:description", content: "Обнови детайлите по своята задача в ТърсяБГ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditTaskPage,
});

function EditTaskPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: task, isLoading } = useTask(id);
  const { data: images = [], isLoading: imagesLoading } = useTaskImages(id);
  const { data: preview } = useDeletePreview(id, Boolean(task && user && task.userId === user.id));
  const update = useUpdateTask();

  if (isLoading || imagesLoading) {
    return (
      <div className="container mx-auto flex max-w-3xl items-center justify-center px-4 py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task || (user && task.userId !== user.id)) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Нямаш достъп до тази задача</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Само авторът на задачата може да я редактира.
        </p>
        <Button asChild className="mt-6">
          <Link to="/profile">Към моите задачи</Link>
        </Button>
      </div>
    );
  }

  const hasUnlockers = (preview?.unlockers ?? task.unlockCount ?? 0) > 0;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 md:py-12">
      <Link
        to="/task/$id"
        params={{ id }}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Обратно към задачата
      </Link>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Редактирай задачата</h1>
        <p className="mt-2 text-muted-foreground">
          Промените минават през същата проверка за съдържание като нова задача.
        </p>
      </div>

      <TaskForm
        mode="edit"
        initial={{
          title: task.title,
          category: task.category,
          description: task.description,
          budget: task.budget,
          location: task.location,
        }}
        existingImages={images.map((i) => ({ id: i.id, url: i.url }))}
        {...(hasUnlockers ? { minBudget: task.budget } : {})}
        submitting={update.isPending}
        submitLabel="Запази промените"
        footerNote="Всяка редакция се записва в историята на задачата."
        onError={(m) => toast.error(m)}
        onSubmit={async ({ values, files, removedImageIds }) => {
          try {
            const result = await update.mutateAsync({
              taskId: id,
              title: values.title,
              description: values.description,
              category: values.category,
              budget: values.budget,
              location: values.location,
              files,
              removedImageIds,
            });
            if (result.rejected.length > 0) {
              toast.error(`${result.rejected.length} снимка(и) не бяха приети`, {
                description: `${IMAGE_REJECT_BG} Причина: ${categoryBg(result.rejected[0])}.`,
              });
            }
            if (result.held > 0) toast.warning("Снимки в проверка", { description: IMAGE_HELD_BG });
            if (containsContactInfo(`${values.title} ${values.description}`)) {
              toast.warning("Контактите са скрити автоматично", { description: CONTACT_MASK_WARNING });
            }
            if (result.pending) {
              toast.warning("Задачата чака преглед", {
                description: "Проверяваме промените, преди задачата да е отново публична.",
              });
            } else {
              toast.success("Промените са запазени.");
            }
            navigate({ to: "/task/$id", params: { id } });
          } catch (err) {
            toastError(err, { title: "Промените не бяха запазени" });
          }

        }}
      />
    </div>
  );
}
