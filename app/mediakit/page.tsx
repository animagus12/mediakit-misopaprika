import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { MediaKitPublicView } from "@/components/mediakit/MediaKitPublicView";
import { incrementMediaKitViews, recordMediaKitVisitor } from "@/lib/cache";
import { toFormState } from "@/lib/mediakit";
import { VISITOR_COOKIE } from "@/lib/visitor";
import { getPublishedMediaKitData } from "@/repositories/mediakit.writer.server";

export const metadata: Metadata = {
  title: "Media kit - @misopaprika",
};

export default async function MediaKitPage() {
  const data = await getPublishedMediaKitData();
  if (!data) notFound();

  const cookieStore = await cookies();
  await incrementMediaKitViews();
  await recordMediaKitVisitor(cookieStore.get(VISITOR_COOKIE)?.value);

  return <MediaKitPublicView state={toFormState(data)} />;
}
