import { FileText, Sparkles, UserRound } from "lucide-react";
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
    title: "Media kit generator",
    description: "Edit and publish the content shown on your media kit.",
    Icon: Sparkles,
    access: "protected",
  },
  {
    href: "/invoice-generator",
    title: "Invoice generator",
    description: "Create and export invoices for brand collaborations.",
    Icon: FileText,
    access: "protected",
  },
];
