"use client";

import { useEffect, useEffectEvent } from "react";

/**
 * Ctrl+S, or Cmd+S on a Mac, calls `onSave` in place of the browser's "Save
 * page as". The editor owns the shortcut while it is mounted, so the browser
 * dialog is held back even when `onSave` declines (mid-save, say): it is never
 * what someone in an editor means.
 *
 * A keystroke from inside an open dialog or sheet saves nothing: recording a
 * payment over the invoice has its own submit, and saving the page underneath
 * would be a surprise. Holding the keys down saves once.
 */
export function useSaveShortcut(onSave: () => void): void {
  const save = useEffectEvent(onSave);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      if (event.repeat) return;
      if (
        event.target instanceof Element &&
        event.target.closest('[role="dialog"], [role="alertdialog"]')
      ) {
        return;
      }
      save();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
