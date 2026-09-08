"use client";

import { Suspense, use } from "react";
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
  SidebarMenuBadge,
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
import type { NavBadgeMap } from "@/lib/navBadges";

const entriesByGroup = navGroups.map(({ id, label }) => ({
  label,
  entries: navEntries.filter((entry) => entry.group === id),
}));

// The counts arrive as an unresolved promise so the nav paints on the first
// byte and each badge fills in behind its own boundary: the sidebar is on
// every page, and none of it should wait on six stores being read.
function NavBadge({ badges, href }: { badges: Promise<NavBadgeMap>; href: string }) {
  const badge = use(badges)[href];
  if (!badge) return null;
  return (
    <SidebarMenuBadge
      // The slot is one row wide, so the count is all that fits; the phrase it
      // stands for ("3 overdue") is the title and the accessible name.
      title={badge.label}
      className="pointer-events-auto border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
    >
      <span aria-hidden>{badge.count}</span>
      <span className="sr-only">{badge.label}</span>
    </SidebarMenuBadge>
  );
}

interface AppSideBarProps {
  photo: string;
  badges: Promise<NavBadgeMap>;
}

const AppSideBar = ({ photo, badges }: AppSideBarProps) => {
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
      <Suspense fallback={null}>
        <NavBadge badges={badges} href={href} />
      </Suspense>
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
