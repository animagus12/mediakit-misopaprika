import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EarningsOverview } from "@/components/dashboard/EarningsOverview";
import { PaymentsDueCard } from "@/components/dashboard/PaymentsDueCard";
import { NeedsAttentionCard } from "@/components/dashboard/NeedsAttentionCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { LastRefreshed } from "@/components/dashboard/LastRefreshed";
import { DashboardCampaignsSection } from "@/components/dashboard/DashboardCampaignsSection";
import { MoneyFlowCard } from "@/components/dashboard/MoneyFlowCard";
import { RevenueMixCard } from "@/components/dashboard/RevenueMixCard";
import { DealEconomicsCard } from "@/components/dashboard/DealEconomicsCard";
import { PaymentReliabilityCard } from "@/components/dashboard/PaymentReliabilityCard";
import { AudienceCard } from "@/components/dashboard/AudienceCard";
import { AffiliateAlertsCard } from "@/components/dashboard/AffiliateAlertsCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { WeekAheadCard } from "@/components/calendar/WeekAheadCard";
import { UsageRenewalsCard } from "@/components/campaigns/UsageRenewalsCard";
import { earningsRepository } from "@/repositories/earnings";
import { campaignRepository } from "@/repositories/campaignRepository";
import { fetchBrandCampaignRecords } from "@/repositories/brandCampaigns";
import { getAgencies } from "@/repositories/agencies.writer.server";
import { getEditors } from "@/repositories/editors.writer.server";
import { getBrands } from "@/repositories/brands.writer.server";
import { getContacts } from "@/repositories/contacts.writer.server";
import { getInvoices } from "@/repositories/invoices.writer.server";
import { getEditorTransactions } from "@/repositories/editorTransactions.writer.server";
import { getLinksAnalytics } from "@/repositories/linkStats.server";
import { getLinksData } from "@/repositories/links.writer.server";
import { getMediaKitUniqueVisitors, getMediaKitViews } from "@/lib/cache";
import { splitCampaigns, buildCampaignBrandOptions } from "@/lib/campaigns";
import { buildEditorVideoOptions } from "@/lib/contentPlan";
import { selectDuePayments, selectPortfolioReliability } from "@/lib/brandCampaignStats";
import {
  buildInvoiceEditorJobOptions,
  computeInvoiceMarginTotals,
  computeInvoiceStats,
} from "@/lib/invoice";
import { computeEditorPayouts, computeMonthlyEditorCost } from "@/lib/editorTransactions";
import { computeMarginSeries, currentMonthKey } from "@/lib/earnings";
import { computeCollectionLag, computeMonthForecast } from "@/lib/cashTiming";
import { computeRateRealization, toRateCard } from "@/lib/rateCard";
import { computeFallthroughRate, computePipelineValue } from "@/lib/dealFlow";
import { computeRevenueMix } from "@/lib/revenueMix";
import { mediakitRepository } from "@/repositories/mediakit";
import { linksSummary } from "@/lib/linkStats";
import { selectAttentionItems } from "@/lib/dashboardAttention";
import { selectAffiliateAlerts } from "@/lib/affiliates";
import { getAffiliatePartners } from "@/repositories/affiliatePartners.writer.server";
import { getAffiliatePayouts } from "@/repositories/affiliatePayouts.writer.server";
import {
  selectScheduledPosts,
  selectUnscheduledPosts,
  selectWeekAhead,
} from "@/lib/contentCalendar";
import { selectExpiringUsage, selectOwedRenewals } from "@/lib/usageRights";
import { listActivities } from "@/repositories/activity.writer.server";
import { getContentItems } from "@/repositories/contentPlan.writer.server";

