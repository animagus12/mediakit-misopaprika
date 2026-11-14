"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { PRINT_PAYLOAD_GLOBAL } from "@/lib/printPdf";

// The PDF service sets the payload once, before any script runs, and never
// changes it: there is nothing to subscribe to.
function subscribe() {
  return () => {};
}

function noPayload() {
  return null;
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Resolves once the sheets are final: the fonts loaded (layout such as the
 * invoice's page breaks is measured from the rendered text), the re-render
 * those measurements cause, and every image decoded, including any the
 * re-render added.
 */
async function layoutSettled() {
  await document.fonts.ready;
  await nextFrame();
  await nextFrame();
  await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined)));
  await document.fonts.ready;
  await nextFrame();
}

/**
 * For a print page the PDF service opens (lib/printPdf.ts): the document it
 * was handed, or null when there is none or `isPayload` refuses it, and
 * whether the page has finished drawing it. Once ready, the page title is
 * `title(payload)`, which becomes the PDF's title. Pass module-level
 * functions, as a new one each render restarts the wait.
 */
export function usePrintPayload<T>(
  isPayload: (value: unknown) => value is T,
  title: (payload: T) => string
): { payload: T | null; ready: boolean } {
  const payload = useSyncExternalStore(
    subscribe,
    () => {
      const value: unknown = Reflect.get(window, PRINT_PAYLOAD_GLOBAL);
      return isPayload(value) ? value : null;
    },
    noPayload
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!payload) return;
    let cancelled = false;
    void layoutSettled().then(() => {
      if (cancelled) return;
      document.title = title(payload);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [payload, title]);

  return { payload, ready };
}
