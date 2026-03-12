import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/server";
import { ChatLayoutClient } from "@/components/chat/chat-layout-client";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  console.log("Session in chat layout:", session);
  if (!session) {
    console.log("No session found, redirecting to login");
    redirect("/login");
  }

  return <ChatLayoutClient>{children}</ChatLayoutClient>;
}


