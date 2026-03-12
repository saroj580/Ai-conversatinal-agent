import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getAllConnectors } from "@/lib/apps/registry";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const connectors = getAllConnectors();
  const connected = await prisma.connectedApp.findMany({
    where: { userId: session.user.id },
    select: { appId: true, status: true, credentials: { select: { id: true } } },
  });

  const byId = new Map(
    connected.map((c) => [
      c.appId,
      c.status === "connected" && c.credentials.length > 0
        ? "connected"
        : "disconnected",
    ]),
  );

  return Response.json({
    apps: connectors.map((c) => ({
      id: c.id,
      name: c.name,
      capabilities: c.getCapabilities(),
      status: byId.get(c.id) ?? "disconnected",
    })),
  });
}


