import { cookies } from "next/headers";
import AppSideBar from "@/components/common/AppSideBar";
import NavBar from "@/components/common/NavBar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { mediakitRepository } from "@/repositories";

export default async function AppShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";
  const { photo } = mediakitRepository.get().header;

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <TooltipProvider>
        <AppSideBar photo={photo} />
        <div className="w-full">
          <NavBar />
          {children}
        </div>
      </TooltipProvider>
    </SidebarProvider>
  );
}
