import type { VariantProps } from "class-variance-authority";
import type { badgeVariants } from "@/components/ui/badge";
import type { CampaignStatus } from "@/repositories/campaigns";

export interface StatusStyle {
  variant: VariantProps<typeof badgeVariants>["variant"];
  className?: string;
}

// One Badge style per shared status, for every surface that shows a deal's
// status: the /campaigns table and the brand page's Campaigns tab. Keyed on
// the closed union, so adding a status fails to compile until it has a style
// here rather than falling through to grey on one surface and not another.
//
// Not a "use client" module on purpose: BrandCampaignsTab is a server
// component, and a plain object imported from a client module arrives there
// as a reference rather than as the object.
//
// Meaning-carrying colours follow the destructive variant's shape (a raw
// palette hue at low opacity), since globals.css has no success/warning/info
// token. Not started reads neutral, Posted takes the posted green the
// calendar uses, and Cancelled is the one destructive badge.
export const CAMPAIGN_STATUS_STYLES: Record<CampaignStatus, StatusStyle> = {
  Discussion: { variant: "secondary" },
  "In Route": {
    variant: "outline",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  },
  Idea: { variant: "secondary" },
  Scripting: {
    variant: "outline",
    className: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  },
  Filming: {
    variant: "outline",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  },
  Editing: {
    variant: "outline",
    className: "border-pink-500/30 bg-pink-500/10 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400",
  },
  Ready: {
    variant: "outline",
    className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
  },
  Posted: {
    variant: "outline",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  Cancelled: { variant: "destructive" },
  // Dashed and muted: it marks a row as written out of the record, not as wrong.
  Redacted: { variant: "outline", className: "border-dashed text-muted-foreground/70" },
};
