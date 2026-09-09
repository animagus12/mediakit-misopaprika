import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { AffiliatesSection } from "@/components/affiliates/AffiliatesSection";
import type { BrandOption, LinkItemOption } from "@/components/affiliates/PartnerFormFields";
import { sortPayoutsByPeriod } from "@/lib/affiliates";
import { getAffiliatePartners } from "@/repositories/affiliatePartners.writer.server";
import { getAffiliatePayouts } from "@/repositories/affiliatePayouts.writer.server";
import { getBrands } from "@/repositories/brands.writer.server";
import { getLinksAnalytics } from "@/repositories/linkStats.server";
import { getLinksData } from "@/repositories/links.writer.server";
import type { LinksData } from "@/repositories/links";
import type { AffiliatePartner } from "@/repositories/affiliatePartners";
import type { AffiliatePayout } from "@/repositories/affiliatePayouts";

export const metadata: Metadata = {
  title: "Affiliates - @misopaprika",
  robots: { index: false, follow: false },
};

// Same reason /calendar and /campaigns carry this: the page is invalidated by
// the clock as well as by a write. Nothing is written when a payout crosses
// its expected arrival date, but the row starts saying "overdue" and a cached
// render would keep saying "pending".
export const dynamic = "force-dynamic";

/**
 * Every card on the links page, flattened for the partner form's picker.
 *
 * Read from the editor's own draft, not from the bundled data/links.json seed:
 * the seed is only the fallback for a store that has never been written, so
 * reading it would offer a list frozen at whatever shipped with the build and
 * silently omit every card added since.
 *
 * Every card is offered rather than only kind "code" ones. An affiliate link
 * is not always modelled as a code card, and a picker that quietly hides the
 * card someone is looking for is worse than one with a few extra rows in it.
 * Code-bearing cards sort first, since those are the usual answer.
 *
 * Kept in the page rather than the form, so the form never walks the links
 * tree itself.
 */
function linkItemOptions(data: LinksData): LinkItemOption[] {
  const options: (LinkItemOption & { isCode: boolean })[] = [];
  for (const section of data.sections) {
    for (const item of section.items) {
      options.push({
        id: item.id,
        label: item.label || item.code || item.id,
        section: section.title || "Untitled section",
        isCode: item.kind === "code" || item.code.trim() !== "",
      });
    }
  }
  return options
    .sort((a, b) => Number(b.isCode) - Number(a.isCode))
    .map(({ id, label, section }) => ({ id, label, section }));
}

export default async function AffiliatesPage() {
  let partners: AffiliatePartner[] = [];
  let payouts: AffiliatePayout[] = [];
  let error: string | null = null;
  try {
    [partners, payouts] = await Promise.all([getAffiliatePartners(), getAffiliatePayouts()]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Something went wrong";
  }

  // The pickers and the click counters. A failure to read any of them costs
  // one <Select> or one figure rather than the page, so each is caught
  // separately from the two stores the page is actually about.
  const [brands, analytics, links] = await Promise.all([
    getBrands().catch(() => []),
    getLinksAnalytics().catch(() => ({ views: 0, uniqueVisitors: 0, clicksByItem: {} })),
    getLinksData().catch(() => ({ profile: { displayName: "", tagline: "", socials: [] }, sections: [] })),
  ]);

  const brandOptions: BrandOption[] = brands.map((brand) => ({ id: brand.id, name: brand.name }));

  return (
    <AppShell>
      <div className="mx-auto max-w-screen-lg xl:max-w-6xl 2xl:max-w-[1440px] space-y-8 px-4 py-10">
        <AffiliatesSection
          partners={partners}
          payouts={sortPayoutsByPeriod(payouts)}
          clicksByItem={analytics.clicksByItem}
          brands={brandOptions}
          linkItems={linkItemOptions(links)}
          error={error}
        />
      </div>
    </AppShell>
  );
}
