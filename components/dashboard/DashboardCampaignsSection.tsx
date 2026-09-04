import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { VariantProps } from "class-variance-authority";
import type { Campaign } from "@/repositories/campaigns";
import { computeCampaignStats, type CampaignBrandOption } from "@/lib/campaigns";
import { formatMoney } from "@/lib/invoice";
import { NewCampaignButton } from "@/components/campaigns/NewCampaignButton";
import { ActiveCampaignCard } from "./ActiveCampaignCard";

interface StatusStyle {
  variant: VariantProps<typeof badgeVariants>["variant"];
  className?: string;
}

// Each pipeline stage gets its own hue so the status is readable at a glance
// instead of everything collapsing into "outline" or "secondary".
function statusStyle(status: string): StatusStyle {
  switch (status.toLowerCase()) {
    case "completed":
      return {
        variant: "outline",
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
      };
    case "cancelled":
      return { variant: "destructive" };
    case "todo":
      return {
        variant: "outline",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
      };
    case "brainstorming":
      return {
        variant: "outline",
        className: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
      };
    case "ready to upload":
      return {
        variant: "outline",
        className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
      };
    case "in route":
      return {
        variant: "outline",
        className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
      };
    case "redacted":
      return { variant: "outline", className: "border-dashed text-muted-foreground/70" };
    default:
      return { variant: "secondary" };
  }
}

interface DashboardCampaignsSectionProps {
  active: Campaign[];
  past: Campaign[];
  error?: string | null;
  brandOptions?: CampaignBrandOption[];
}

export function DashboardCampaignsSection({ active, past, error, brandOptions = [] }: DashboardCampaignsSectionProps) {
  if (error) {
    return (
      <section className="mb-8">
        <SectionHeader brandOptions={brandOptions} />
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            Couldn&apos;t load campaigns — {error}
          </CardContent>
        </Card>
      </section>
    );
  }

  const stats = computeCampaignStats([...active, ...past]);

  return (
    <section className="mb-8 space-y-4">
      <SectionHeader brandOptions={brandOptions} />

      {stats.total > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Total campaigns</CardDescription>
              <CardTitle className="text-lg">{stats.total}</CardTitle>
              {stats.cancelled > 0 && (
                <p className="text-xs text-muted-foreground">{stats.cancelled} cancelled</p>
              )}
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Paid campaigns</CardDescription>
              <CardTitle className="text-lg">{stats.paid}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Barter campaigns</CardDescription>
              <CardTitle className="text-lg">{stats.barter}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Highest-value campaign</CardDescription>
              <CardTitle className="text-lg">
                {stats.highestValue ? formatMoney(stats.highestValue.total) : "—"}
              </CardTitle>
              {stats.highestValue && (
                <p className="truncate text-xs text-muted-foreground">
                  {stats.highestValue.brand}
                </p>
              )}
            </CardHeader>
          </Card>
        </div>
      )}

      {active.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-xs text-muted-foreground">
            No active or upcoming campaigns right now.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((campaign) => (
            <ActiveCampaignCard key={campaign.id} campaign={campaign} brandOptions={brandOptions} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="group/trigger flex w-full items-center justify-between rounded-md border border-border px-4 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted">
            Past campaigns ({past.length})
            <ChevronDown className="size-3.5 transition group-data-[state=open]/trigger:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 overflow-hidden rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead>Brand</TableHead>
                  <TableHead>Reels</TableHead>
                  <TableHead>Story</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {past.map((campaign) => {
                  const status = statusStyle(campaign.status);
                  return (
                  <TableRow key={campaign.id}>
                    <TableCell className="max-w-40 truncate font-medium">{campaign.brand}</TableCell>
                    <TableCell className="text-muted-foreground">{campaign.reels || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{campaign.story || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{campaign.date || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className={status.className}>
                        {campaign.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}

function SectionHeader({ brandOptions }: { brandOptions: CampaignBrandOption[] }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="space-y-1">
        <h2 className="font-heading text-sm font-semibold">Campaigns</h2>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/campaigns">View all</Link>
        </Button>
        <NewCampaignButton brandOptions={brandOptions} />
      </div>
    </div>
  );
}
