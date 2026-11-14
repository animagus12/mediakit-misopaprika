"use client";

import type { CSSProperties } from "react";
import { toast } from "sonner";
import { canSharePdf, savePdf } from "@/lib/printPdf";

// Long enough to glance away and come back: once the toast closes, the PDF is
// gone and making it again is another 1 to 3 second wait.
const SHARE_TOAST_MS = 20_000;

// The toast only ever shows on a coarse pointer (canSharePdf), so its buttons
// always take the 44px a thumb needs, as every control does under
// pointer-coarse. Sonner draws them 24px tall, in unlayered CSS that a
// Tailwind class can't outrank.
const THUMB_BUTTON: CSSProperties = { height: 44, paddingInline: 14 };

/**
 * Hands a freshly made PDF to the person. On a phone (see canSharePdf) a
 * toast offers Share, which opens the share sheet (WhatsApp, Gmail), or
 * Save, which downloads it. The toast costs a second tap, and it has to:
 * phones open the share sheet only from a fresh tap, and the tap on Download
 * is used up by the time the server has drawn the PDF. Everywhere else the
 * file downloads straight away.
 */
export function deliverPdf(file: File): void {
  if (!canSharePdf(file)) {
    savePdf(file);
    return;
  }

  toast.success("PDF ready", {
    description: file.name,
    duration: SHARE_TOAST_MS,
    action: { label: "Share", onClick: () => sharePdf(file) },
    cancel: { label: "Save", onClick: () => savePdf(file) },
    actionButtonStyle: THUMB_BUTTON,
    cancelButtonStyle: THUMB_BUTTON,
    // A long handle makes an unbroken filename, which would otherwise hold
    // the text at full width and push the buttons off a narrow phone.
    classNames: { description: "wrap-anywhere" },
  });
}

// Runs straight from the tap on Share, with nothing awaited first, so the tap
// still counts as fresh when the share sheet asks.
function sharePdf(file: File): void {
  navigator.share({ files: [file] }).catch((error: unknown) => {
    // The sheet was closed without picking an app.
    if (error instanceof DOMException && error.name === "AbortError") return;
    console.error("Sharing the PDF failed", error);
    toast.error("Couldn't open sharing", { description: "Saved the PDF to your downloads instead." });
    savePdf(file);
  });
}
