import Link from "next/link";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewCollaborationButton } from "./NewCollaborationButton";
import { NewBrandButton } from "@/components/brands/NewBrandButton";
import { NewEditorTransactionButton } from "@/components/workspace/NewEditorTransactionButton";
import type { Agency } from "@/repositories/agencies";
import type { Editor } from "@/repositories/editors";

interface QuickActionsProps {
  agencies: Agency[];
  editors: Editor[];
  className?: string;
}

// One row that starts work from the dashboard instead of navigating to the
// section first — the same create-sheets used on /brands and /workspace,
// plus a link into the full-page invoice editor. New collaboration keeps its
// own copy in the Collaborations section header too; the rest live only here.
export function QuickActions({ agencies, editors, className }: QuickActionsProps) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <NewCollaborationButton />
        <Button asChild size="sm" variant="outline">
          <Link href="/invoices/new">
            <FileText />
            New invoice
          </Link>
        </Button>
        <NewBrandButton agencies={agencies} />
        <NewEditorTransactionButton editors={editors} />
      </div>
    </div>
  );
}