// The shell (title, sync status, quick actions) paints immediately; each
// data-backed section streams in behind its own <Suspense> so the slowest
// fetch (the campaign records) never holds up the rest of the page.
export default function HomePage() {
  return (
    <div className="mx-auto max-w-screen-lg xl:max-w-6xl 2xl:max-w-[1440px] px-4 py-10">
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

      <Suspense fallback={<Skeleton className="mb-8 h-32 w-full rounded-lg" />}>
        <UsageRenewalsSection />
      </Suspense>

      <Suspense fallback={null}>
        <AffiliateAlertsSection />
      </Suspense>

      <Suspense fallback={<Skeleton className="mb-8 h-40 w-full rounded-lg" />}>
        <WeekAheadSection />
      </Suspense>

      <Suspense fallback={<Skeleton className="mb-8 h-72 w-full rounded-lg" />}>
        <EarningsSection />
      </Suspense>

      <Suspense fallback={<StatRowSkeleton />}>
        <MoneyFlowSection />
      </Suspense>

      {/* Money in and out says how much there is; these two say what kind of
          income it is and what deals actually sell for. One boundary, since
          they come out of one read of the campaign records. */}
      <Suspense fallback={<StatRowSkeleton />}>
        <BusinessMixSection />
      </Suspense>

      <Suspense fallback={<Skeleton className="mb-8 h-32 w-full rounded-lg" />}>
        <PaymentReliabilitySection />
      </Suspense>

      <Suspense fallback={<Skeleton className="mb-8 h-48 w-full rounded-lg" />}>
        <DashboardCampaignsContainer />
      </Suspense>

      <Suspense fallback={<StatRowSkeleton />}>
        <AudienceSection />
      </Suspense>

      <Suspense fallback={<Skeleton className="mb-8 h-64 w-full rounded-lg" />}>
        <RecentActivitySection />
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

// The lag comes out of the same records the due list does: it is the history
// behind those timers, and reading the campaigns a second time to compute one
// number about rows already in hand would be a fetch to save an import.
async function PaymentsAttentionSection() {
  const [records, invoices] = await Promise.all([
    fetchBrandCampaignRecords().catch(() => []),
    getInvoices().catch(() => []),
  ]);
  return (
    <>
      <PaymentsDueCard
        due={selectDuePayments(records)}
        lag={computeCollectionLag(records)}
        className="mb-8"
      />
      <NeedsAttentionCard items={selectAttentionItems(records, invoices)} className="mb-8" />
    </>
  );
}

// Licences about to run out, and the renewal money they brought in that is
// still owed. Sits directly under the payments card, so everything owed and
// every decision waiting is on one screen. Renders nothing when neither
// applies: unlike the week ahead, silence here is unambiguous, since a licence
// with nothing to decide is not a licence that was forgotten.
async function UsageRenewalsSection() {
  const now = new Date();
  const campaigns = await campaignRepository.getAll().catch(() => []);
  return (
    <UsageRenewalsCard
      alerts={selectExpiringUsage(campaigns, now)}
      owed={selectOwedRenewals(campaigns, now)}
      href="/campaigns"
      className="mb-8"
    />
  );
}

// What has to go out in the next week, and anything already past its day.
//
// A clear week collapses to one line rather than disappearing: the backlog
// count is what makes that line honest, since "nothing to publish" means the
// work is done only when nothing is also waiting to be given a day.
async function WeekAheadSection() {
  const now = new Date();
  const [campaigns, contentItems] = await Promise.all([
    campaignRepository.getAll().catch(() => []),
    getContentItems().catch(() => []),
  ]);
  return (
    <WeekAheadCard
      posts={selectWeekAhead(selectScheduledPosts(campaigns, contentItems, now))}
      waitingCount={selectUnscheduledPosts(campaigns, contentItems, now).length}
      emptyState="line"
      href="/calendar"
      className="mb-8"
    />
  );
}

// The actuals, the forecast that finishes the month in progress, and what the
// editing took out of each month. The two extra stores degrade to an empty
// list rather than taking the section down: a missing forecast is a quieter
// failure than a missing earnings block, and both are derived from the
// summary that has already loaded.
async function EarningsSection() {
  const [earnings, campaigns, editorTransactions] = await Promise.all([
    earningsRepository.getSummary().catch(() => null),
    campaignRepository.getAll().catch(() => []),
    getEditorTransactions().catch(() => []),
  ]);
  if (!earnings) return null;

  const thisMonth = earnings.monthly.find((month) => month.month === currentMonthKey());
  return (
    <EarningsOverview
      summary={earnings}
      forecast={computeMonthForecast(campaigns, thisMonth?.total ?? 0)}
      margins={computeMarginSeries(earnings.monthly, computeMonthlyEditorCost(editorTransactions))}
    />
  );
}

// What kind of income this is, and what deals actually close at.
//
// The rate card is read from the media kit rather than typed here: it is the
// number the creator publishes and revises, and a second copy of it would be
// the copy that goes stale the first time the real one moves.
async function BusinessMixSection() {
  const [campaigns, earnings] = await Promise.all([
    campaignRepository.getAll().catch(() => []),
    earningsRepository.getSummary().catch(() => null),
  ]);
  if (campaigns.length === 0) return null;

  return (
    <>
      {earnings && (
        <RevenueMixCard mix={computeRevenueMix(campaigns, earnings)} className="mb-8" />
      )}
      <DealEconomicsCard
        realization={computeRateRealization(campaigns, toRateCard(mediakitRepository.get()))}
        pipeline={computePipelineValue(campaigns)}
        fallthrough={computeFallthroughRate(campaigns)}
        className="mb-8"
      />
    </>
  );
}

// Owed in, owed out, and what the edit cost. Three stores, each degrading to
// an empty list rather than taking the section down: a missing editor payout
// is a wrong figure, but a blank dashboard is a broken one.
async function MoneyFlowSection() {
  const [invoices, editorTransactions] = await Promise.all([
    getInvoices().catch(() => []),
    getEditorTransactions().catch(() => []),
  ]);
  return (
    <MoneyFlowCard
      invoices={computeInvoiceStats(invoices)}
      payouts={computeEditorPayouts(editorTransactions)}
      margins={computeInvoiceMarginTotals(invoices, buildInvoiceEditorJobOptions(editorTransactions))}
      className="mb-8"
    />
  );
}

// Late commission and codes that have stopped selling. Every store degrades
// to empty rather than taking the section down, and the card renders nothing
// when there is nothing to chase, which is why its fallback is null rather
// than a skeleton: a placeholder for a card that usually does not appear
// would make the dashboard flicker on every load.
async function AffiliateAlertsSection() {
  const [partners, payouts, analytics] = await Promise.all([
    getAffiliatePartners().catch(() => []),
    getAffiliatePayouts().catch(() => []),
    getLinksAnalytics().catch(() => ({ views: 0, uniqueVisitors: 0, clicksByItem: {} })),
  ]);
  return (
    <AffiliateAlertsCard
      alerts={selectAffiliateAlerts(partners, payouts, analytics.clicksByItem)}
      className="mb-8"
    />
  );
}

// Renders nothing until some brand has enough payments to rate, so an early
// book is not handed a verdict it has not earned.
async function PaymentReliabilitySection() {
  const records = await fetchBrandCampaignRecords().catch(() => []);
  return <PaymentReliabilityCard portfolio={selectPortfolioReliability(records)} className="mb-8" />;
}

// The counters behind both public pages. linksSummary needs the published
// links alongside the analytics, since it sums clicks over the links that
// still exist rather than every id the store has ever seen.
async function AudienceSection() {
  const [mediaKitViews, mediaKitVisitors, linksData, linksAnalytics] = await Promise.all([
    getMediaKitViews(),
    getMediaKitUniqueVisitors(),
    getLinksData(),
    getLinksAnalytics(),
  ]);
  return (
    <AudienceCard
      mediaKit={{ views: mediaKitViews, uniqueVisitors: mediaKitVisitors }}
      links={linksSummary(linksData, linksAnalytics)}
      className="mb-8"
    />
  );
}

async function DashboardCampaignsContainer() {
  let active: ReturnType<typeof splitCampaigns>["active"] = [];
  let error: string | null = null;
  try {
    ({ active } = splitCampaigns(await campaignRepository.getAll()));
  } catch (err) {
    error = err instanceof Error ? err.message : "Something went wrong";
  }
  const [brands, editorTransactions, contentItems] = await Promise.all([
    getBrands().catch(() => []),
    getEditorTransactions().catch(() => []),
    getContentItems().catch(() => []),
  ]);
  return (
    <DashboardCampaignsSection
      active={active}
      error={error}
      brandOptions={buildCampaignBrandOptions(brands)}
      videoOptions={buildEditorVideoOptions(editorTransactions, [...contentItems, ...active])}
    />
  );
}

// listActivities answers an empty page rather than throwing, so this needs
// no catch of its own, and the card renders nothing on an empty log.
async function RecentActivitySection() {
  const { items } = await listActivities({ limit: 6 });
  return <RecentActivityCard activities={items} className="mb-8" />;
}

// One row of stat tiles, at the two column counts the tile grids use.
function StatRowSkeleton() {
  return (
    <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-20 rounded-lg" />
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
