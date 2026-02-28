"use client";

import { ChatStoreProvider } from "@/components/chat/use-chat-store";
import { Sidebar } from "@/components/chat/sidebar";

export function ChatLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ChatStoreProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar />
        <main className="flex min-w-0 flex-1">{children}</main>
      </div>
    </ChatStoreProvider>
  );
}


