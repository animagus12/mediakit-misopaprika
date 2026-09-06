import { Link2 } from "lucide-react";
import { SiDiscord, SiInstagram, SiTiktok, SiX, SiYoutube } from "react-icons/si";
import type { IconType } from "react-icons";

// lucide-react dropped its brand glyphs in v1, so platform marks come from
// react-icons' Simple Icons set. Both render plain SVG with no hooks, so
// this stays a server component.
const ICONS: Record<string, IconType> = {
  instagram: SiInstagram,
  youtube: SiYoutube,
  tiktok: SiTiktok,
  x: SiX,
  twitter: SiX,
  discord: SiDiscord,
};

interface SocialIconProps {
  platform: string;
  size?: number;
}

export function SocialIcon({ platform, size = 26 }: SocialIconProps) {
  const Icon = ICONS[platform.toLowerCase()];
  // Unknown platform: a generic link glyph beats rendering nothing, so
  // adding a platform to the data never leaves a blank gap.
  if (!Icon) return <Link2 size={size} aria-hidden />;
  return <Icon size={size} aria-hidden />;
}
