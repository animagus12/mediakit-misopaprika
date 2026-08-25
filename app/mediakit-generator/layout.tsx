import { MediaKitFontsProvider } from "@/components/mediakit/MediaKitFontsProvider";

export default function MediaKitGeneratorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <MediaKitFontsProvider>{children}</MediaKitFontsProvider>;
}
