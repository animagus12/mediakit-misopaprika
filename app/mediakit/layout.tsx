import { MediaKitFontsProvider } from "@/components/mediakit/MediaKitFontsProvider";

export default function MediaKitLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <MediaKitFontsProvider>{children}</MediaKitFontsProvider>;
}
