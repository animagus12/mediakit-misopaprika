import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { MediaKitPublicView } from "@/components/mediakit/MediaKitPublicView";
import { incrementMediaKitViews, recordMediaKitVisitor } from "@/lib/cache";
import { toFormState } from "@/lib/mediakit";
import { VISITOR_COOKIE } from "@/lib/visitor";
import { getPublishedMediaKitData } from "@/repositories/mediakit.writer.server";

const TITLE = "Media kit - @misopaprika";
const DESCRIPTION =
  "Anime, cosplay, and collectibles content creator — audience stats, rates, and past brand collabs.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/mediakit",
    type: "profile",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function MediaKitPage() {
  const data = await getPublishedMediaKitData();
  if (!data) notFound();

  const cookieStore = await cookies();
  await incrementMediaKitViews();
  await recordMediaKitVisitor(cookieStore.get(VISITOR_COOKIE)?.value);

  return <MediaKitPublicView state={toFormState(data)} />;
}
