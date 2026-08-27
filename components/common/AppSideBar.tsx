"use client";

import Link from "next/link";
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
import { navEntries } from "@/lib/navigation";

const navItems = [
  { title: "Dashboard", href: "/" },
  ...navEntries.map(({ title, href }) => ({ title, href })),
];

interface AppSideBarProps {
  photo: string;
}

const AppSideBar = ({ photo }: AppSideBarProps) => {
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar className="rounded-r-3xl border-r border-border bg-background/95 shadow-sm shadow-slate-900/5">
      <SidebarHeader className="space-y-3 border-b border-border/70 px-4 pb-4 pt-6">
        <Link href="/" onClick={handleNavClick} className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2 transition hover:bg-muted/80">
          {/* Plain img, not next/image: the media kit photo can be a data: URL
              from the image picker, which next/image can't optimize. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="size-8 rounded-full object-cover" />
          <div>
            <p className="text-sm font-semibold">Misoparika</p>
            <p className="text-xs text-muted-foreground">Creator media kit</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-4 py-4">
        <SidebarGroup>
          <SidebarGroupLabel>Navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild>
                    <Link href={item.href} onClick={handleNavClick}>
                      <span>{item.title}</span>
                    </Link>
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
          <p className="font-medium">Deployed version</p>
          <p className="mt-1 font-mono text-[0.82rem] leading-tight">
            {process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSideBar;
