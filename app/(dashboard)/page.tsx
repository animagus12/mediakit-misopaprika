import { Suspense } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EarningsOverview } from "@/components/dashboard/EarningsOverview";
import { PaymentsDueCard } from "@/components/dashboard/PaymentsDueCard";
import { NeedsAttentionCard } from "@/components/dashboard/NeedsAttentionCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { LastRefreshed } from "@/components/dashboard/LastRefreshed";
import { DashboardCampaignsSection } from "@/components/dashboard/DashboardCampaignsSection";
import { navEntries } from "@/lib/navigation";
import { earningsRepository } from "@/repositories/earnings";
import { campaignRepository } from "@/repositories/campaignRepository";
import { fetchBrandCampaignRecords } from "@/repositories/brandCampaigns";
import { getAgencies } from "@/repositories/agencies.writer.server";
import { getEditors } from "@/repositories/editors.writer.server";
import { getBrands } from "@/repositories/brands.writer.server";
import { getContacts } from "@/repositories/contacts.writer.server";
import { getInvoices } from "@/repositories/invoices.writer.server";
import { getEditorTransactions } from "@/repositories/editorTransactions.writer.server";
import { splitCampaigns, buildCampaignBrandOptions } from "@/lib/campaigns";
import { selectDuePayments } from "@/lib/brandCampaignStats";
import { selectAttentionItems } from "@/lib/dashboardAttention";
import { buildDashboardNavBadges } from "@/lib/dashboardNav";

// The shell (title, sync status, quick actions) paints immediately; each
// data-backed section streams in behind its own <Suspense> so the slowest
// fetch (the campaign records) never holds up the rest of the page.
export default function HomePage() {
  return (
    <div className="mx-auto max-w-screen-lg px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-heading text-lg font-semibold">Dashboard</h1>
        <LastRefreshed loadedAtISO={new Date().toISOString()} />
      </div>

      <Suspense fallback={<QuickActionsSkeleton />}>
        <QuickActionsSection />
      </Suspense>

      <Suspense fallback={<Skeleton className="mb-8 h-36 w-full rounded-lg" />}>
        <PaymentsAttentionSection />
      </Suspense>

      <Suspense fallback={<Skeleton className="mb-8 h-72 w-full rounded-lg" />}>
        <EarningsSection />
      </Suspense>

      <Suspense fallback={<Skeleton className="mb-8 h-48 w-full rounded-lg" />}>
        <DashboardCampaignsContainer />
      </Suspense>

      <Suspense fallback={<NavCardsSkeleton />}>
        <NavCardsSection />
      </Suspense>
    </div>
  );
}

async function QuickActionsSection() {
  const [agencies, contacts, editors, brands] = await Promise.all([
    getAgencies().catch(() => []),
    getContacts().catch(() => []),
    getEditors().catch(() => []),
    getBrands().catch(() => []),
  ]);
  return (
    <QuickActions
      agencies={agencies}
      contacts={contacts}
      editors={editors}
      campaignBrandOptions={buildCampaignBrandOptions(brands)}
      className="mb-8"
    />
  );
}

async function PaymentsAttentionSection() {
  const [records, invoices] = await Promise.all([
    fetchBrandCampaignRecords().catch(() => []),
    getInvoices().catch(() => []),
  ]);
  return (
    <>
      <PaymentsDueCard due={selectDuePayments(records)} className="mb-8" />
      <NeedsAttentionCard items={selectAttentionItems(records, invoices)} className="mb-8" />
    </>
  );
}

async function EarningsSection() {
  const earnings = await earningsRepository.getSummary().catch(() => null);
  if (!earnings) return null;
  return <EarningsOverview summary={earnings} />;
}

async function DashboardCampaignsContainer() {
  let active: ReturnType<typeof splitCampaigns>["active"] = [];
  let past: ReturnType<typeof splitCampaigns>["past"] = [];
  let error: string | null = null;
  try {
    ({ active, past } = splitCampaigns(await campaignRepository.getAll()));
  } catch (err) {
    error = err instanceof Error ? err.message : "Something went wrong";
  }
  const brandOptions = buildCampaignBrandOptions(await getBrands().catch(() => []));
  return <DashboardCampaignsSection active={active} past={past} error={error} brandOptions={brandOptions} />;
}

async function NavCardsSection() {
  const [brands, contacts, invoices, editorTransactions] = await Promise.all([
    getBrands().catch(() => []),
    getContacts().catch(() => []),
    getInvoices().catch(() => []),
    getEditorTransactions().catch(() => []),
  ]);
  const navBadges = buildDashboardNavBadges({ invoices, brands, contacts, editorTransactions });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {navEntries.map(({ href, title, description, Icon, access }) => (
        <Link key={href} href={href} className="group">
          <Card className="h-full transition hover:ring-foreground/20">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" />
                  <CardTitle>{title}</CardTitle>
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              {access === "public" ? (
                <Badge variant="outline">Public</Badge>
              ) : (
                <Badge variant="secondary">Password protected</Badge>
              )}
              {navBadges[href] && (
                <Badge
                  variant="outline"
                  className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                >
                  {navBadges[href]}
                </Badge>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function QuickActionsSkeleton() {
  return (
    <div className="mb-8 flex flex-wrap gap-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-6 w-32 rounded-md" />
      ))}
    </div>
  );
}

function NavCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: navEntries.length }).map((_, index) => (
        <Skeleton key={index} className="h-28 rounded-lg" />
      ))}
    </div>
  );
}
