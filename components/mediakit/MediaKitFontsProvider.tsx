import { Mulish, Oranienbaum, Sacramento } from "next/font/google";
import { cn } from "@/lib/utils";

const mulish = Mulish({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800"],
  variable: "--font-mediakit-body",
});

const oranienbaum = Oranienbaum({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mediakit-wordmark",
});

const sacramento = Sacramento({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mediakit-script",
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
