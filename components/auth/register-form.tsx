"use client";

import { useState } from "react";
import { registerWithEmailPassword } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setError(null);
        try {
          // Server Action redirects on success.
          const result = await registerWithEmailPassword(formData);
          if (result && "ok" in result && !result.ok) {
            setError(result.error);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to create account.");
        }
      }}
      className="space-y-4"
    >
      <Input name="name" type="text" placeholder="Name (optional)" />
      <Input name="email" type="email" placeholder="Email" required />
      <Input name="password" type="password" placeholder="Password" required />

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full">
        Create account
      </Button>
    </form>
  );
}


