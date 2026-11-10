import { cookies } from "next/headers";
import AppSideBar from "@/components/common/AppSideBar";
import NavBar from "@/components/common/NavBar";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getMediaKitData } from "@/repositories/mediakit.writer.server";
import { getBrands } from "@/repositories/brands.writer.server";
import { getContacts } from "@/repositories/contacts.writer.server";
import { getInvoices } from "@/repositories/invoices.writer.server";
import { getEditorTransactions } from "@/repositories/editorTransactions.writer.server";
import { getContentItems } from "@/repositories/contentPlan.writer.server";
import { campaignRepository } from "@/repositories/campaignRepository";
import { buildNavBadges, type NavBadgeMap } from "@/lib/navBadges";

// Every store the sidebar counters read. Each failure degrades to "nothing to
// flag" rather than taking the shell down with it: a missing counter is a far
// smaller loss than a page that will not render.
async function loadNavBadges(): Promise<NavBadgeMap> {
  const [brands, contacts, invoices, editorTransactions, campaigns, contentItems] =
    await Promise.all([
      getBrands().catch(() => []),
      getContacts().catch(() => []),
      getInvoices().catch(() => []),
      getEditorTransactions().catch(() => []),
      campaignRepository.getAll().catch(() => []),
      getContentItems().catch(() => []),
    ]);
  return buildNavBadges({ campaigns, contentItems, invoices, brands, contacts, editorTransactions });
}

// The same trade as the counters: a failed read costs the photo, not the page.
async function loadSidebarPhoto(): Promise<string | null> {
  try {
    return (await getMediaKitData()).header.photo;
  } catch {
    return null;
  }
}

// Written by SidebarProvider whenever the sidebar is toggled.
async function readSidebarOpen(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("sidebar_state")?.value === "true";
}

function ShellFrame({
  sidebarOpen,
  sidebar,
  children,
}: Readonly<{
  sidebarOpen: boolean;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <TooltipProvider>
        {sidebar}
        <div className="w-full">
          <NavBar />
          {children}
        </div>
      </TooltipProvider>
    </SidebarProvider>
  );
}

export default async function AppShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sidebarOpen = await readSidebarOpen();

  return (
    <ShellFrame
      sidebarOpen={sidebarOpen}
      // Deliberately not awaited: both reads start together and stream in
      // behind their own boundaries, so the page's content never waits on
      // them. See SidebarPhoto and NavBadge in AppSideBar.
      sidebar={<AppSideBar photo={loadSidebarPhoto()} badges={loadNavBadges()} />}
    >
      {children}
    </ShellFrame>
  );
}

/**
 * The loading.tsx of every route whose page renders AppShell. Those pages
 * await their data before the shell exists, so without this a tap on a nav
 * link showed nothing until every store had been read. This draws the same
 * chrome at once, reading no store: the tapped link already highlighted, the
 * navbar already showing its title, the content a skeleton.
 *
 * Each route re-exports it rather than one app/loading.tsx covering them all,
 * because a root boundary would also wrap the public pages: /links and
 * /mediakit would flash a dashboard skeleton to visitors, and /mediakit would
 * lose its 404 status, since a streamed fallback commits the response to 200.
 */
export async function AppShellLoading() {
  return (
    <ShellFrame sidebarOpen={await readSidebarOpen()} sidebar={<AppSideBar />}>
      <PageSkeleton />
    </ShellFrame>
  );
}
