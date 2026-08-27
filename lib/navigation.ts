import { Building2, Clapperboard, FileText, Sparkles, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavEntry {
  href: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  access: "public" | "protected";
}

export const navEntries: NavEntry[] = [
  {
    href: "/mediakit",
    title: "Media kit",
    description: "Public, shareable view of your published media kit.",
    Icon: UserRound,
    access: "public",
  },
  {
    href: "/mediakit-generator",
    title: "Edit Media kit",
    description: "Edit and publish the content shown on your media kit.",
    Icon: Sparkles,
    access: "protected",
  },
  {
    href: "/invoices",
    title: "Invoices",
    description: "Create, revisit, and edit invoices for brand collaborations.",
    Icon: FileText,
    access: "protected",
  },
  {
    href: "/workspace",
    title: "Editor workspace",
    description: "Track video editing transactions and editor payouts.",
    Icon: Clapperboard,
    access: "protected",
  },
  {
    href: "/brands",
    title: "Brands",
    description: "Manage brand, agency, and contact relationships.",
    Icon: Building2,
    access: "protected",
  },
];
