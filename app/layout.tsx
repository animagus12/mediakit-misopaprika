import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Noto_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/common/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { APP_COLORS } from "@/lib/appTheme";

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
  // Name and status bar when opened from the iPhone home screen (see
  // app/manifest.ts). "default" keeps the page below the status bar, so no
  // safe-area padding is needed.
  appleWebApp: {
    title: "misopaprika",
    statusBarStyle: "default",
  },
};

// Follows the system setting, which is also the app's default theme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: APP_COLORS.backgroundLight },
    { media: "(prefers-color-scheme: dark)", color: APP_COLORS.backgroundDark },
  ],
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
