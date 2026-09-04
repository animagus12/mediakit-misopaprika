import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewCampaignButton } from "@/components/campaigns/NewCampaignButton";
import { NewBrandButton } from "@/components/brands/NewBrandButton";
import { NewEditorTransactionButton } from "@/components/workspace/NewEditorTransactionButton";
import type { Agency } from "@/repositories/agencies";
import type { Contact } from "@/repositories/contacts";
import type { Editor } from "@/repositories/editors";

interface QuickActionsProps {
  agencies: Agency[];
  contacts: Contact[];
  editors: Editor[];
  className?: string;
}

// One row that starts work from the dashboard instead of navigating to the
// section first — the same create-sheets used on /brands and /workspace,
// plus a link into the full-page invoice editor. New campaign keeps its own
// copy in the Campaigns section header too; the rest live only here.
export function QuickActions({ agencies, contacts, editors, className }: QuickActionsProps) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <NewCampaignButton />
        <Button asChild size="sm" variant="outline">
          <Link href="/invoices/new">
            <FileText />
            New invoice
          </Link>
        </Button>
        <NewBrandButton agencies={agencies} contacts={contacts} />
        <NewEditorTransactionButton editors={editors} />
      </div>
    </div>
  );
}
