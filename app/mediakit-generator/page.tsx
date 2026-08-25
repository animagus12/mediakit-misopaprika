import type { Metadata } from "next";
import { MediaKitGenerator } from "@/components/mediakit/MediaKitGenerator";
import { getMediaKitViews } from "@/lib/cache";
import { mediakitRepository } from "@/repositories/mediakit";

export const metadata: Metadata = {
  title: "Media kit generator - @misopaprika",
  robots: { index: false, follow: false },
};

export default async function MediaKitGeneratorPage() {
  const data = mediakitRepository.get();
  const viewCount = await getMediaKitViews();
  return <MediaKitGenerator data={data} viewCount={viewCount} />;
}
