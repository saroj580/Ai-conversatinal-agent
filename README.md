## ChatBB

Production-oriented **Next.js 14 (App Router)** starter for an “All-in-One Chat App” where users can connect external apps (starting with **Google Calendar**) and chat with them.

### Tech

- **Next.js 14**, **TypeScript**, **TailwindCSS**, **shadcn/ui**
- **Better Auth** (email/password)
- **Vercel AI SDK** (`streamText`) + OpenAI provider
- **PostgreSQL** via **Prisma**

### Architecture (high level)

- **UI**: `components/` (no business logic)
- **AI orchestration**: `lib/ai/orchestrator.ts`
- **App connectors**: `lib/apps/*`
  - implement `AppConnector` in `lib/apps/base.ts`
  - register in `lib/apps/registry.ts`
- **DB layer**: `lib/db/prisma.ts` + `prisma/schema.prisma`
- **Auth**: `lib/auth.ts` + Better Auth handler at `app/api/auth/[...better-auth]/route.ts`

## Getting Started

### 1) Configure env

Copy `env.example` to your local env file and fill values:

- `DATABASE_URL`
- `OPENAI_API_KEY`
- `BETTER_AUTH_SECRET`
- `NEXT_PUBLIC_APP_URL`
- Google OAuth vars (for Calendar)
- `APP_CREDENTIAL_ENCRYPTION_KEY` (for storing refresh tokens in DB)

### 2) Prisma

Generate client + run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 3) Run

Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

### Key routes

- `/`: landing (redirects to `/chat` if logged in)
- `/login`, `/register`: email/password auth
- `/chat`: protected chat UI
- `/api/chat`: streaming chat endpoint (persists messages)
- `/api/apps/*`: connect/disconnect apps + OAuth callback

### Adding a new app connector

1. Create `lib/apps/<your-app>/index.ts` implementing `AppConnector`
2. Register it in `lib/apps/registry.ts`
3. Add any OAuth routes under `app/api/apps/<your-app>/...`
4. The “Connect Apps” dialog and orchestrator will pick it up automatically

