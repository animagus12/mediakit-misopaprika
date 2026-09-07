"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { ArrowUpRight, Check, CircleSlash, PauseCircle, RefreshCw, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { setCampaignUsageState, setUsageRenewalPaymentStatus } from "@/app/(dashboard)/actions";
import { formatMoney } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import type { OwedRenewal, UsageAlert } from "@/lib/usageRights";
import { RenewUsageSheet } from "./RenewUsageSheet";

interface UsageRenewalsCardProps {
  /** Licences inside the alert window or already past their term. */
  alerts: UsageAlert[];
  /** Renewal fees agreed and not yet collected. */
  owed: OwedRenewal[];
  /** Adds a link out of the card header, for the dashboard's copy of it. */
  href?: string;
  className?: string;
}

function dueLabel(daysUntilDue: number | null): string {
  if (daysUntilDue === null) return "No date agreed";
  if (daysUntilDue < 0) {
    const days = Math.abs(daysUntilDue);
    return `Overdue by ${days} day${days === 1 ? "" : "s"}`;
  }
  if (daysUntilDue === 0) return "Due today";
  if (daysUntilDue === 1) return "Due tomorrow";
  return `Due in ${daysUntilDue} days`;
}

/**
 * The decision queue for ad-usage licences: the ones running out, and the
 * renewal fees they brought in that are still owed.
 *
 * Both halves live in one card because they are one loop. Renewing a licence
 * takes it out of the first list and, when the fee is not collected on the
 * spot, straight into the second; splitting them across two cards would make
 * the handover invisible and let renewal money go unchased.
 *
 * The fees are kept out of PaymentsDueCard for a different reason: a deal and
 * the licence extension bought against it are two debts against the same post,
 * and one row there carries a deal's brand, campaign and total, which are the
 * wrong numbers for a renewal. Both cards sit on the dashboard together, so
 * everything owed is still on one screen.
 *
 * The card surface is violet rather than the amber the payments and
 * week-ahead cards use, so three alert panels stacked on the dashboard stay
 * tellable apart at a glance. The colour that carries meaning is on the rows:
 * amber for a licence running out, destructive for one already past its term.
 */
