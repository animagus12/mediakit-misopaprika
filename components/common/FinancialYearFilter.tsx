import Link from "next/link";
import { Button } from "@/components/ui/button";
import { financialYearHref, financialYearLabel } from "@/lib/financialYear";
import { cn } from "@/lib/utils";

// The April to March year picker shared by every page that can be read one
// financial year at a time. Plain links rather than client state: the year
// lives in ?fy=, so the server renders the filtered view, the choice survives
// a reload and a shared URL, and the picker ships no JavaScript of its own.

interface FinancialYearFilterProps {
  /** The page the links point at, e.g. "/invoices". */
  pathname: string;
  /** The page's current search params; every one other than fy is kept. */
  searchParams: Record<string, string | string[] | undefined>;
  /** Start years to offer, newest first (see financialYearsPresent). */
  years: readonly number[];
  /** The year on show, or null for the "All" view. */
  selected: number | null;
  /** Offer an "All" option first. Off where a page always shows one year. */
  includeAll?: boolean;
  /**
   * Keep the scroll position on change. For a filter that sits below the fold
   * and only changes the section it belongs to.
   */
  preserveScroll?: boolean;
  className?: string;
}

export function FinancialYearFilter({
  pathname,
  searchParams,
  years,
  selected,
  includeAll = false,
  preserveScroll = false,
  className,
}: FinancialYearFilterProps) {
  const options: { year: number | null; label: string }[] = [
    ...(includeAll ? [{ year: null, label: "All" }] : []),
    ...years.map((year) => ({ year, label: financialYearLabel(year) })),
  ];

  return (
    <nav aria-label="Financial year" className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const active = option.year === selected;
        return (
          <Button key={option.label} asChild variant={active ? "default" : "outline"} size="sm">
            <Link
              href={financialYearHref(pathname, searchParams, option.year)}
              aria-current={active ? "page" : undefined}
              scroll={preserveScroll ? false : undefined}
            >
              {option.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
