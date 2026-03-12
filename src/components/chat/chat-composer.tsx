"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatComposer({
  input,
  setInput,
  onSubmit,
  disabled,
}: {
  input: string;
  setInput: (v: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  disabled: boolean;
}) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [input]);

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-3xl">
      <div className="relative flex items-end rounded-2xl border bg-background shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-1 focus-within:ring-ring/20">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Synapto…"
          className={cn(
            "flex-1 resize-none bg-transparent px-4 py-3.5 pr-12 text-sm leading-relaxed",
            "placeholder:text-muted-foreground",
            "focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "min-h-12 max-h-50",
          )}
          disabled={disabled}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement | null)?.requestSubmit();
            }
          }}
        />
        <button
          type="submit"
          disabled={disabled || input.trim().length === 0}
          className={cn(
            "absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            input.trim().length > 0
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Synapto can make mistakes. Check important info.
      </p>
    </form>
  );
}


