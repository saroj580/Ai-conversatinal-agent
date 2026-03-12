"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  MessageSquare,
  Plug,
  Activity,
  Settings,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConnectAppsDialog } from "@/components/chat/connect-apps-dialog";
import { useChatStore } from "@/components/chat/use-chat-store";
import { cn } from "@/lib/utils";

type ChatListItem = {
  id: string;
  title: string | null;
  updatedAt: string;
};

const navItems = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "apps", label: "Connected Apps", icon: Plug },
  { id: "activity", label: "Activity Logs", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
  const { activeChatId, setActiveChatId } = useChatStore();
  const [appsOpen, setAppsOpen] = useState(false);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [activeNav, setActiveNav] = useState<string>("chat");

  async function refreshChats() {
    const res = await fetch("/api/chats", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { chats: ChatListItem[] };
    setChats(data.chats);

    if (!activeChatId) {
      if (data.chats[0]) {
        setActiveChatId(data.chats[0].id);
      } else {
        const created = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (created.ok) {
          const { chatId } = (await created.json()) as { chatId: string };
          setActiveChatId(chatId);
          await refreshChats();
        }
      }
    }
  }

  useEffect(() => {
    void refreshChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleNavClick(id: string) {
    if (id === "apps") {
      setAppsOpen(true);
    } else if (id === "settings") {
      window.location.href = "/settings";
    } else {
      setActiveNav(id);
    }
  }

  return (
    <aside className="flex h-full w-65 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* ── Brand ── */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">Synapto</p>
          <p className="text-[11px] text-muted-foreground">AI Assistant</p>
        </div>
      </div>

      {/* ── New Chat ── */}
      <div className="px-3 pb-2">
        <Button
          className="w-full justify-start gap-2"
          size="sm"
          onClick={async () => {
            const res = await fetch("/api/chats", { method: "POST" });
            if (!res.ok) return;
            const { chatId } = (await res.json()) as { chatId: string };
            setActiveChatId(chatId);
            setActiveNav("chat");
            await refreshChats();
          }}
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <Separator />

      {/* ── Navigation ── */}
      <nav className="px-3 py-2">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.id === "chat"
                ? activeNav === "chat"
                : item.id === "activity"
                  ? activeNav === "activity"
                  : false;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive &&
                    "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <Separator />

      {/* ── Chat History ── */}
      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Chats
        </p>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-0.5 pb-3">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => {
                setActiveChatId(chat.id);
                setActiveNav("chat");
              }}
              className={cn(
                "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                activeChatId === chat.id &&
                  "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">
                {chat.title ?? "New Chat"}
              </span>
            </button>
          ))}
          {chats.length === 0 && (
            <p className="px-2.5 py-4 text-center text-xs text-muted-foreground">
              No chats yet. Start a new conversation!
            </p>
          )}
        </div>
      </ScrollArea>

      <ConnectAppsDialog open={appsOpen} onOpenChange={setAppsOpen} />

      {/* ── User ── */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="text-xs font-semibold">U</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">User</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Free plan
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}


