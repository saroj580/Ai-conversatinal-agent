"use client";

import { useEffect, useMemo, useState } from "react";
import { useChat, type Message } from "ai/react";
import { useChatStore } from "@/components/chat/use-chat-store";
import { MessageList } from "@/components/chat/message-list";
import { ChatComposer } from "@/components/chat/chat-composer";
import { Sparkles } from "lucide-react";

type DbMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
};

function ChatInner() {
  const { activeChatId } = useChatStore();
  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const chatId = activeChatId ?? "";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!chatId) return;
      setLoading(true);
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { messages: DbMessage[] };
      if (cancelled) return;
      setInitialMessages(
        data.messages.map((m) => ({
          id: m.id,
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      );
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    isLoading: isStreaming,
    setMessages,
  } = useChat({
    api: "/api/chat",
    body: useMemo(() => ({ chatId }), [chatId]),
    initialMessages,
    onResponse: () => {
      void fetch("/api/chats", { cache: "no-store" });
    },
  });

  useEffect(() => {
    setMessages(initialMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, initialMessages]);

  // Show typing indicator when AI hasn't started responding yet
  const showTyping =
    isStreaming &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "user";

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Chat Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Synapto</span>
        {isStreaming && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            Generating&hellip;
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex min-h-0 flex-1 flex-col">
        <MessageList
          className="flex-1"
          messages={messages}
          isTyping={showTyping}
          emptyState={
            loading
              ? "Loading messages..."
              : 'Ask anything, or try: "Create a meeting tomorrow at 5 pm."'
          }
        />
      </div>

      {/* Composer */}
      <div className="border-t bg-background/80 p-4 backdrop-blur-sm">
        <ChatComposer
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          disabled={!chatId || isStreaming}
        />
      </div>
    </div>
  );
}

export function ChatShell() {
  return <ChatInner />;
}
