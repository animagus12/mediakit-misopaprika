import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MediaKitPublicView } from "@/components/mediakit/MediaKitPublicView";
import { incrementMediaKitViews } from "@/lib/cache";
import { toFormState } from "@/lib/mediakit";
import { getPublishedMediaKitData } from "@/repositories/mediakit.writer.server";

export const metadata: Metadata = {
  title: "Media kit - @misopaprika",
};

export default async function MediaKitPage() {
  const data = await getPublishedMediaKitData();
  if (!data) notFound();

  await incrementMediaKitViews();

  return <MediaKitPublicView state={toFormState(data)} />;
}
