import type { Task } from "@/lib/mock-data";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "12 ноември" */
export function dayMonthBg(ms: number) {
  return new Date(ms).toLocaleDateString("bg-BG", { day: "numeric", month: "long" });
}

export type TaskLifetimeNotice = { kind: "confirm" | "expiring"; until: number };

/**
 * What the owner should be told about the task's lifetime, if anything
 * (same rules as public.sweep_expiry_notifications):
 * - asked "still open?" after 14 days without a confirmation: deactivated 7 days after the question;
 * - otherwise, less than 3 days before the 30 days are over.
 */
export function taskLifetimeNotice(
  task: Pick<Task, "status" | "adminHiddenAt" | "freshnessPromptAt" | "expiresAtIso">,
  now = Date.now(),
): TaskLifetimeNotice | null {
  if (task.status !== "active" || task.adminHiddenAt) return null;
  if (task.freshnessPromptAt) {
    return { kind: "confirm", until: new Date(task.freshnessPromptAt).getTime() + 7 * DAY_MS };
  }
  if (task.expiresAtIso) {
    const ends = new Date(task.expiresAtIso).getTime();
    if (ends - now < 3 * DAY_MS) return { kind: "expiring", until: ends };
  }
  return null;
}
