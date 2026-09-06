"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "../ui/button";
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
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "../ui/sidebar";
import {
  dashboardEntry,
  isNavHrefActive,
  navEntries,
  navGroups,
  type NavEntry,
} from "@/lib/navigation";

const entriesByGroup = navGroups.map(({ id, label }) => ({
  label,
  entries: navEntries.filter((entry) => entry.group === id),
}));

interface AppSideBarProps {
  photo: string;
}

const AppSideBar = ({ photo }: AppSideBarProps) => {
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const renderItem = ({ href, title, Icon }: Pick<NavEntry, "href" | "title" | "Icon">) => (
    <SidebarMenuItem key={href}>
      <SidebarMenuButton
        asChild
        isActive={isNavHrefActive(pathname, href)}
        tooltip={title}
        className="h-9 gap-3 text-sm pointer-coarse:h-11"
      >
        <Link href={href} onClick={closeOnMobile}>
          <Icon className="text-sidebar-foreground/70 group-data-active/menu-button:text-sidebar-accent-foreground" />
          <span>{title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="gap-0 border-b border-border/70 p-2 pt-[calc(--spacing(2)+env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            onClick={closeOnMobile}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 transition hover:bg-sidebar-accent group-data-[collapsible=icon]:p-0"
          >
            {/* Plain img, not next/image: the media kit photo can be a data: URL
                from the image picker, which next/image can't optimize. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="size-8 shrink-0 rounded-full object-cover" />
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-semibold">Misopaprika</p>
              <p className="truncate text-xs text-muted-foreground">Creator media kit</p>
            </div>
          </Link>
          {/* The mobile sheet hides its own close affordance, so the sidebar
              has to offer one of its own. */}
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={() => setOpenMobile(false)}
            className="size-9 shrink-0 pointer-coarse:size-11 md:hidden"
          >
            <X className="size-5" />
            <span className="sr-only">Close menu</span>
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{renderItem(dashboardEntry)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {entriesByGroup.map(({ label, entries }) => (
          <SidebarGroup key={label}>
            <SidebarGroupLabel className="text-[0.7rem] font-medium tracking-wide uppercase">
              {label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{entries.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter className="p-3 pb-[calc(--spacing(3)+env(safe-area-inset-bottom))] group-data-[collapsible=icon]:hidden">
        <p className="text-xs text-muted-foreground">
          Version{" "}
          <span className="font-mono text-foreground/80">
            {process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"}
          </span>
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

export default AppSideBar;
