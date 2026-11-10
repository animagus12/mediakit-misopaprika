"use client";

import { usePrintPayload } from "@/hooks/use-print-payload";
import { isMediaKitPrintPayload, type MediaKitPrintPayload } from "@/lib/mediakitPrint";
import { PRINT_READY_ATTRIBUTE } from "@/lib/printPdf";
import { MediaKitPreview } from "./MediaKitPreview";

function pdfTitle({ state }: MediaKitPrintPayload) {
  return state.handle ? `Media kit - ${state.handle}` : "Media kit";
}

/** The media kit sheet alone, as the PDF service prints it. */
export function MediaKitPrintView() {
  const { payload, ready } = usePrintPayload(isMediaKitPrintPayload, pdfTitle);

  if (!payload) return null;

  return (
    <div {...(ready ? { [PRINT_READY_ATTRIBUTE]: "" } : {})}>
      <MediaKitPreview state={payload.state} />
    </div>
  );
}
