import { cookies } from "next/headers";
import AppSideBar from "@/components/common/AppSideBar";
import NavBar from "@/components/common/NavBar";
import { MobileTabBar } from "@/components/common/MobileTabBar";
import { PageSkeleton } from "@/components/common/PageSkeleton";
import { CreateMenuProvider } from "@/components/common/create/CreateMenuProvider";
import type { CreateMenuData } from "@/components/common/create/createActions";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getMediaKitData } from "@/repositories/mediakit.writer.server";
import { getBrands } from "@/repositories/brands.writer.server";
import { getAgencies } from "@/repositories/agencies.writer.server";
import { getContacts } from "@/repositories/contacts.writer.server";
import { getEditors } from "@/repositories/editors.writer.server";
import { getInvoices } from "@/repositories/invoices.writer.server";
import { getEditorTransactions } from "@/repositories/editorTransactions.writer.server";
import { getContentItems } from "@/repositories/contentPlan.writer.server";
import { readExpenseRecords } from "@/repositories/expenseRecords.server";
import { campaignRepository } from "@/repositories/campaignRepository";
import { buildNavBadges, type NavBadgeMap } from "@/lib/navBadges";
import { buildCampaignBrandOptions } from "@/lib/campaigns";
import { buildEditorVideoOptions } from "@/lib/contentPlan";
import { buildExpenseDealOptions, lastExpenseDefaults } from "@/lib/expenses";

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

// What the New menu's forms offer to pick from. Most of these stores are read
// for the counters or by the page itself already, and reads are shared within
// a request (lib/cache.ts), so this adds the agencies, editors and expenses.
// Each failure degrades to an empty list, as the counters do: a form with no
// suggestions still works, where a shell that won't render doesn't.
async function loadCreateMenuData(): Promise<CreateMenuData> {
  const [brands, agencies, contacts, editors, editorTransactions, campaigns, contentItems, expenses] =
    await Promise.all([
      getBrands().catch(() => []),
      getAgencies().catch(() => []),
      getContacts().catch(() => []),
      getEditors().catch(() => []),
      getEditorTransactions().catch(() => []),
      campaignRepository.getAll().catch(() => []),
      getContentItems().catch(() => []),
      readExpenseRecords().catch(() => []),
    ]);
  return {
    campaignBrandOptions: buildCampaignBrandOptions(brands),
    videoOptions: buildEditorVideoOptions(editorTransactions, [...contentItems, ...campaigns]),
    agencies,
    contacts,
    editors,
    expenseDealOptions: buildExpenseDealOptions(campaigns),
    expenseDefaults: lastExpenseDefaults(expenses),
  };
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
  badges,
  createMenu,
  children,
}: Readonly<{
  sidebarOpen: boolean;
  sidebar: React.ReactNode;
  badges?: Promise<NavBadgeMap>;
  createMenu?: Promise<CreateMenuData>;
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <TooltipProvider>
        <CreateMenuProvider data={createMenu}>
          {sidebar}
          {/* Below `md` the tab bar is fixed over the foot of the page, so the
              page ends that much higher to keep its last row reachable.
              min-w-0 lets this column be narrower than its widest table: as a
              flex item it otherwise grows to fit it, and beside the sidebar
              (768px with a wide table, say) the whole page scrolled sideways
              instead of the table scrolling in its own box. */}
          <div className="w-full min-w-0 pb-[calc(--spacing(16)+env(safe-area-inset-bottom))] md:pb-0">
            <NavBar />
            {children}
          </div>
          <MobileTabBar badges={badges} />
        </CreateMenuProvider>
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
  // Deliberately not awaited: every read starts together and streams in
  // behind its own boundary, so the page's content never waits on them. See
  // SidebarPhoto and NavBadge in AppSideBar, and CreateMenuProvider.
  const badges = loadNavBadges();

  return (
    <ShellFrame
      sidebarOpen={sidebarOpen}
      sidebar={<AppSideBar photo={loadSidebarPhoto()} badges={badges} />}
      badges={badges}
      createMenu={loadCreateMenuData()}
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
