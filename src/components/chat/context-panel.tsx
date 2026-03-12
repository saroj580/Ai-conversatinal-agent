"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  Plug,
  Activity,
  ChevronRight,
  Clock,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type ConnectedApp = {
  id: string;
  name: string;
  status: "connected" | "disconnected" | "error";
};

export function ContextPanel() {
  const [apps, setApps] = useState<ConnectedApp[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadApps() {
      try {
        const res = await fetch("/api/apps/available", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { apps: ConnectedApp[] };
        if (!cancelled) setApps(data.apps ?? []);
      } catch {
        // silently fail
      }
    }
    void loadApps();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="hidden lg:flex h-full w-70 shrink-0 flex-col border-l bg-sidebar/50">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3.5">
        <span className="text-sm font-semibold">Context</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-5 p-4">
          {/* ── Today's Calendar ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Today&apos;s Calendar
              </h3>
            </div>

            <div className="space-y-2">
              <div className="rounded-xl border border-dashed p-3.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <p className="text-xs font-medium">No events today</p>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/70">
                  Connect Google Calendar to see your upcoming schedule here.
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Connected Apps ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Plug className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Connected Apps
              </h3>
            </div>

            <div className="space-y-1.5">
              {apps.length === 0 ? (
                <div className="rounded-xl border border-dashed p-3.5">
                  <p className="text-xs text-muted-foreground">
                    No apps connected yet
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    Use the sidebar to connect your first app.
                  </p>
                </div>
              ) : (
                apps.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-accent/50"
                  >
                    <div
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        app.status === "connected"
                          ? "bg-emerald-500"
                          : app.status === "error"
                            ? "bg-red-500"
                            : "bg-zinc-400"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {app.name}
                      </p>
                      <p className="text-[11px] capitalize text-muted-foreground">
                        {app.status}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  </div>
                ))
              )}
            </div>
          </section>

          <Separator />

          {/* ── Recent Activity ── */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recent Activity
              </h3>
            </div>

            <div className="space-y-2">
              <div className="rounded-xl border border-dashed p-3.5">
                <p className="text-xs text-muted-foreground">
                  No recent activity
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground/70">
                  Your actions and AI tool calls will appear here.
                </p>
              </div>
            </div>
          </section>
        </div>
      </ScrollArea>
    </aside>
  );
}
