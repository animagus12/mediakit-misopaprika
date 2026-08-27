"use client";

import Link from "next/link";
import { CircleAlert, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import type { AttentionItem } from "@/lib/dashboardAttention";
import { MarkReceivedButton } from "./MarkReceivedButton";
import { useMarkReceived } from "./useMarkReceived";

interface NeedsAttentionCardProps {
  items: AttentionItem[];
  className?: string;
}

const MAX_ROWS = 6;

// Operational open loops — delivered work with no invoice, completed deals
// with untracked payment — each with the one action that closes it. Sits
// next to PaymentsDueCard (money owed on a schedule); nothing here carries a
// due date, so the two lists don't overlap. Renders nothing when clear.
export function NeedsAttentionCard({ items, className }: NeedsAttentionCardProps) {
  const { hiddenIds, isPending, markReceived } = useMarkReceived();

  const visible = items.filter((item) => !hiddenIds.includes(item.campaignId));
  if (visible.length === 0) return null;

  const shown = visible.slice(0, MAX_ROWS);
  const hidden = visible.length - shown.length;

  return (
    <Card className={cn("bg-rose-500/5 ring-rose-500/15", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CircleAlert className="size-4 text-rose-600 dark:text-rose-400" />
          <CardDescription>Needs attention</CardDescription>
        </div>
        <CardTitle className="text-lg text-rose-600 dark:text-rose-400">
          {visible.length} thing{visible.length === 1 ? "" : "s"} to follow up
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {shown.map((item) => (
          <div
            key={`${item.kind}-${item.campaignId || `${item.brand}-${item.campaign}`}`}
            className="rounded-md px-2 py-2 text-sm odd:bg-muted/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.brand}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.campaign || "—"} · {formatMoney(item.amount)}
                </p>
              </div>
              <p className="shrink-0 pt-0.5 text-right text-xs text-muted-foreground">{item.label}</p>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              {item.kind === "uninvoiced" ? (
                <Button asChild size="sm" variant="outline">
                  <Link href="/invoices/new">
                    <FileText />
                    Create invoice
                  </Link>
                </Button>
              ) : item.campaignId ? (
                <MarkReceivedButton
                  pending={isPending}
                  onClick={() => markReceived(item.campaignId, item.brand)}
                />
              ) : null}
            </div>
          </div>
        ))}
        {hidden > 0 && (
          <p className="px-2 pt-1 text-xs text-muted-foreground">
            +{hidden} more need{hidden === 1 ? "s" : ""} attention
          </p>
        )}
      </CardContent>
    </Card>
  );
}
