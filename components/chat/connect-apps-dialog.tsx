"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type AvailableApp = {
  id: string;
  name: string;
  capabilities: string[];
  status: "connected" | "disconnected" | "error";
};

export function ConnectAppsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [apps, setApps] = useState<AvailableApp[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!open) return;
      const res = await fetch("/api/apps/available", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { apps: AvailableApp[] };
      if (!cancelled) setApps(data.apps);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function connect(appId: string) {
    setBusyId(appId);
    const res = await fetch(`/api/apps/${appId}/connect`, { method: "POST" });
    if (res.ok) {
      const data = (await res.json()) as { redirectUrl: string | null };
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
    }
    setBusyId(null);
  }

  async function disconnect(appId: string) {
    setBusyId(appId);
    await fetch(`/api/apps/${appId}/disconnect`, { method: "POST" });
    setBusyId(null);
    const res = await fetch("/api/apps/available", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { apps: AvailableApp[] };
      setApps(data.apps);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect Apps</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-3">
            {apps.map((app) => (
              <div
                key={app.id}
                className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{app.name}</p>
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                      {app.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Capabilities: {app.capabilities.join(", ")}
                  </p>
                </div>
                {app.status === "connected" ? (
                  <Button
                    variant="outline"
                    onClick={() => disconnect(app.id)}
                    disabled={busyId === app.id}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    onClick={() => connect(app.id)}
                    disabled={busyId === app.id}
                  >
                    Connect
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}


