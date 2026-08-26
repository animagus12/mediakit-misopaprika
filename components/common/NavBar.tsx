"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Sun, Moon, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "../ui/button";
import { SidebarTrigger } from "../ui/sidebar";

const NavBar = () => {
  const { setTheme } = useTheme();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <nav
      data-app-navbar
      className="sticky top-0 z-50 p-2 flex justify-between items-center bg-background/95 backdrop-blur-xl"
    >
      {/* Left Section */}
      <SidebarTrigger />

      {/* Right Section */}
      <div className="flex items-center gap-4">
        {/* Light/Dark Mode Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* User Menu */}
        <Link href="/">Home</Link>
        <Button
          variant="outline"
          size="icon"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Log out</span>
        </Button>
      </div>
    </nav>
  );
};

export default NavBar;
