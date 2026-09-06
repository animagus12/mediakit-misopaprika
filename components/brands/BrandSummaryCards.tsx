import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/invoice";
import type { BrandStats } from "@/lib/brandCampaignStats";
import { cn } from "@/lib/utils";

const STAT_TONES = {
  neutral: { card: "", value: "" },
  cash: { card: "bg-emerald-500/5 ring-emerald-500/15", value: "text-emerald-600 dark:text-emerald-400" },
  amber: { card: "bg-amber-500/5 ring-amber-500/15", value: "text-amber-600 dark:text-amber-400" },
} as const;

interface BrandSummaryCardsProps {
  stats: BrandStats;
}

export function BrandSummaryCards({ stats }: BrandSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card className={STAT_TONES.neutral.card}>
        <CardHeader>
          <CardDescription>Total campaigns</CardDescription>
          <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.neutral.value)}>
            {stats.campaignCount}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className={STAT_TONES.cash.card}>
        <CardHeader>
          <CardDescription>Total revenue</CardDescription>
          <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.cash.value)}>
            {formatMoney(stats.totalReceived)}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className={STAT_TONES.amber.card}>
        <CardHeader>
          <CardDescription>Pending</CardDescription>
          <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.amber.value)}>
            {formatMoney(stats.pending)}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className={STAT_TONES.neutral.card}>
        <CardHeader>
          <CardDescription>Last collaboration</CardDescription>
          <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.neutral.value)}>
            {stats.lastCollabDate ?? "-"}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
