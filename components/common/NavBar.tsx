"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { House, LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { Separator } from "../ui/separator";
import { SidebarTrigger } from "../ui/sidebar";
import { currentNavTitle } from "@/lib/navigation";

// Touch targets follow the pointer, not the viewport: a phone in landscape is
// past `md` but still driven by a thumb.
const iconButton = "size-7 pointer-coarse:size-11 [&_svg]:size-4 pointer-coarse:[&_svg]:size-5";

const NavBar = () => {
  const { setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const title = currentNavTitle(pathname);

  async function handleLogout() {
    setIsLoggingOut(true);
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <nav
      data-app-navbar
      className="sticky top-0 z-50 flex min-h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-xl"
    >
      <div className="flex min-w-0 items-center gap-1">
        <SidebarTrigger aria-label="Toggle menu" className={iconButton} />
        {title && (
          <>
            <Separator
              orientation="vertical"
              className="mx-1 data-vertical:h-5 data-vertical:self-center"
            />
            {/* The page's own h1 scrolls away; this is what names the page once
                it has. */}
            <span className="truncate font-heading text-sm font-medium">{title}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className={iconButton}>
              <Sun className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" className={iconButton} asChild>
          <Link href="/">
            <House />
            <span className="sr-only">Dashboard</span>
          </Link>
        </Button>

        {/* Confirmed, because this sits a thumb's width from the theme toggle
            and there is no undo for it. */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className={iconButton} disabled={isLoggingOut}>
              <LogOut />
              <span className="sr-only">Log out</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Log out?</AlertDialogTitle>
              <AlertDialogDescription>
                You&apos;ll need the workspace password to get back in.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleLogout}>Log out</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </nav>
  );
};

export default NavBar;
