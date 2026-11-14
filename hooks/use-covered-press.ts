"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

/**
 * Tells a sheet or dialog whether a press began while a layer above it, such
 * as an open Select or menu, kept it from taking pointer events.
 *
 * Radix closes a dialog on a press outside it only once the click lands, and
 * asks then whether the dialog is the top layer. An open Select or menu closes
 * on pointerdown, so by the click the dialog is on top again and would close
 * too, on a press that was only meant to close the dropdown. Pass the outside
 * press's original event to the returned function and ignore it on a match.
 */
export function useCoveredPress(contentRef: RefObject<HTMLElement | null>): (event: Event) => boolean {
  const coveredPressRef = useRef<Event | null>(null);

  useEffect(() => {
    // Capture on the document runs before Radix's own listeners, while the
    // layer above is still open and the content still refuses the pointer.
    function handlePointerDown(event: PointerEvent) {
      const content = contentRef.current;
      coveredPressRef.current = content && getComputedStyle(content).pointerEvents === "none" ? event : null;
    }
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [contentRef]);

  return useCallback((event: Event) => event === coveredPressRef.current, []);
}
