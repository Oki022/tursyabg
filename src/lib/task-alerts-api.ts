import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getCategory } from "@/lib/mock-data";
import { municipalityLabel } from "@/lib/locations";
import { toastError } from "@/lib/toast-error";
import {
  MAX_TASK_ALERTS,
  createTaskAlert,
  deleteTaskAlert,
  getMyTaskAlerts,
  type TaskAlertInput,
} from "@/services/task-alerts";

const KEY = ["task-alerts"];

export function useMyTaskAlerts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...KEY, user?.id],
    enabled: Boolean(user?.id),
    queryFn: getMyTaskAlerts,
  });
}

export function useCreateTaskAlert() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: TaskAlertInput) => {
      if (!user?.id) throw new Error("Трябва да си влязъл в профила си.");
      await createTaskAlert(user.id, input);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success("Известието е включено", {
        description: "Ще ти пишем, щом се появят нови задачи по това търсене.",
      });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "ALERT_EXISTS") {
        toast.info("Вече получаваш известия за това търсене.");
        void qc.invalidateQueries({ queryKey: KEY });
      } else if (msg === "ALERT_LIMIT") {
        toast.error(`Може да имаш най-много ${MAX_TASK_ALERTS} известия.`, {
          description: "Изтрий някое от Настройки → Нотификации и опитай пак.",
        });
      } else {
        toastError(err, { title: "Известието не беше включено" });
      }
    },
  });
}

export function useDeleteTaskAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTaskAlert,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success("Известието е изключено.");
    },
    onError: (err: unknown) => toastError(err, { title: "Известието не беше изтрито" }),
  });
}

/** "Ремонти · общ. Шумен", "Всички задачи · обл. Варна", "Ремонти · цяла България". */
export function taskAlertLabel(
  alert: TaskAlertInput,
  regionName?: (slug: string) => string | undefined,
): string {
  const what = alert.category ? getCategory(alert.category).name : "Всички задачи";
  const where = alert.city
    ? municipalityLabel(alert.city)
    : alert.region
      ? `обл. ${regionName?.(alert.region) ?? alert.region}`
      : "цяла България";
  return `${what} · ${where}`;
}
