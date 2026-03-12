import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db/prisma";

/**
 * Better Auth configuration.
 *
 * Notes:
 * - Email/password enabled (no email verification for MVP).
 * - Prisma adapter stores users/sessions/accounts in `prisma/schema.prisma`.
 */
export const auth = betterAuth({
  baseURL: "http://localhost:3000",
  trustedOrigins: ["http://localhost:3000"],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
});

export type AuthSession = Awaited<
  ReturnType<typeof auth.api.getSession>
> extends infer T
  ? T
  : never;


