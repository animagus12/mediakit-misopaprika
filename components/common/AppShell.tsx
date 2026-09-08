import { cookies } from "next/headers";
import AppSideBar from "@/components/common/AppSideBar";
import NavBar from "@/components/common/NavBar";
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

export default async function AppShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";
  const { photo } = (await getMediaKitData()).header;

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <TooltipProvider>
        {/* Deliberately not awaited: the sidebar renders from `photo` alone and
            streams its counters in. See NavBadge in AppSideBar. */}
        <AppSideBar photo={photo} badges={loadNavBadges()} />
        <div className="w-full">
          <NavBar />
          {children}
        </div>
      </TooltipProvider>
    </SidebarProvider>
  );
}
