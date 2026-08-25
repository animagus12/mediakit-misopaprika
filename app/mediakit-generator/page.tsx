import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { MediaKitGenerator } from "@/components/mediakit/MediaKitGenerator";
import { getMediaKitUniqueVisitors, getMediaKitViews } from "@/lib/cache";
import { mediakitRepository } from "@/repositories/mediakit";

export const metadata: Metadata = {
  title: "Media kit generator - @misopaprika",
  robots: { index: false, follow: false },
};

export default async function MediaKitGeneratorPage() {
  const data = mediakitRepository.get();
  const [viewCount, uniqueVisitors] = await Promise.all([
    getMediaKitViews(),
    getMediaKitUniqueVisitors(),
  ]);
  return (
    <AppShell>
      <MediaKitGenerator data={data} viewCount={viewCount} uniqueVisitors={uniqueVisitors} />
    </AppShell>
  );
}
