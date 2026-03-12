import { handleGoogleOAuthCallback } from "@/lib/apps/google-calendar/oauth";
import { redirect } from "next/navigation";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    redirect("/chat?oauth_error=consent_denied");
  }

  if (!code || !state) {
    return new Response("Missing code/state", { status: 400 });
  }

  try {
    await handleGoogleOAuthCallback({ code, state });
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth failed";
    console.error("Google OAuth callback error:", message);
    redirect(`/chat?oauth_error=${encodeURIComponent(message)}`);
  }

  redirect("/chat?oauth_success=google-calendar");
}


