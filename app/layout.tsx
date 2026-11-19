import type { Metadata } from "next";
import { Geist_Mono, Inter, Noto_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import "./themes.css";
import { cn } from "@/lib/utils";
import { COLOR_THEME_INIT_SCRIPT } from "@/lib/colorThemes";
import { ThemeProvider } from "@/components/common/theme-provider";
import { ColorThemeSync } from "@/components/common/ColorThemeSync";
import { Toaster } from "@/components/ui/sonner";

const notoSansHeading = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
});

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

// Only the mono face is used (--font-mono, for the version string in the
// sidebar). Body copy is Inter, headings are Noto Sans.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://misopaprika.vercel.app"),
  title: "@misopaprika",
  description: "Creator dashboard: campaigns, brands, invoices and media kit for @misopaprika.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistMono.variable,
        "font-sans",
        inter.variable,
        notoSansHeading.variable,
      )}
      suppressHydrationWarning
    >
      <head>
        {/* Puts the saved colour theme on <html> before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: COLOR_THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
        <ColorThemeSync />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
