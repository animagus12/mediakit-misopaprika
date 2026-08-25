import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { MediaKitGenerator } from "@/components/mediakit/MediaKitGenerator";
import { getMediaKitUniqueVisitors, getMediaKitViews } from "@/lib/cache";
import { getMediaKitData } from "@/repositories/mediakit.writer.server";

export const metadata: Metadata = {
  title: "Media kit generator - @misopaprika",
  robots: { index: false, follow: false },
};

export default async function MediaKitGeneratorPage() {
  const [data, viewCount, uniqueVisitors] = await Promise.all([
    getMediaKitData(),
    getMediaKitViews(),
    getMediaKitUniqueVisitors(),
  ]);
  return (
    <AppShell>
      <MediaKitGenerator data={data} viewCount={viewCount} uniqueVisitors={uniqueVisitors} />
    </AppShell>
  );
}
