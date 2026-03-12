"use client";

import { ChatStoreProvider } from "@/components/chat/use-chat-store";
import { Sidebar } from "@/components/chat/sidebar";
import { ContextPanel } from "@/components/chat/context-panel";

export function ChatLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ChatStoreProvider>
      <div className="flex h-screen w-full overflow-hidden">
        {/* Left: Sidebar */}
        <Sidebar />

        {/* Center: Chat Interface */}
        <main className="flex min-w-0 flex-1">{children}</main>

        {/* Right: Context Panel */}
        <ContextPanel />
      </div>
    </ChatStoreProvider>
  );
}


