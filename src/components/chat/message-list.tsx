"use client";

import { useEffect, useRef } from "react";
import type { Message } from "ai/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { TypingIndicator } from "@/components/chat/typing-indicator";

export function MessageList({
  messages,
  emptyState,
  className,
  isTyping,
}: {
  messages: Message[];
  emptyState: string;
  className?: string;
  isTyping?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isTyping]);

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="mx-auto w-full max-w-3xl space-y-1 px-4 py-6">
        {/* Empty state */}
        {messages.length === 0 && !isTyping ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mb-1 text-lg font-semibold">
              How can I help you today?
            </h3>
            <p className="max-w-md text-center text-sm text-muted-foreground">
              {emptyState}
            </p>
          </div>
        ) : null}

        {/* Messages */}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex gap-3 py-3",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            {/* AI avatar */}
            {m.role !== "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}

            {/* Bubble */}
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
              )}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>

            {/* User avatar */}
            {m.role === "user" && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex gap-3 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-2xl bg-muted px-4 py-3">
              <TypingIndicator />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}


