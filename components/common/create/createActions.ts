import { Building2, CalendarPlus, Clapperboard, FileText, Handshake, ReceiptText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CampaignBrandOption } from "@/lib/campaigns";
import type { EditorVideoOption } from "@/lib/contentPlan";
import type { ExpenseFormDefaults } from "@/lib/expenseForm";
import type { ExpenseDealOption } from "@/lib/expenses";
import type { Agency } from "@/repositories/agencies";
import type { Contact } from "@/repositories/contacts";
import type { Editor } from "@/repositories/editors";

/** A form the New menu opens in place, over whatever page is showing. */
export type CreateKind = "campaign" | "expense" | "post" | "brand" | "editorJob";

interface CreateActionBase {
  id: string;
  label: string;
  /** One line under the label where there is room for it: the phone's create sheet. */
  description: string;
  Icon: LucideIcon;
  /** Items are separated where this changes. */
  section: "deal" | "money" | "plan";
}

export type CreateAction =
  | (CreateActionBase & { kind: CreateKind; href?: never })
  // Invoices are written on a page of their own, not in a sheet.
  | (CreateActionBase & { href: string; kind?: never });

// The one list both the desktop New menu and the phone's create sheet draw
// from, so the two never offer different things.
export const createActions: CreateAction[] = [
  {
    id: "campaign",
    kind: "campaign",
    label: "New campaign",
    description: "Paid deal, barter or UGC ad",
    Icon: Handshake,
    section: "deal",
  },
  {
    id: "invoice",
    href: "/invoices/new",
    label: "New invoice",
    description: "From a campaign or blank",
    Icon: FileText,
    section: "deal",
  },
  {
    id: "expense",
    kind: "expense",
    label: "Add expense",
    description: "Props, travel, tools",
    Icon: ReceiptText,
    section: "money",
  },
  {
    id: "post",
    kind: "post",
    label: "Plan a post",
    description: "A reel or story on the calendar",
    Icon: CalendarPlus,
    section: "plan",
  },
  {
    id: "brand",
    kind: "brand",
    label: "Add brand",
    description: "With its contacts and agency",
    Icon: Building2,
    section: "plan",
  },
  {
    id: "editorJob",
    kind: "editorJob",
    label: "Editing job",
    description: "A video handed to an editor",
    Icon: Clapperboard,
    section: "plan",
  },
];

/** Everything the create forms offer to pick from, read once per page by the shell. */
export interface CreateMenuData {
  campaignBrandOptions: CampaignBrandOption[];
  videoOptions: EditorVideoOption[];
  agencies: Agency[];
  contacts: Contact[];
  editors: Editor[];
  expenseDealOptions: ExpenseDealOption[];
  expenseDefaults: ExpenseFormDefaults;
}
