"use client";

import Image from "next/image";
import { sectionsRepository } from "@/repositories";

const sectionsData = sectionsRepository.get();
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "../ui/sidebar";

const AppSideBar = () => {
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar className="rounded-r-3xl border-r border-border bg-background/95 shadow-sm shadow-slate-900/5">
      <SidebarHeader className="space-y-3 border-b border-border/70 px-4 pb-4 pt-6">
        <a href="#hero" onClick={handleNavClick} className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2 transition hover:bg-muted/80">
          <Image src="/logo.png" alt="Logo" width={32} height={32} />
          <div>
            <p className="text-sm font-semibold">Misoparika</p>
            <p className="text-xs text-muted-foreground">Creator media kit</p>
          </div>
        </a>
      </SidebarHeader>

      <SidebarContent className="px-4 py-4">
        <SidebarGroup>
          <SidebarGroupLabel>Sections</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sectionsData.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.href} onClick={handleNavClick}>
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter className="px-4 pb-6 pt-4 text-xs text-muted-foreground">
        <div className="rounded-2xl border border-border/70 bg-muted px-3 py-3">
          <p className="font-medium">Quick links</p>
          <p className="mt-1 text-[0.82rem] leading-tight">Navigate the dashboard sections with ease.</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSideBar;
