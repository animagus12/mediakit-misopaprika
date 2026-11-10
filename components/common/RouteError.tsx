"use client";

import { useTransition } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface RouteErrorProps {
  error: unknown;
  retry: () => void;
}

// Errors thrown on the server reach the browser with a generic message and
// this hash, which matches the full error in the server logs.
function errorDigest(error: unknown): string | null {
  if (error instanceof Error && "digest" in error && typeof error.digest === "string") {
    return error.digest;
  }
  return null;
}

/**
 * Shown in place of a page that threw while rendering, which here almost
 * always means a store read failed. Used by app/error.tsx, which covers every
 * route, and by the dashboard group's own error.tsx so the home page keeps
 * its sidebar. Worded for a visitor too, since /links and /mediakit land here.
 */
export default function RouteError({ error, retry }: RouteErrorProps) {
  // retry() refetches the page inside a transition, so the pending state
  // lasts until the new render is in or fails again.
  const [isRetrying, startRetry] = useTransition();
  // Not logged here: Next already logs every error an error.tsx catches.
  const digest = errorDigest(error);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Card role="alert" className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>This page couldn&apos;t load</CardTitle>
          <CardDescription>
            That&apos;s usually a brief connection problem, so trying again often fixes it.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col items-stretch gap-3">
          <Button onClick={() => startRetry(retry)} disabled={isRetrying}>
            <RotateCw data-icon="inline-start" className={isRetrying ? "animate-spin" : undefined} />
            {isRetrying ? "Trying again…" : "Try again"}
          </Button>
          {digest && (
            <p className="text-center font-mono text-xs text-muted-foreground">
              Error reference: {digest}
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
