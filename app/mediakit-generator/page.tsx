import type { Metadata } from "next";
import { MediaKitGenerator } from "@/components/mediakit/MediaKitGenerator";
import { mediakitRepository } from "@/repositories/mediakit";

export const metadata: Metadata = {
  title: "Media kit generator - @misopaprika",
  robots: { index: false, follow: false },
};

export default function MediaKitGeneratorPage() {
  const data = mediakitRepository.get();
  return <MediaKitGenerator data={data} />;
}
