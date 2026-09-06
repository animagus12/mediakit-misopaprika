import type { Metadata } from "next";
import { LinksPublicView } from "@/components/links/LinksPublicView";
import { visiblePageNow } from "@/lib/links";
import { getPublishedLinksData } from "@/repositories/links.writer.server";
import { getSocialStats } from "@/repositories/socialStats.server";

const TITLE = "@misopaprika - links";
const DESCRIPTION = "Socials, creator codes, and collabs — everything in one place.";

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
  const [data, stats] = await Promise.all([getPublishedLinksData(), getSocialStats()]);
  const { profile, sections } = visiblePageNow(data, stats);

  return <LinksPublicView profile={profile} sections={sections} />;
}
