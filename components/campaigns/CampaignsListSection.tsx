import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { computeCampaignStats, type CampaignBrandOption } from "@/lib/campaigns";
import { formatMoney } from "@/lib/invoice";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/repositories/campaigns";
import type { EarningsSummary } from "@/repositories/earnings";
import { NewCampaignButton } from "./NewCampaignButton";
import { CampaignsTable } from "./CampaignsTable";

// Same tone system as the invoices list's stat cards, so money/count tiles
// read consistently across the dashboard.
const STAT_TONES = {
  neutral: { card: "", value: "" },
  cash: { card: "bg-emerald-500/5 ring-emerald-500/15", value: "text-emerald-600 dark:text-emerald-400" },
  barter: { card: "bg-blue-500/5 ring-blue-500/15", value: "text-blue-600 dark:text-blue-400" },
  warn: { card: "bg-amber-500/5 ring-amber-500/15", value: "text-amber-600 dark:text-amber-400" },
} as const;

interface CampaignsListSectionProps {
  campaigns: Campaign[];
  earnings: EarningsSummary | null;
  error?: string | null;
  brandOptions?: CampaignBrandOption[];
}

export function CampaignsListSection({
  campaigns,
  earnings,
  error,
  brandOptions = [],
}: CampaignsListSectionProps) {
  const stats = computeCampaignStats(campaigns);

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h1 className="font-heading text-lg font-semibold">Campaigns</h1>
          <p className="text-xs text-muted-foreground">
            Every brand campaign on record, in one table.
          </p>
        </div>
        <NewCampaignButton brandOptions={brandOptions} />
      </div>

      {error ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            Couldn&apos;t load campaigns: {error}
          </CardContent>
        </Card>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">No campaigns yet.</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardDescription>Total campaigns</CardDescription>
                <CardTitle className="text-lg tabular-nums">{stats.total}</CardTitle>
                {stats.cancelled > 0 && (
                  <p className="text-xs text-muted-foreground">{stats.cancelled} cancelled</p>
                )}
              </CardHeader>
            </Card>
            <Card className={STAT_TONES.cash.card}>
              <CardHeader>
                <CardDescription>Cash received</CardDescription>
                <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.cash.value)}>
                  {formatMoney(earnings?.paid ?? 0)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className={STAT_TONES.barter.card}>
              <CardHeader>
                <CardDescription>Barter value received</CardDescription>
                <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.barter.value)}>
                  {formatMoney(earnings?.barter ?? 0)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className={STAT_TONES.warn.card}>
              <CardHeader>
                <CardDescription>Pending payments</CardDescription>
                <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.warn.value)}>
                  {formatMoney(earnings?.pending ?? 0)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Suspense fallback={<div className="h-64 rounded-md border border-border" />}>
            <CampaignsTable campaigns={campaigns} brandOptions={brandOptions} />
          </Suspense>
        </>
      )}
    </section>
  );
}
