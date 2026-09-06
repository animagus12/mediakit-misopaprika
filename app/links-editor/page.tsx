import type { Metadata } from "next";
import AppShell from "@/components/common/AppShell";
import { LinksEditor } from "@/components/links/editor/LinksEditor";
import { getLinksData } from "@/repositories/links.writer.server";
import { getSocialStats } from "@/repositories/socialStats.server";

export const metadata: Metadata = {
  title: "Edit links - @misopaprika",
  robots: { index: false, follow: false },
};

export default async function LinksEditorPage() {
  // Stats come from the server so the preview resolves live tokens exactly as
  // the public page will, rather than showing the raw placeholder.
  const [data, stats] = await Promise.all([getLinksData(), getSocialStats()]);

  return (
    <AppShell>
      <LinksEditor data={data} stats={stats} />
    </AppShell>
  );
}
