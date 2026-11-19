"use client";

import { Suspense, use, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Handshake, House, Menu, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { isNavHrefActive } from "@/lib/navigation";
import type { NavBadgeMap } from "@/lib/navBadges";
import { createActions } from "./create/createActions";
import { useCreateMenu } from "./create/CreateMenuProvider";

interface Tab {
  href: string;
  label: string;
  Icon: LucideIcon;
}

// The pages a phone visits most get a tab each; everything else is a tap away
// under Menu, which opens the full sidebar.
const tabs: Tab[] = [
  { href: "/", label: "Home", Icon: House },
  { href: "/campaigns", label: "Campaigns", Icon: Handshake },
  { href: "/calendar", label: "Calendar", Icon: CalendarDays },
];

// Button sizes itself to 44px on a touch screen; a tab fills the bar's full
// height instead, so the whole slot is the target.
const tabClass =
  "h-full pointer-coarse:h-full flex-col gap-1 rounded-none px-0 pointer-coarse:px-0 text-[11px] font-medium text-muted-foreground hover:bg-transparent [&_svg:not([class*='size-'])]:size-5";

/**
 * The phone's main navigation: one thumb reaches the busiest pages, the
 * create sheet and the full menu without the top-left hamburger. Hidden from
 * `md` up, where the sidebar is always on screen.
 */
export function MobileTabBar({ badges }: { badges?: Promise<NavBadgeMap> }) {
  const pathname = usePathname();
  const { openMobile, setOpenMobile } = useSidebar();
  const onTab = tabs.some((tab) => isNavHrefActive(pathname, tab.href));
  const [home, campaigns, calendar] = tabs;

  return (
    <nav
      data-mobile-tabbar
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="grid h-16 grid-cols-5">
        <TabLink tab={home} active={isNavHrefActive(pathname, home.href)} />
        <TabLink tab={campaigns} active={isNavHrefActive(pathname, campaigns.href)} />
        <CreateTab />
        <TabLink tab={calendar} active={isNavHrefActive(pathname, calendar.href)}>
          {badges && (
            <Suspense fallback={null}>
              <CountDot badges={badges} href={calendar.href} />
            </Suspense>
          )}
        </TabLink>
        <Button
          variant="ghost"
          aria-expanded={openMobile}
          onClick={() => setOpenMobile(true)}
          // Every page that has no tab of its own lives under Menu.
          className={cn(tabClass, "relative", !onTab && "text-primary")}
        >
          <Menu />
          Menu
          {badges && (
            <Suspense fallback={null}>
              <MenuDot badges={badges} />
            </Suspense>
          )}
        </Button>
      </div>
    </nav>
  );
}

function TabLink({ tab, active, children }: { tab: Tab; active: boolean; children?: React.ReactNode }) {
  return (
    <Button asChild variant="ghost" className={cn(tabClass, "relative", active && "text-primary")}>
      <Link href={tab.href} aria-current={active ? "page" : undefined}>
        <tab.Icon />
        {tab.label}
        {children}
      </Link>
    </Button>
  );
}

const dotPosition = "absolute top-2 left-1/2 ml-1.5";

// The calendar's own count, as on its sidebar row; the phrase it stands for is the accessible name.
function CountDot({ badges, href }: { badges: Promise<NavBadgeMap>; href: string }) {
  const badge = use(badges)[href];
  if (!badge) return null;
  return (
    <span
      title={badge.label}
      className={cn(
        dotPosition,
        "flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-black tabular-nums"
      )}
    >
      <span aria-hidden>{badge.count}</span>
      {/* Spans join with no gap in the tab's accessible name, so the comma is the pause. */}
      <span className="sr-only">, {badge.label}</span>
    </span>
  );
}

// Menu hides the pages with no tab, so a count on any of them would otherwise go unseen.
function MenuDot({ badges }: { badges: Promise<NavBadgeMap> }) {
  const map = use(badges);
  const hidden = Object.entries(map).filter(([href]) => !tabs.some((tab) => tab.href === href));
  if (hidden.length === 0) return null;
  return (
    <span className={cn(dotPosition, "mt-0.5 size-2 rounded-full bg-amber-500")}>
      <span className="sr-only">, {hidden.map(([, badge]) => badge.label).join(", ")}</span>
    </span>
  );
}

/** The centre + button and the sheet it opens: the phone's version of the top bar's New menu. */
function CreateTab() {
  const { openCreate, ready } = useCreateMenu();
  const [open, setOpen] = useState(false);
  // Handing off to a form: this sheet must not return focus to the + button
  // while the form's sheet is taking it.
  const handedOff = useRef(false);

  function pick(run: () => void) {
    handedOff.current = true;
    setOpen(false);
    run();
  }

  return (
    <div className="flex items-center justify-center">
      <Button size="icon-lg" aria-label="Create" onClick={() => setOpen(true)} className="size-12 rounded-full shadow-md">
        <Plus className="size-6" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="gap-0 rounded-t-2xl pb-[calc(--spacing(4)+env(safe-area-inset-bottom))]"
          onCloseAutoFocus={(event) => {
            if (handedOff.current) {
              event.preventDefault();
              handedOff.current = false;
            }
          }}
        >
          <SheetHeader>
            <SheetTitle>Create</SheetTitle>
            <SheetDescription>Start something new from anywhere.</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 px-4">
            {createActions.map((action, index) => {
              const lead = index === 0;
              const body = (
                <>
                  <action.Icon className="size-5" />
                  <span className="text-sm font-semibold">{action.label}</span>
                  <span className={cn("text-xs font-normal", lead ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {action.description}
                  </span>
                </>
              );
              const tileClass = cn(
                "h-auto pointer-coarse:h-auto min-h-20 flex-col items-start justify-start gap-1 p-3 pointer-coarse:px-3 text-left whitespace-normal",
                lead && "col-span-2"
              );
              return action.kind ? (
                <Button
                  key={action.id}
                  variant={lead ? "default" : "outline"}
                  disabled={!ready}
                  className={tileClass}
                  onClick={() => pick(() => openCreate(action.kind))}
                >
                  {body}
                </Button>
              ) : (
                <Button key={action.id} asChild variant="outline" className={tileClass}>
                  <Link href={action.href} onClick={() => setOpen(false)}>
                    {body}
                  </Link>
                </Button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
