"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { Separator } from "../ui/separator";
import { SidebarTrigger } from "../ui/sidebar";
import GlobalSearch from "@/components/common/GlobalSearch";
import { NewMenu } from "@/components/common/create/NewMenu";
import { currentNavTrail } from "@/lib/navigation";

// Touch targets follow the pointer, not the viewport: a phone in landscape is
// past `md` but still driven by a thumb.
const iconButton = "size-7 pointer-coarse:size-11 [&_svg]:size-4 pointer-coarse:[&_svg]:size-5";

const NavBar = () => {
  const pathname = usePathname();
  const trail = currentNavTrail(pathname);

  return (
    <nav
      data-app-navbar
      className="sticky top-0 z-50 flex min-h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-xl max-md:pl-4"
    >
      <div className="flex min-w-0 items-center gap-1">
        {/* On a phone the tab bar's Menu opens the sidebar instead. */}
        <SidebarTrigger aria-label="Toggle menu" className={`${iconButton} max-md:hidden`} />
        {trail && (
          <>
            <Separator
              orientation="vertical"
              className="mx-1 data-vertical:h-5 data-vertical:self-center max-md:hidden"
            />
            {/* The page's own h1 scrolls away; this is what names the page
                once it has, and leads back to its section from a nested one. */}
            <Breadcrumb className="min-w-0">
              <BreadcrumbList className="flex-nowrap">
                {trail.parent && (
                  <>
                    <BreadcrumbItem className="shrink-0">
                      <BreadcrumbLink asChild className="pointer-coarse:py-2">
                        <Link href={trail.parent.href}>{trail.parent.title}</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                  </>
                )}
                <BreadcrumbItem className="min-w-0">
                  <BreadcrumbPage className="truncate font-heading text-sm font-medium">
                    {trail.title}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        <GlobalSearch />
        <NewMenu />
      </div>
    </nav>
  );
};

export default NavBar;
