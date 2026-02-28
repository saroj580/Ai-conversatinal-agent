import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to continue to your workspace.
        </p>
      </div>

      <LoginForm />

      <p className="text-sm text-muted-foreground">
        Don’t have an account?{" "}
        <Link className="text-foreground underline" href="/register">
          Create one
        </Link>
      </p>
    </div>
  );
}


