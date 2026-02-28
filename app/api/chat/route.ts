import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { orchestrate } from "@/lib/ai/orchestrator";
import { convertToCoreMessages, type Message } from "ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json()) as { chatId: string; messages: Message[] };
  const chatId = body.chatId;
  const messages = body.messages ?? [];

  const chat = await prisma.chat.findFirst({
    where: { id: chatId, userId: session.user.id },
  });
  if (!chat) return new Response("Chat not found", { status: 404 });

  const last = messages[messages.length - 1];
  const latestUserInput = typeof last?.content === "string" ? last.content : "";

  if (!latestUserInput) {
    return new Response("Missing user message", { status: 400 });
  }

  await prisma.message.create({
    data: { chatId, role: "user", content: latestUserInput },
  });

  const result = await orchestrate({
    userId: session.user.id,
    latestUserInput,
    messages: convertToCoreMessages(messages),
  });

  return result.toDataStreamResponse({
    onFinish: async ({ text }) => {
      if (!text) return;
      await prisma.message.create({
        data: { chatId, role: "assistant", content: text },
      });
      await prisma.chat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() },
      });
    },
  });
}


