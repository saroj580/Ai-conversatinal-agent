import { auth } from "@/lib/auth";

export const runtime = "nodejs";

// Better Auth route handler (App Router)
export const { GET, POST } = auth.handler;


