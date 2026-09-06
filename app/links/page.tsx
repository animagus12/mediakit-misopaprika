import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LinksPublicView } from "@/components/links/LinksPublicView";
import { incrementLinksViews, recordLinksVisitor } from "@/lib/cache";
import { visiblePageNow } from "@/lib/links";
import { SESSION_COOKIE, VISITOR_COOKIE, isCountableVisit } from "@/lib/visitor";
import { getPublishedLinksData } from "@/repositories/links.writer.server";
import { getPublishedProfilePhoto } from "@/repositories/mediakit.writer.server";
import { getSocialStats } from "@/repositories/socialStats.server";

const TITLE = "@misopaprika - links";
const DESCRIPTION = "Socials, creator codes, and collabs: everything in one place.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/links",
    type: "profile",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Reads the published snapshot from Redis on each request, so a Publish is
// live immediately and scheduled links appear on time. (Before the editor
// existed this was static with an hourly revalidate; the Redis read makes the
// route dynamic anyway, which removes the reason for that.)
export default async function LinksPage() {
  const cookieStore = await cookies();
  const [data, stats, photo] = await Promise.all([
    getPublishedLinksData(),
    getSocialStats(),
    getPublishedProfilePhoto(),
  ]);

  // Counted per render, alongside the per-link clicks the cards report, so
  // the editor can show a click rate. Both writes are best-effort and neither
  // can fail the page: see lib/cache. The owner's own renders don't count;
  // see isCountableVisit().
  if (await isCountableVisit(cookieStore.get(SESSION_COOKIE)?.value)) {
    await Promise.all([
      incrementLinksViews(),
      recordLinksVisitor(cookieStore.get(VISITOR_COOKIE)?.value),
    ]);
  }

  const { profile, followers, sections } = visiblePageNow(data, stats);

  return (
    <LinksPublicView
      profile={profile}
      photo={photo}
      followers={followers}
      sections={sections}
      trackClicks
    />
  );
}
