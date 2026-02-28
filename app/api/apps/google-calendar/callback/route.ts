import { handleGoogleOAuthCallback } from "@/lib/apps/google-calendar/oauth";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return new Response("Missing code/state", { status: 400 });
  }

  await handleGoogleOAuthCallback({ code, state });
  redirect("/chat");
}


