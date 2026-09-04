import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewCampaignButton } from "@/components/campaigns/NewCampaignButton";
import { NewBrandButton } from "@/components/brands/NewBrandButton";
import { NewEditorTransactionButton } from "@/components/workspace/NewEditorTransactionButton";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { Agency } from "@/repositories/agencies";
import type { Contact } from "@/repositories/contacts";
import type { Editor } from "@/repositories/editors";

interface QuickActionsProps {
  agencies: Agency[];
  contacts: Contact[];
  editors: Editor[];
  campaignBrandOptions?: CampaignBrandOption[];
  className?: string;
}

// One row that starts work from the dashboard instead of navigating to the
// section first. New campaign leads — it's the most important add-action on
// the site, so it lives here at the top rather than inside the Campaigns
// section further down. The rest are the same create-sheets used on
// /brands and /workspace, plus a link into the full-page invoice editor.
export function QuickActions({ agencies, contacts, editors, campaignBrandOptions, className }: QuickActionsProps) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <NewCampaignButton brandOptions={campaignBrandOptions} />
        <Button asChild size="sm" variant="outline">
          <Link href="/invoices/new">
            <FileText />
            New invoice
          </Link>
        </Button>
        <NewBrandButton agencies={agencies} contacts={contacts} variant="outline" />
        <NewEditorTransactionButton editors={editors} />
      </div>
    </div>
  );
}
