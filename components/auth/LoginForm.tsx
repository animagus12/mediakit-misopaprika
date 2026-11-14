"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loginRedirectPath } from "@/lib/loginRedirect";

const NETWORK_ERROR = "Couldn't reach the server. Check your connection and try again.";
const UNKNOWN_ERROR = "Couldn't sign in. Try again.";

function errorMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  return typeof body.error === "string" ? body.error : null;
}

/**
 * Null once signed in, else the sentence to show. The route words its own
 * refusals ("Incorrect password", "Too many attempts. Try again later."), so
 * those are shown as sent; a failure with no message, such as a server
 * error, gets a generic line rather than blaming the password.
 */
async function signIn(password: string, rememberMe: boolean): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, rememberMe }),
    });
  } catch {
    return NETWORK_ERROR;
  }
  if (response.ok) return null;
  return errorMessage(await response.json().catch(() => null)) ?? UNKNOWN_ERROR;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const problem = await signIn(password, rememberMe);
    if (problem) {
      setError(problem);
      setIsSubmitting(false);
      return;
    }

    // Left disabled on success: the page is about to change, and a second
    // press in the meantime would only sign in again.
    router.replace(loginRedirectPath(searchParams.get("from")));
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Enter password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label htmlFor="remember-me" className="font-normal">
                Remember me for 30 days
              </Label>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Checking..." : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
