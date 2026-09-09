import { ExternalLink, MousePointerClick, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatMoney } from "@/lib/invoice";
import { AFFILIATE_STATUS_LABELS, PAYOUT_SCHEDULE_LABELS } from "@/lib/affiliates";
import type { PartnerPerformance } from "@/lib/affiliates";
import { cn } from "@/lib/utils";
import type { AffiliateStatus } from "@/repositories/affiliatePartners";
import { EditPartnerSheet } from "./EditPartnerSheet";
import type { BrandOption, LinkItemOption } from "./PartnerFormFields";

// Raw palette hues at low opacity, the destructive-variant convention used
// across the app: globals.css has no success or warning token.
const STATUS_STYLES: Record<AffiliateStatus, string> = {
  active:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  paused:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  ended: "border-dashed text-muted-foreground",
};

function Figure({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string | null;
  tone?: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[0.65rem] tracking-wide text-muted-foreground/70 uppercase">{label}</p>
      <p className={cn("text-sm font-semibold tabular-nums", tone)}>{value}</p>
      {hint && <p className="text-[0.65rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface PartnerCardProps {
  performance: PartnerPerformance;
  brands: BrandOption[];
  linkItems: LinkItemOption[];
}

export function PartnerCard({ performance, brands, linkItems }: PartnerCardProps) {
  const { partner, received, pending, salesCount, clicks, conversionPercent, earningsPerClick } =
    performance;

  const terms =
    partner.commissionRate > 0
      ? partner.commissionModel === "percent"
        ? `${partner.commissionRate}% of sales`
        : `${formatMoney(partner.commissionRate)} per sale`
      : "No rate recorded";

  return (
    <Card className="gap-0">
      <CardHeader className="gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="truncate font-heading text-sm font-semibold">{partner.name}</h3>
              <Badge variant="outline" className={cn("h-4 px-1.5 text-[0.6rem]", STATUS_STYLES[partner.status])}>
                {AFFILIATE_STATUS_LABELS[partner.status]}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
                {partner.code}
              </code>
              <span className="ml-1.5">
                {terms} · {PAYOUT_SCHEDULE_LABELS[partner.payoutSchedule]}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            {partner.dashboardUrl && (
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
              >
                <a
                  href={partner.dashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open the ${partner.name} dashboard`}
                >
                  <ExternalLink />
                </a>
              </Button>
            )}
            <EditPartnerSheet partner={partner} brands={brands} linkItems={linkItems}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Edit ${partner.name}`}
              >
                <Pencil />
              </Button>
            </EditPartnerSheet>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 sm:grid-cols-4">
        <Figure
          label="Received"
          value={formatMoney(received)}
          tone="text-violet-600 dark:text-violet-400"
        />
        <Figure
          label="Pending"
          value={formatMoney(pending)}
          tone={pending > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
        />
        <Figure label="Orders" value={String(salesCount)} />
        {/* The join with the links page is what makes this figure possible at
            all: the brand's own dashboard knows the sales and not the clicks.
            Without a linked card there is nothing honest to show, so the tile
            says why rather than showing a zero. */}
        {partner.linkItemId ? (
          <Figure
            label="Converts"
            value={conversionPercent === null ? "-" : `${conversionPercent.toFixed(1)}%`}
            hint={
              earningsPerClick !== null && earningsPerClick > 0
                ? `${formatMoney(earningsPerClick)} per click`
                : `${clicks} click${clicks === 1 ? "" : "s"}`
            }
          />
        ) : (
          <Figure label="Converts" value="-" hint="No links card" />
        )}
      </CardContent>

      {partner.linkItemId && clicks > 0 && (
        <CardContent className="pt-3">
          <p className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
            <MousePointerClick className="size-3 shrink-0" />
            {clicks} lifetime click{clicks === 1 ? "" : "s"} on the links card, against {salesCount}{" "}
            recorded order{salesCount === 1 ? "" : "s"}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
