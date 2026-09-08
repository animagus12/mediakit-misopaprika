import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * One figure in a dashboard stat row.
 *
 * Four sections had grown their own copy of this card and their own tone map:
 * the earnings tiles, money in and out, audience, and now two more. They had
 * already drifted, in that only some of them stretched to the row height, and
 * a tone map retyped per file is exactly the thing that ends up meaning amber
 * on one screen and rose on another. The same argument
 * RELIABILITY_RATING_TONES makes for living beside its labels.
 *
 * Tones are named for what a figure means, not for the hue they resolve to, so
 * two names sharing a hue is intended rather than a duplication to collapse:
 * "cash" and "action" are both emerald because money kept and an audience
 * acting are both good news, and either could be retuned without dragging the
 * other with it. Raw palette hues at low opacity throughout, since globals.css
 * carries no success/warning/info token.
 */
export const STAT_TONES = {
  neutral: { card: "", value: "" },
  cash: {
    card: "bg-emerald-500/5 ring-emerald-500/15",
    value: "text-emerald-600 dark:text-emerald-400",
  },
  action: {
    card: "bg-emerald-500/5 ring-emerald-500/15",
    value: "text-emerald-600 dark:text-emerald-400",
  },
  barter: { card: "bg-sky-500/5 ring-sky-500/15", value: "text-sky-600 dark:text-sky-400" },
  audience: { card: "bg-sky-500/5 ring-sky-500/15", value: "text-sky-600 dark:text-sky-400" },
  pending: { card: "bg-amber-500/5 ring-amber-500/15", value: "text-amber-600 dark:text-amber-400" },
  owed: { card: "bg-amber-500/5 ring-amber-500/15", value: "text-amber-600 dark:text-amber-400" },
  risk: { card: "bg-amber-500/5 ring-amber-500/15", value: "text-amber-600 dark:text-amber-400" },
  out: { card: "bg-rose-500/5 ring-rose-500/15", value: "text-rose-600 dark:text-rose-400" },
} as const;

export type StatTone = keyof typeof STAT_TONES;

export interface StatTileProps {
  label: string;
  /** A node, not a string, so a figure can carry a direction arrow beside it. */
  value: ReactNode;
  icon?: LucideIcon;
  /** The line under the figure: what it is a share of, what it covers. */
  hint?: string | null;
  /** Hover text for a qualification too long to print under every tile. */
  title?: string;
  href?: string;
  tone?: StatTone;
}

export function StatTile({
  label,
  value,
  icon: Icon,
  hint,
  title,
  href,
  tone = "neutral",
}: StatTileProps) {
  const card = (
    <Card className={cn("h-full", STAT_TONES[tone].card)} title={title}>
      <CardHeader>
        <CardDescription className={cn(Icon && "flex items-center gap-1.5")}>
          {Icon && <Icon className="size-3.5" />}
          {label}
        </CardDescription>
        <CardTitle className={cn("text-lg tabular-nums", STAT_TONES[tone].value)}>
          {value}
        </CardTitle>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </CardHeader>
    </Card>
  );

  // A tile with nowhere to go stays a card rather than becoming a link that
  // does nothing: the same call PaymentReliabilityCard's rows make for a brand
  // that was never linked to a CRM record.
  return href ? (
    <Link href={href} className="rounded-lg transition hover:opacity-90">
      {card}
    </Link>
  ) : (
    card
  );
}
