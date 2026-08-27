import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { MediaKitGenerator } from "@/components/mediakit/MediaKitGenerator";
import { getMediaKitUniqueVisitors, getMediaKitViews } from "@/lib/cache";
import { brandLogosForMediaKit } from "@/lib/brands";
import { getMediaKitData } from "@/repositories/mediakit.writer.server";
import { getBrands } from "@/repositories/brands.writer.server";
import { getInvoices } from "@/repositories/invoices.writer.server";

export const metadata: Metadata = {
  title: "Edit Media kit - @misopaprika",
  robots: { index: false, follow: false },
};

export default async function MediaKitGeneratorPage() {
  const [data, viewCount, uniqueVisitors, brands] = await Promise.all([
    getMediaKitData(),
    getMediaKitViews(),
    getMediaKitUniqueVisitors(),
    getBrands(),
  ]);

  // A brand with a paid invoice counts as a real past collab even if its
  // pipeline status wasn't updated by hand. Best-effort — no invoices just
  // means eligibility falls back to status alone.
  let paidBrandIds = new Set<string>();
  try {
    const invoices = await getInvoices();
    paidBrandIds = new Set(
      invoices
        .filter((invoice) => invoice.status === "paid" && invoice.brandId)
        .map((invoice) => invoice.brandId as string)
    );
  } catch {
    // keep the empty set
  }

  return (
    <AppShell>
      <MediaKitGenerator
        data={data}
        viewCount={viewCount}
        uniqueVisitors={uniqueVisitors}
        brandLogos={brandLogosForMediaKit(brands, paidBrandIds)}
      />
    </AppShell>
  );
}
