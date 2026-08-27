import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandCampaignsTab } from "./BrandCampaignsTab";
import { BrandContactsTab } from "./BrandContactsTab";
import { BrandInvoicesTab } from "./BrandInvoicesTab";
import { BrandNotesTab } from "./BrandNotesTab";
import { BrandOverviewTab } from "./BrandOverviewTab";
import { BrandPaymentsTab } from "./BrandPaymentsTab";
import type { BrandStats } from "@/lib/brandCampaignStats";
import type { InvoiceEditorJobOption } from "@/lib/invoice";
import type { Agency } from "@/repositories/agencies";
import type { BrandCampaignRecord } from "@/repositories/brandCampaigns";
import type { BrandNote } from "@/repositories/brandNotes";
import type { Brand } from "@/repositories/brands";
import type { CampaignContact } from "@/repositories/campaignContacts";
import type { Contact } from "@/repositories/contacts";
import type { Invoice } from "@/repositories/invoices";

interface BrandTabsSectionProps {
  brand: Brand;
  agency: Agency | null;
  contacts: Contact[];
  records: BrandCampaignRecord[];
  campaignContacts: CampaignContact[];
  stats: BrandStats;
  notes: BrandNote[];
  invoices: Invoice[]; // already scoped to this brand
  editorJobs: InvoiceEditorJobOption[];
}

export function BrandTabsSection({
  brand,
  agency,
  contacts,
  records,
  campaignContacts,
  stats,
  notes,
  invoices,
  editorJobs,
}: BrandTabsSectionProps) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="contacts">Contacts</TabsTrigger>
        <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="pt-4">
        <BrandOverviewTab brand={brand} agency={agency} />
      </TabsContent>
      <TabsContent value="contacts" className="pt-4">
        <BrandContactsTab
          brandId={brand.id}
          agencyId={brand.agencyId}
          agencyName={agency?.name ?? null}
          contacts={contacts}
        />
      </TabsContent>
      <TabsContent value="campaigns" className="pt-4">
        <BrandCampaignsTab brandId={brand.id} records={records} contacts={contacts} campaignContacts={campaignContacts} />
      </TabsContent>
      <TabsContent value="payments" className="pt-4">
        <BrandPaymentsTab stats={stats} records={records} invoices={invoices} />
      </TabsContent>
      <TabsContent value="invoices" className="pt-4">
        <BrandInvoicesTab brandId={brand.id} invoices={invoices} editorJobs={editorJobs} />
      </TabsContent>
      <TabsContent value="notes" className="pt-4">
        <BrandNotesTab brandId={brand.id} notes={notes} />
      </TabsContent>
    </Tabs>
  );
}
