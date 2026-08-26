import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { MediaKitGenerator } from "@/components/mediakit/MediaKitGenerator";
import { getMediaKitUniqueVisitors, getMediaKitViews } from "@/lib/cache";
import { brandLogosForMediaKit } from "@/lib/brands";
import { getMediaKitData } from "@/repositories/mediakit.writer.server";
import { getBrands } from "@/repositories/brands.writer.server";

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
  return (
    <AppShell>
      <MediaKitGenerator
        data={data}
        viewCount={viewCount}
        uniqueVisitors={uniqueVisitors}
        brandLogos={brandLogosForMediaKit(brands)}
      />
    </AppShell>
  );
}
