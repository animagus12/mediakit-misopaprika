import { MEDIAKIT_PRINT_PATH, isMediaKitPrintPayload, mediaKitPdfFilename } from "@/lib/mediakitPrint";
import { createPrintPdfRoute } from "@/lib/printPdfRoute.server";

// A cold start unpacks and launches Chromium before rendering.
export const maxDuration = 60;

/**
 * POST a MediaKitPrintPayload: the media kit as it stands in the editor,
 * saved or not, comes back as an A4 PDF download.
 */
export const POST = createPrintPdfRoute({
  path: MEDIAKIT_PRINT_PATH,
  isPayload: isMediaKitPrintPayload,
  filename: (payload) => mediaKitPdfFilename(payload.state.handle),
  invalidPayloadError: "That isn't a media kit the PDF can be made from.",
  logLabel: "Media kit",
});
