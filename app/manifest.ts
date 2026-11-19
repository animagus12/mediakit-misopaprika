import type { MetadataRoute } from "next";
import { APP_COLORS } from "@/lib/appTheme";

// Lets the dashboard be added to a phone's home screen and open full screen,
// without the browser's address bar. iOS takes its home screen icon from
// app/apple-icon.png rather than this list; Android and desktop Chrome use
// these. The icons are opaque with the crown inside the central safe zone, so
// the 512 one doubles as the maskable icon Android crops to a circle.
//
// Served at /manifest.webmanifest, which proxy.ts lets through without a
// session: browsers fetch the manifest and its icons without cookies.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "@misopaprika",
    short_name: "misopaprika",
    description: "Creator dashboard: campaigns, brands, invoices and media kit.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: APP_COLORS.backgroundLight,
    theme_color: APP_COLORS.backgroundLight,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
