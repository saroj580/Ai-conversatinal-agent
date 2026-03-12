import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const chats = await prisma.chatSession.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true, createdAt: true },
    take: 50,
  });

  return Response.json({ chats });
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const chat = await prisma.chatSession.create({
    data: { userId: session.user.id, title: body.title ?? "New chat" },
    select: { id: true },
  });

  return Response.json({ chatId: chat.id });
}


