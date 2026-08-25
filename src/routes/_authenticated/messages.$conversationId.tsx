import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ChatThread } from "@/components/messages/chat-thread";

export const Route = createFileRoute("/_authenticated/messages/$conversationId")({
  head: () => ({
    meta: [
      { title: "Разговор | Задачи" },
      { name: "description", content: "Чат по задача – договори детайлите сигурно през платформата." },
      { property: "og:title", content: "Разговор | Задачи" },
      { property: "og:description", content: "Чат по задача в платформата." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConversationPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-center text-sm text-muted-foreground">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-6 text-center text-sm text-muted-foreground">Разговорът не е намерен.</div>
  ),
});

function ConversationPage() {
  const { conversationId } = Route.useParams();
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-0 sm:px-4 sm:py-6">
      <div className="flex shrink-0 items-center gap-2 px-3 py-3 sm:px-0">
        <Link
          to="/messages"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
          aria-label="Назад"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="text-sm font-semibold">Назад към съобщенията</span>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden border-y border-border/60 bg-card sm:rounded-2xl sm:border sm:shadow-sm">
        <ChatThread conversationId={conversationId} />
      </div>
    </div>
  );
}
