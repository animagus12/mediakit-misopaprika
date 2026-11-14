import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { MediaKitPublicView } from "@/components/mediakit/MediaKitPublicView";
import { incrementMediaKitViews, recordMediaKitVisitor } from "@/lib/cache";
import { toFormState } from "@/lib/mediakit";
import { SESSION_COOKIE, VISITOR_COOKIE, isCountableVisit } from "@/lib/visitor";
import { getPublishedMediaKitData } from "@/repositories/mediakit.writer.server";

const TITLE = "Media kit - @misopaprika";
const DESCRIPTION =
  "Anime, cosplay, and collectibles content creator: audience stats, rates, and past brand collabs.";

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

  // The owner is not counted: see isCountableVisit(). Every protected page
  // renders a sidebar link to /mediakit, and next/link prefetching it runs this
  // render exactly like a real visit, so without the gate the figure counted
  // dashboard navigation rather than an audience.
  if (await isCountableVisit(cookieStore.get(SESSION_COOKIE)?.value)) {
    // After the response, as on /links: best-effort counters stay off the
    // path to the first paint.
    const visitorId = cookieStore.get(VISITOR_COOKIE)?.value;
    after(() => Promise.all([incrementMediaKitViews(), recordMediaKitVisitor(visitorId)]));
  }

  return <MediaKitPublicView state={toFormState(data)} />;
}
