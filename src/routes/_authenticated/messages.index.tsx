import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { ChatThread } from "@/components/messages/chat-thread";
import { ConversationList } from "@/components/messages/conversation-list";

export const Route = createFileRoute("/_authenticated/messages/")({
  head: () => ({
    meta: [
      { title: "Съобщения | Задачи" },
      { name: "description", content: "Твоите разговори по задачи – пиши сигурно през платформата." },
      { property: "og:title", content: "Съобщения | Задачи" },
      { property: "og:description", content: "Твоите разговори по задачи на едно място." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesInbox,
});

function MessagesInbox() {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-8">
      <h1 className="mb-4 text-2xl font-bold tracking-tight text-foreground">Съобщения</h1>

      {/* Мобилно: само списък */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm md:hidden">
        <ConversationList variant="mobile" />
      </div>

      {/* Десктоп: две колони */}
      <div className="hidden gap-4 md:grid md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <div className="h-[70vh] overflow-y-auto rounded-2xl border border-border/60 bg-card shadow-sm">
          <ConversationList
            variant="desktop"
            selectedId={selectedId}
            onSelect={(c) => setSelectedId(c.id)}
          />
        </div>
        <div className="flex h-[70vh] min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          {selectedId ? (
            <ChatThread conversationId={selectedId} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <MessageCircle className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-muted-foreground">Избери разговор, за да го отвориш.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
