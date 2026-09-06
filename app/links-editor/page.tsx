import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { LinksEditor } from "@/components/links/editor/LinksEditor";
import { getLinksAnalytics } from "@/repositories/linkStats.server";
import { getLinksData } from "@/repositories/links.writer.server";
import { getPublishedProfilePhoto } from "@/repositories/mediakit.writer.server";
import {
  getInstagramTokenStatus,
  getSocialStatsSnapshot,
} from "@/repositories/socialStats.server";

export const metadata: Metadata = {
  title: "Edit links - @misopaprika",
  robots: { index: false, follow: false },
};

export default async function LinksEditorPage() {
  // Stats and photo come from the server so the preview resolves live tokens
  // and shows the same face the public page will, rather than the raw
  // placeholder and an empty avatar. The snapshot carries the figures and
  // their write times together, so the readout can't describe a figure the
  // preview isn't showing.
  const [data, snapshot, photo, instagramToken, analytics] = await Promise.all([
    getLinksData(),
    getSocialStatsSnapshot(),
    getPublishedProfilePhoto(),
    getInstagramTokenStatus(),
    getLinksAnalytics(),
  ]);

  return (
    <AppShell>
      <LinksEditor
        data={data}
        stats={snapshot.stats}
        photo={photo}
        freshness={snapshot.freshness}
        instagramToken={instagramToken}
        analytics={analytics}
      />
    </AppShell>
  );
}
