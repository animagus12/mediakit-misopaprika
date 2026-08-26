import type { VariantProps } from "class-variance-authority";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/invoice";
import type { BrandCampaignRecord } from "@/repositories/brandCampaigns";
import type { CampaignContact } from "@/repositories/campaignContacts";
import type { Contact } from "@/repositories/contacts";
import { CampaignContactSheet } from "./CampaignContactSheet";

interface StatusStyle {
  variant: VariantProps<typeof badgeVariants>["variant"];
  className?: string;
}

// Same pipeline vocabulary as components/dashboard/CollaborationsSection.tsx
// — duplicated rather than imported cross-feature, matching how that status
// styling is already duplicated per-surface elsewhere in the app.
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
    default:
      return { variant: "secondary" };
  }
}

interface BrandCampaignsTabProps {
  brandId: string;
  records: BrandCampaignRecord[];
  contacts: Contact[]; // this brand's contacts (direct + its agency's)
  campaignContacts: CampaignContact[]; // this brand's campaign→contact assignments
}

export function BrandCampaignsTab({ brandId, records, contacts, campaignContacts }: BrandCampaignsTabProps) {
  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-xs text-muted-foreground">
          No campaigns from the sheet matched this brand&apos;s name yet.
        </CardContent>
      </Card>
    );
  }

  const contactIdByCampaignId = new Map(campaignContacts.map((cc) => [cc.campaignId, cc.contactId]));

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead>Campaign</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Deliverables</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => {
            const status = statusStyle(record.status);
            const key = record.campaignId || `${record.campaign}-${record.date}`;
            return (
              <TableRow key={key}>
                <TableCell className="max-w-40 truncate font-medium">{record.campaign || "—"}</TableCell>
                <TableCell className="min-w-32">
                  {record.campaignId ? (
                    <CampaignContactSheet
                      campaignId={record.campaignId}
                      campaignName={record.campaign}
                      brandId={brandId}
                      contactId={contactIdByCampaignId.get(record.campaignId) ?? null}
                      contacts={contacts}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{record.date || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{record.deliverables || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(record.total)}</TableCell>
                <TableCell>
                  <Badge variant={status.variant} className={status.className}>
                    {record.status || "Unknown"}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