export function UsageRenewalsCard({ alerts, owed, href, className }: UsageRenewalsCardProps) {
  const [isPending, startTransition] = useTransition();
  // Keyed rather than id-keyed: an alert row and a fee row can belong to the
  // same deal, and hiding one must not hide the other.
  const [hiddenKeys, hide] = useOptimistic<string[], string>([], (keys, key) => [...keys, key]);

  function decide(
    campaignId: string,
    brand: string,
    transition: "pause" | "end",
    message: string
  ) {
    startTransition(async () => {
      hide(`alert:${campaignId}`);
      const result = await setCampaignUsageState(campaignId, transition);
      if (!result.success) {
        toast.error("Couldn't update the licence", { description: result.error });
        return;
      }
      toast.success(`${brand}: ${message}`, {
        action: {
          // "resume" reverses both a pause and an end, which is what lets one
          // Undo serve either.
          label: "Undo",
          onClick: () =>
            startTransition(async () => {
              const undo = await setCampaignUsageState(campaignId, "resume");
              if (!undo.success) toast.error("Couldn't undo", { description: undo.error });
            }),
        },
      });
    });
  }

  function collect(renewal: OwedRenewal) {
    startTransition(async () => {
      hide(`owed:${renewal.campaignId}:${renewal.renewalId}`);
      const result = await setUsageRenewalPaymentStatus(
        renewal.campaignId,
        renewal.renewalId,
        "received"
      );
      if (!result.success) {
        toast.error("Couldn't mark received", { description: result.error });
        return;
      }
      toast.success(`${renewal.brand}: renewal marked received`, {
        description: formatMoney(renewal.amount),
        action: {
          label: "Undo",
          onClick: () =>
            startTransition(async () => {
              const undo = await setUsageRenewalPaymentStatus(
                renewal.campaignId,
                renewal.renewalId,
                "pending"
              );
              if (!undo.success) toast.error("Couldn't undo", { description: undo.error });
            }),
        },
      });
    });
  }

  const visibleAlerts = alerts.filter((alert) => !hiddenKeys.includes(`alert:${alert.campaignId}`));
  const visibleOwed = owed.filter(
    (renewal) => !hiddenKeys.includes(`owed:${renewal.campaignId}:${renewal.renewalId}`)
  );
  if (visibleAlerts.length === 0 && visibleOwed.length === 0) return null;

  const expired = visibleAlerts.filter((alert) => alert.term.state === "expired").length;
  const owedTotal = visibleOwed.reduce((sum, renewal) => sum + renewal.amount, 0);

  return (
    <Card className={cn("bg-violet-500/5 ring-violet-500/15", className)}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-violet-600 dark:text-violet-400" />
            <CardDescription>Ad usage rights</CardDescription>
          </div>
          {href && (
            <Button asChild size="sm" variant="ghost">
              <Link href={href}>
                Campaigns
                <ArrowUpRight />
              </Link>
            </Button>
          )}
        </div>
        <CardTitle className="text-lg text-violet-600 dark:text-violet-400">
          {visibleAlerts.length > 0
            ? `${visibleAlerts.length} licence${visibleAlerts.length === 1 ? "" : "s"} to decide on`
            : `${formatMoney(owedTotal)} in renewals owed`}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {[
              expired > 0 ? `${expired} already expired` : null,
              visibleAlerts.length > 0 && visibleOwed.length > 0
                ? `${formatMoney(owedTotal)} owed`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-0.5">
        {visibleAlerts.map((alert) => (
          <div key={alert.campaignId} className="rounded-md px-2 py-2 text-sm odd:bg-muted/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{alert.brand}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {alert.campaign || "-"} · {alert.term.totalMonths} month
                  {alert.term.totalMonths === 1 ? "" : "s"} granted
                  {alert.term.termCount > 1 ? ` over ${alert.term.termCount} terms` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className={cn(
                    "font-medium tabular-nums",
                    alert.term.state === "expired"
                      ? "text-destructive"
                      : "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {alert.term.label}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">{alert.term.endDate}</p>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <RenewUsageSheet
                campaignId={alert.campaignId}
                brand={alert.brand}
                term={alert.term}
                // Renewing is a decision like pausing or ending, so the row
                // leaves the queue the moment it is made rather than waiting
                // for the revalidation to land. Wrapped in a transition
                // because useOptimistic only accepts updates from inside one.
                onRenewed={() => startTransition(() => hide(`alert:${alert.campaignId}`))}
                trigger={
                  <Button type="button" size="sm" variant="outline" disabled={isPending}>
                    <RefreshCw />
                    Renew
                  </Button>
                }
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => decide(alert.campaignId, alert.brand, "pause", "usage paused")}
              >
                <PauseCircle />
                Pause
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => decide(alert.campaignId, alert.brand, "end", "usage ended")}
              >
                <CircleSlash />
                End
              </Button>
            </div>
          </div>
        ))}


        {visibleAlerts.length > 0 && visibleOwed.length > 0 && <Separator className="my-3" />}

        {visibleOwed.length > 0 && (
          <>
            <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">
              Renewal fees owed
            </p>
            {visibleOwed.map((renewal) => (
              <div
                key={`${renewal.campaignId}:${renewal.renewalId}`}
                className="rounded-md px-2 py-2 text-sm odd:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{renewal.brand}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {renewal.months} month{renewal.months === 1 ? "" : "s"} ·{" "}
                      {formatMoney(renewal.amount)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "font-medium tabular-nums",
                        renewal.overdue
                          ? "text-destructive"
                          : "text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {dueLabel(renewal.daysUntilDue)}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {renewal.paymentDue || "-"}
                    </p>
                  </div>
                </div>
                <div className="mt-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => collect(renewal)}
                  >
                    <Check />
                    {isPending ? "Saving…" : "Mark received"}
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
