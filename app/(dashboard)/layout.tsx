import AppSideBar from "@/components/common/AppSideBar";
import NavBar from "@/components/common/NavBar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cookies } from "next/headers";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <TooltipProvider>
        <AppSideBar />
        <div className="w-full">
          <NavBar />
          <div className="px-4">{children}</div>
        </div>
      </TooltipProvider>
    </SidebarProvider>
  );
}
