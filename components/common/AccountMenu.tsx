"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, CircleUserRound, LogOut, Monitor, Moon, Sun } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { ColorThemeSwatch } from "@/components/common/ColorThemeSwatch";
import { useColorTheme } from "@/hooks/use-color-theme";
import { COLOR_THEMES, colorThemeLabel, isColorTheme } from "@/lib/colorThemes";
import { accountEntries, isNavHrefActive } from "@/lib/navigation";

const themes = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/**
 * The foot of the sidebar: theme, the housekeeping pages and signing out,
 * which used to take four buttons in the top bar and three sidebar rows.
 */
export function AccountMenu() {
  const { isMobile, setOpenMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const { colorTheme, setColorTheme } = useColorTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // The log-out dialog takes focus; the menu must not pull it back to its trigger as it closes.
  const openedDialog = useRef(false);

  const onAccountPage = accountEntries.some((entry) => isNavHrefActive(pathname, entry.href));

  async function handleLogout() {
    setIsLoggingOut(true);
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              isActive={onAccountPage}
              tooltip="Account"
              className="gap-3 data-[state=open]:bg-sidebar-accent"
            >
              <CircleUserRound className="text-sidebar-foreground/70" />
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-medium">Account</span>
                <span className="truncate text-xs text-muted-foreground">Theme, activity, backup</span>
              </span>
              <ChevronsUpDown className="ml-auto text-sidebar-foreground/50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "top" : "right"}
            align="end"
            sideOffset={6}
            className="min-w-56"
            onCloseAutoFocus={(event) => {
              if (openedDialog.current) {
                event.preventDefault();
                openedDialog.current = false;
              }
            }}
          >
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              {themes.map(({ value, label, Icon }) => (
                <DropdownMenuRadioItem key={value} value={value} className="pointer-coarse:min-h-10">
                  <Icon />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {/* Colour theme: independent of light/dark, every theme has both. */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="pointer-coarse:min-h-10">
                <ColorThemeSwatch theme={colorTheme} />
                <span className="flex-1">Theme</span>
                <span className="text-muted-foreground">{colorThemeLabel(colorTheme)}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent collisionPadding={8} className="min-w-40">
                <DropdownMenuRadioGroup
                  value={colorTheme}
                  onValueChange={(value) => isColorTheme(value) && setColorTheme(value)}
                >
                  {COLOR_THEMES.map(({ id, label }) => (
                    <DropdownMenuRadioItem key={id} value={id} className="pointer-coarse:min-h-10">
                      <ColorThemeSwatch theme={id} />
                      {label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            {accountEntries.map(({ href, title, Icon }) => (
              <DropdownMenuItem key={href} asChild className="pointer-coarse:min-h-10">
                <Link href={href} onClick={() => isMobile && setOpenMobile(false)}>
                  <Icon />
                  {title}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {/* Confirmed, because there is no undo for it. */}
            <DropdownMenuItem
              variant="destructive"
              disabled={isLoggingOut}
              className="pointer-coarse:min-h-10"
              onSelect={() => {
                openedDialog.current = true;
                setConfirmingLogout(true);
              }}
            >
              <LogOut />
              Log out
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              Version{" "}
              <span className="font-mono text-foreground/80">
                {process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={confirmingLogout} onOpenChange={setConfirmingLogout}>
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
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
