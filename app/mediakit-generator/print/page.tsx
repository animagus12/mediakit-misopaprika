import type { Metadata } from "next";
import { MediaKitPrintView } from "@/components/mediakit/MediaKitPrintView";

export const metadata: Metadata = {
  title: "Media kit PDF - @misopaprika",
  robots: { index: false, follow: false },
};

// Opened only by the PDF service's headless browser, which hands it the media
// kit to draw (services/printPdf.server.ts). Nothing to show otherwise.
export default function MediaKitPrintPage() {
  return <MediaKitPrintView />;
}
