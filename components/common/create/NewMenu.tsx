"use client";

import { Fragment, useRef } from "react";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createActions } from "./createActions";
import { useCreateMenu } from "./CreateMenuProvider";

/**
 * The top bar's New button: every create action on every page, so starting
 * work never means finding the page that owns it first. Desktop only; on a
 * phone the tab bar's + button opens the same list as a sheet.
 */
export function NewMenu() {
  const { openCreate, ready } = useCreateMenu();
  // A sheet opened from the menu takes focus; the menu must not then pull it
  // back to the New button as it closes.
  const openedSheet = useRef(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="max-md:hidden">
          <Plus />
          New
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48"
        onCloseAutoFocus={(event) => {
          if (openedSheet.current) {
            event.preventDefault();
            openedSheet.current = false;
          }
        }}
      >
        {createActions.map((action, index) => {
          const separated = index > 0 && createActions[index - 1].section !== action.section;
          return (
            <Fragment key={action.id}>
              {separated && <DropdownMenuSeparator />}
              {action.kind ? (
                <DropdownMenuItem
                  disabled={!ready}
                  onSelect={() => {
                    openedSheet.current = true;
                    openCreate(action.kind);
                  }}
                >
                  <action.Icon />
                  {action.label}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild>
                  <Link href={action.href}>
                    <action.Icon />
                    {action.label}
                  </Link>
                </DropdownMenuItem>
              )}
            </Fragment>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
