import { Mulish, Oranienbaum, Sacramento } from "next/font/google";
import { cn } from "@/lib/utils";

// `display: "block"` (not next/font's default "swap") because the A4 sheet is
// a fixed-metric layout, absolute mm positions, pt font sizes, `white-space:
// nowrap`: with no tolerance for a substitute font's metrics. Painting
// fallback text first (what "swap" does) doesn't degrade gracefully here: it
// overflows every box and gets clipped by .page's `overflow: hidden`, which is
// what in-app browsers on a slow connection were showing. Blocking keeps the
// text invisible for the ~3s block period instead, by which point the
// preloaded woff2s have almost always arrived.
//
// Deliberately no `fallback` option: passing one makes next/font drop the
// metric-adjusted fallback faces ("Mulish Fallback" etc., Arial/Times with
// ascent/descent/size-adjust overrides) that keep a substitution close to the
// real metrics. The generic families are appended after the var() in
// mediakit.module.css instead, so both protections apply.
const mulish = Mulish({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800"],
  variable: "--font-mediakit-body",
  display: "block",
});

const oranienbaum = Oranienbaum({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mediakit-wordmark",
  display: "block",
});

const sacramento = Sacramento({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mediakit-script",
  display: "block",
});

// Shared by both the editor and the public preview route so the two never
// drift out of font sync.
export function MediaKitFontsProvider({ children }: { children: React.ReactNode }) {
  return (
    <div className={cn(mulish.variable, oranienbaum.variable, sacramento.variable)}>
      {children}
    </div>
  );
}
