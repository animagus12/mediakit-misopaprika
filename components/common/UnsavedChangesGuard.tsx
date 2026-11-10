"use client";

import { useEffect, useRef, useState } from "react";
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

/**
 * The link a click is about to follow off this page, or null when the click
 * keeps the page: a new tab or window, a download, a mail or phone link, or a
 * jump within the page. A change of search params counts as leaving, since
 * the App Router remounts the page for it.
 */
function leavingAnchor(event: MouseEvent): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  if (!(event.target instanceof Element)) return null;
  const anchor = event.target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return null;
  const url = new URL(anchor.href);
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const here = window.location;
  if (url.origin === here.origin && url.pathname === here.pathname && url.search === here.search) {
    return null;
  }
  return anchor;
}

interface UnsavedChangesGuardProps {
  /** Whether leaving now would lose work. */
  when: boolean;
}

/**
 * Asks before an editor's unsaved work is thrown away. Closing or reloading
 * the tab gets the browser's own prompt (phones mostly skip it, which no page
 * can change); following a link, the sidebar included, gets this dialog. The
 * browser's back button is not covered: the App Router offers no way to hold
 * it.
 */
export function UnsavedChangesGuard({ when }: UnsavedChangesGuardProps) {
  // The link a click was held on while the person decides.
  const [heldLink, setHeldLink] = useState<HTMLAnchorElement | null>(null);
  // Set once the person chooses to leave, so the replayed click goes through
  // and a full page load doesn't ask a second time.
  const leavingRef = useRef(false);

  useEffect(() => {
    if (!when) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (leavingRef.current) return;
      event.preventDefault();
      // Older Chrome and Safari prompt only when a return value is set.
      event.returnValue = true;
    }

    // On the window in the capture phase, so it runs before React does:
    // next/link never starts the navigation, and the phone sidebar, which
    // closes when one of its links is clicked, stays open behind the dialog.
    function handleClick(event: MouseEvent) {
      if (leavingRef.current) return;
      const anchor = leavingAnchor(event);
      if (!anchor) return;
      event.preventDefault();
      event.stopPropagation();
      setHeldLink(anchor);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("click", handleClick, true);
    };
  }, [when]);

  function leave() {
    const anchor = heldLink;
    setHeldLink(null);
    if (!anchor) return;
    leavingRef.current = true;
    // Replaying the click lets the link do everything it would have done:
    // next/link's client-side navigation, the sidebar closing, click tracking.
    if (anchor.isConnected) anchor.click();
    else window.location.assign(anchor.href);
  }

  return (
    <AlertDialog
      open={heldLink !== null}
      onOpenChange={(open) => {
        if (!open) setHeldLink(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ve made changes on this page that haven&apos;t been saved. Leaving now throws
            them away.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep editing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={leave}>
            Discard and leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
