import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/invoice";
import type { BrandFilter, BrandPipelineStats } from "@/lib/brands";
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

/**
 * Four tiles, each a shortcut into the matching table view (?tab=…), the same
 * way the /invoices tiles work.
 *
 * There were six, and four of them were counts partitioning the same list
 * (total, active, worked with, leads): a distribution spread across four
 * headline numbers, none of which was a figure anyone acts on. The split now
 * lives in the tab strip, where picking one actually filters the table, and
 * the tiles carry the two money figures plus the two counts that frame them.
 */
export function BrandsStatCards({ stats }: BrandsStatCardsProps) {
  const cards: {
    label: string;
    value: string | number;
    note?: string;
    tone: (typeof STAT_TONES)[keyof typeof STAT_TONES];
    tab: BrandFilter;
  }[] = [
    {
      label: "Brands",
      value: stats.totalBrands,
      note: `${stats.working} worked with`,
      tone: STAT_TONES.neutral,
      tab: "all",
    },
    {
      label: "In pipeline",
      value: stats.pipeline,
      note: "not yet a deal",
      tone: STAT_TONES.info,
      tab: "pipeline",
    },
    { label: "Total revenue", value: formatMoney(stats.totalRevenue), tone: STAT_TONES.cash, tab: "working" },
    {
      label: "Pending payments",
      value: formatMoney(stats.pendingPayments),
      tone: STAT_TONES.amber,
      tab: "working",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <Link
          key={card.label}
          href={card.tab === "all" ? "/brands" : `/brands?tab=${card.tab}`}
          className="rounded-lg outline-offset-2 transition hover:ring-2 hover:ring-ring/30 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Card className={cn("h-full", card.tone.card)}>
            <CardHeader>
              <CardDescription>{card.label}</CardDescription>
              <CardTitle className={cn("text-lg tabular-nums", card.tone.value)}>{card.value}</CardTitle>
              {card.note && <p className="text-xs text-muted-foreground">{card.note}</p>}
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
