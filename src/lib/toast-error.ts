import { toast } from "sonner";
import { errorBg } from "@/lib/errors";

/**
 * Единственият начин, по който показваме грешка на потребителя.
 * Никой `catch` не трябва да остава само с `console.error` — тихите провали
 * карат хората да мислят, че сайтът е счупен.
 */
export function toastError(
  e: unknown,
  fallback?: Partial<{ title: string; description: string }>,
) {
  const { title, description } = errorBg(e, fallback);
  toast.error(title, description && description !== title ? { description } : undefined);
}
