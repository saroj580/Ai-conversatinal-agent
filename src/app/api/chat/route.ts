import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { detectIntent, Intent, type DetectedIntent } from "@/lib/ai/intentDetector";
import { invokeTool, type ToolResult } from "@/lib/ai/toolInvoker";
import { openai } from "@ai-sdk/openai";
import { generateText, type CoreMessage } from "ai";
import { z } from "zod";
import { MODELS } from "@/lib/ai/prompts";

export const runtime = "nodejs";

// Request validation

const ChatRequestSchema = z.object({
  chatId: z.string().min(1, "chatId is required"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      }),
    )
    .min(1, "At least one message is required"),
});

// POST /api/chat

export async function POST(req: Request) {
  // Authenticate 
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Parse & validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { chatId, messages } = parsed.data;

  // Verify chat belongs to user
  const chat = await prisma.chatSession.findFirst({
    where: { id: chatId, userId },
  });
  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  // Extract the latest user message
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== "user" || !lastMessage.content.trim()) {
    return NextResponse.json(
      { error: "Last message must be a non-empty user message" },
      { status: 400 },
    );
  }

  const userInput = lastMessage.content.trim();

  // Persist user message
  await prisma.chatMessage.create({
    data: { chatId, role: "user", content: userInput },
  });

  // Load connected apps 
  const connectedApps = await prisma.connectedApp.findMany({
    where: { userId, status: "connected" },
    select: { appId: true },
  });
  const connectedAppIds = connectedApps.map((a) => a.appId);

  // Intent detection 
  const detected: DetectedIntent = await detectIntent(userInput, connectedAppIds);

  // Tool invocation (delegates to calendarService) 
  const toolResult: ToolResult = await invokeTool(detected, userId);

  // Generate conversational response
  const systemPrompt = buildSystemPrompt(detected, toolResult, connectedAppIds);

  const coreMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  })) satisfies CoreMessage[];

  const { text: assistantText } = await generateText({
    model: openai(MODELS.CHAT),
    system: systemPrompt,
    messages: coreMessages,
  });

  // Persist assistant response 
  await prisma.chatMessage.create({
    data: { chatId, role: "assistant", content: assistantText },
  });

  await prisma.chatSession.update({
    where: { id: chatId },
    data: { updatedAt: new Date() },
  });

  // Return JSON for chat UI
  return NextResponse.json({
    message: {
      role: "assistant" as const,
      content: assistantText,
    },
    metadata: {
      intent: detected.intent,
      confidence: detected.confidence,
      toolStatus: toolResult.status,
    },
  });
}

// System prompt builder

function buildSystemPrompt(
  detected: DetectedIntent,
  toolResult: ToolResult,
  connectedAppIds: string[],
): string {
  const appList =
    connectedAppIds.length === 0
      ? "No connected apps."
      : connectedAppIds.map((id) => `- ${id}`).join("\n");

  const intentSection =
    detected.intent !== Intent.GENERAL
      ? `\n\nDetected intent: ${detected.intent} (confidence: ${detected.confidence.toFixed(2)})\nExtracted parameters: ${JSON.stringify(detected.parameters)}`
      : "";

  let toolSection = "";
  if (toolResult.status === "success" && toolResult.data) {
    toolSection = `\n\nA connected app returned this data:\n${toolResult.data}\n\nUse it to answer the user faithfully. Format dates/times in a human-friendly way.`;
  } else if (toolResult.status === "error" && toolResult.data) {
    toolSection = `\n\nAn error occurred when fetching data:\n${toolResult.data}\n\nInform the user politely and suggest next steps.`;
  }

  return `You are Synapto, a helpful productivity assistant that connects to the user's apps.

Connected apps:
${appList}
${intentSection}
If the user asks for something an app can do, the system may call it automatically. If app data is provided, incorporate it faithfully.
Keep responses concise, friendly, and actionable.${toolSection}`;
}


