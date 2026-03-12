"use client";

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/60" />
      <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/60" />
      <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground/60" />
    </div>
  );
}
