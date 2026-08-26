import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/invoice";
import type { BrandPipelineStats } from "@/lib/brands";
import { cn } from "@/lib/utils";

// Same tone system as EditorTransactionsSection's stat cards, so money/count
// tiles read consistently across the dashboard.
const STAT_TONES = {
  neutral: { card: "", value: "" },
  cash: { card: "bg-emerald-500/5 ring-emerald-500/15", value: "text-emerald-600 dark:text-emerald-400" },
  info: { card: "bg-sky-500/5 ring-sky-500/15", value: "text-sky-600 dark:text-sky-400" },
  amber: { card: "bg-amber-500/5 ring-amber-500/15", value: "text-amber-600 dark:text-amber-400" },
} as const;

interface BrandsStatCardsProps {
  stats: BrandPipelineStats;
}

export function BrandsStatCards({ stats }: BrandsStatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <Card className={STAT_TONES.neutral.card}>
        <CardHeader>
          <CardDescription>Total brands</CardDescription>
          <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.neutral.value)}>{stats.totalBrands}</CardTitle>
        </CardHeader>
      </Card>
      <Card className={STAT_TONES.info.card}>
        <CardHeader>
          <CardDescription>Active brands</CardDescription>
          <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.info.value)}>{stats.activeBrands}</CardTitle>
        </CardHeader>
      </Card>
      <Card className={STAT_TONES.neutral.card}>
        <CardHeader>
          <CardDescription>Worked with</CardDescription>
          <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.neutral.value)}>{stats.workedWith}</CardTitle>
        </CardHeader>
      </Card>
      <Card className={STAT_TONES.neutral.card}>
        <CardHeader>
          <CardDescription>Potential / leads</CardDescription>
          <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.neutral.value)}>{stats.leads}</CardTitle>
        </CardHeader>
      </Card>
      <Card className={STAT_TONES.cash.card}>
        <CardHeader>
          <CardDescription>Total revenue</CardDescription>
          <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.cash.value)}>
            {formatMoney(stats.totalRevenue)}
          </CardTitle>
        </CardHeader>
      </Card>
      <Card className={STAT_TONES.amber.card}>
        <CardHeader>
          <CardDescription>Pending payments</CardDescription>
          <CardTitle className={cn("text-lg tabular-nums", STAT_TONES.amber.value)}>
            {formatMoney(stats.pendingPayments)}
          </CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
